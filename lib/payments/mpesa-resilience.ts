/**
 * Safaricom Daraja STK + C2B resilience for Kenya.
 * Handles missed callbacks, cancelled prompts, Paybill fallback, and MSISDN variants.
 */

import { loadJson, saveJson } from "@/lib/persist/json-store";
import { isTestEnv } from "@/lib/security/secrets";
import { applySuccess } from "./entitlements";
import { getTransactionByReference, markStatus } from "./transactions";

export const STK_QUERY_FALLBACK_MS = 30_000;

export const MPESA_RESULT = {
  SUCCESS: "0",
  INSUFFICIENT_FUNDS: "1",
  EXPIRED: "1037",
  CANCELLED: "1032",
  WRONG_PIN: "2001",
  TIMEOUT: "1037",
  USER_UNREACHABLE: "1037",
} as const;

export type MpesaIntentStatus =
  | "pending_stk"
  | "awaiting_query"
  | "paid"
  | "failed"
  | "cancelled"
  | "paybill_pending"
  | "paybill_paid";

export type StkIntent = {
  checkoutRequestId: string;
  merchantRequestId?: string;
  amount: number;
  accountReference: string;
  msisdnMasked: string;
  status: MpesaIntentStatus;
  resultCode?: string;
  resultDesc?: string;
  receipt?: string;
  createdAt: string;
  queryAfter: string;
  queriedAt?: string;
  callbackAt?: string;
};

export type C2bPayload = {
  TransactionType?: string;
  TransID?: string;
  TransTime?: string;
  TransAmount?: string;
  BusinessShortCode?: string;
  BillRefNumber?: string;
  InvoiceNumber?: string;
  OrgAccountBalance?: string;
  ThirdPartyTransID?: string;
  MSISDN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
};

type TokenCache = { token: string; expiresAt: number };
type IntentStore = Record<string, StkIntent>;

const INTENT_FILE = "mpesa-intents.json";
const RECEIPT_FILE = "mpesa-receipts.json";

let tokenCache: TokenCache | null = null;
const scheduled = new Map<string, ReturnType<typeof setTimeout>>();

function intents(): IntentStore {
  return loadJson<IntentStore>(INTENT_FILE, {});
}

function saveIntents(rows: IntentStore) {
  saveJson(INTENT_FILE, rows);
}

function receiptSet(): Set<string> {
  return new Set(loadJson<string[]>(RECEIPT_FILE, []));
}

function saveReceipts(set: Set<string>) {
  saveJson(RECEIPT_FILE, [...set]);
}

function putIntent(intent: StkIntent) {
  const rows = intents();
  rows[intent.checkoutRequestId] = intent;
  saveIntents(rows);
  return intent;
}

function darajaBase() {
  const explicit = process.env.MPESA_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function shortcode() {
  return process.env.MPESA_SHORTCODE || process.env.MPESA_PAYBILL || "";
}

function passkey() {
  return process.env.MPESA_PASSKEY || "";
}

function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function stkPassword(ts: string) {
  return Buffer.from(`${shortcode()}${passkey()}${ts}`).toString("base64");
}

/** 07xx / +2547xx / 2547xx → 2547XXXXXXXX */
export function toMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `254${digits}`;
  throw new Error("Invalid Kenyan MSISDN");
}

export function maskMsisdn(msisdn: string): string {
  return msisdn.replace(/(\d{5})\d{4}(\d{3})/, "$1****$2");
}

export function getIntent(checkoutRequestId: string): StkIntent | undefined {
  return intents()[checkoutRequestId];
}

export function listPendingIntents(): StkIntent[] {
  return Object.values(intents()).filter((row) => row.status === "pending_stk" || row.status === "awaiting_query");
}

async function darajaToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;
  const key = process.env.MPESA_CONSUMER_KEY || "";
  const secret = process.env.MPESA_CONSUMER_SECRET || "";
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja token failed (${res.status})`);
  const body = (await res.json()) as { access_token?: string; expires_in?: string };
  if (!body.access_token) throw new Error("Daraja token missing");
  tokenCache = {
    token: body.access_token,
    expiresAt: now + Number(body.expires_in || 3599) * 1000,
  };
  return body.access_token;
}

export async function registerC2bUrls(): Promise<unknown> {
  const token = await darajaToken();
  const res = await fetch(`${darajaBase()}/mpesa/c2b/v1/registerurl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ShortCode: shortcode(),
      ResponseType: "Completed",
      ConfirmationURL: process.env.MPESA_C2B_CONFIRMATION_URL,
      ValidationURL: process.env.MPESA_C2B_VALIDATION_URL,
    }),
  });
  return res.json();
}

export function rememberStkIntent(input: {
  checkoutRequestId: string;
  merchantRequestId?: string;
  amount: number;
  accountReference: string;
  msisdn: string;
}): StkIntent {
  const intent: StkIntent = {
    checkoutRequestId: input.checkoutRequestId,
    merchantRequestId: input.merchantRequestId,
    amount: input.amount,
    accountReference: input.accountReference,
    msisdnMasked: maskMsisdn(toMsisdn(input.msisdn)),
    status: "pending_stk",
    createdAt: new Date().toISOString(),
    queryAfter: new Date(Date.now() + STK_QUERY_FALLBACK_MS).toISOString(),
  };
  putIntent(intent);
  scheduleStkQueryFallback(intent.checkoutRequestId);
  return intent;
}

export function scheduleStkQueryFallback(checkoutRequestId: string): void {
  if (isTestEnv()) return;
  const existing = scheduled.get(checkoutRequestId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    scheduled.delete(checkoutRequestId);
    void queryStkIfCallbackMissing(checkoutRequestId);
  }, STK_QUERY_FALLBACK_MS);
  scheduled.set(checkoutRequestId, timer);
}

export async function queryStkPush(checkoutRequestId: string): Promise<Record<string, unknown>> {
  const ts = timestamp();
  const token = await darajaToken();
  const res = await fetch(`${darajaBase()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode(),
      Password: stkPassword(ts),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  return (await res.json()) as Record<string, unknown>;
}

function settleLedger(intent: StkIntent) {
  const tx = getTransactionByReference(intent.accountReference);
  if (!tx) return;
  if (intent.status === "paid" || intent.status === "paybill_paid") {
    applySuccess(tx, { mpesa_receipt_number: intent.receipt || null, provider_reference: intent.checkoutRequestId });
    return;
  }
  if (intent.status === "cancelled" || intent.status === "failed") {
    const timedOut = intent.resultCode === MPESA_RESULT.TIMEOUT;
    markStatus({ id: tx.id }, timedOut ? "TIMED_OUT" : "FAILED", { failure_reason: intent.resultDesc });
  }
}

export function applyStkResult(intent: StkIntent, resultCode: string, resultDesc?: string, receipt?: string): StkIntent {
  intent.resultCode = resultCode;
  intent.resultDesc = resultDesc;
  if (resultCode === MPESA_RESULT.SUCCESS) {
    intent.status = "paid";
    if (receipt) {
      intent.receipt = receipt;
      const set = receiptSet();
      set.add(receipt);
      saveReceipts(set);
    }
  } else if (resultCode === MPESA_RESULT.CANCELLED) intent.status = "cancelled";
  else intent.status = "failed";
  putIntent(intent);
  settleLedger(intent);
  return intent;
}

export async function queryStkIfCallbackMissing(checkoutRequestId: string): Promise<StkIntent | undefined> {
  const intent = getIntent(checkoutRequestId);
  if (!intent) return undefined;
  if (intent.status !== "pending_stk" && intent.status !== "awaiting_query") return intent;
  if (intent.callbackAt) return intent;

  intent.status = "awaiting_query";
  intent.queriedAt = new Date().toISOString();
  putIntent(intent);
  try {
    const body = await queryStkPush(checkoutRequestId);
    const resultCode = String(body.ResultCode ?? body.resultCode ?? "");
    const resultDesc = String(body.ResultDesc ?? body.resultDesc ?? "");
    if (!resultCode) {
      intent.status = "paybill_pending";
      return putIntent(intent);
    }
    return applyStkResult(intent, resultCode, resultDesc);
  } catch {
    intent.status = "paybill_pending";
    return putIntent(intent);
  }
}

export async function processDueStkQueries(now = Date.now()): Promise<StkIntent[]> {
  const due = Object.values(intents()).filter(
    (row) =>
      (row.status === "pending_stk" || row.status === "awaiting_query") &&
      !row.callbackAt &&
      new Date(row.queryAfter).getTime() <= now
  );
  const updated: StkIntent[] = [];
  for (const row of due) {
    const next = await queryStkIfCallbackMissing(row.checkoutRequestId);
    if (next) updated.push(next);
  }
  return updated;
}

export function recordStkCallback(payload: {
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  ResultCode?: number | string;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> };
}): StkIntent | undefined {
  const checkoutRequestId = String(payload.CheckoutRequestID || "");
  const intent = getIntent(checkoutRequestId);
  if (!intent) return undefined;
  if (intent.callbackAt && intent.status === "paid") return intent;
  intent.callbackAt = new Date().toISOString();
  const timer = scheduled.get(checkoutRequestId);
  if (timer) {
    clearTimeout(timer);
    scheduled.delete(checkoutRequestId);
  }
  const items = payload.CallbackMetadata?.Item || [];
  const receipt = items.find((item) => item.Name === "MpesaReceiptNumber")?.Value;
  return applyStkResult(
    intent,
    String(payload.ResultCode ?? ""),
    payload.ResultDesc,
    receipt != null ? String(receipt) : undefined
  );
}

export function c2bAccept() {
  return { ResultCode: "0", ResultDesc: "Accepted" };
}

export function c2bReject(reason = "Rejected") {
  return { ResultCode: "C2B00016", ResultDesc: reason };
}

export function validateC2bPayment(body: C2bPayload) {
  const amount = Number(body.TransAmount || 0);
  const billRef = String(body.BillRefNumber || "").trim();
  const transId = String(body.TransID || "").trim();
  if (!transId) return c2bReject("Missing TransID");
  if (!Number.isFinite(amount) || amount <= 0) return c2bReject("Invalid amount");
  if (!billRef) return c2bReject("Missing account reference");
  if (receiptSet().has(transId)) return c2bAccept();
  return c2bAccept();
}

export function confirmC2bPayment(body: C2bPayload) {
  const transId = String(body.TransID || "").trim();
  const set = receiptSet();
  if (transId) {
    set.add(transId);
    saveReceipts(set);
  }
  const billRef = String(body.BillRefNumber || "").trim();
  const rows = intents();
  for (const intent of Object.values(rows)) {
    if (intent.accountReference === billRef && intent.status !== "paid" && intent.status !== "paybill_paid") {
      intent.status = "paybill_paid";
      intent.receipt = transId;
      intent.resultCode = MPESA_RESULT.SUCCESS;
      intent.resultDesc = "C2B Paybill confirmation";
      intent.callbackAt = new Date().toISOString();
      putIntent(intent);
      settleLedger(intent);
    }
  }
  const tx = getTransactionByReference(billRef);
  if (tx && tx.status === "PENDING") {
    applySuccess(tx, { mpesa_receipt_number: transId || null });
  }
  return c2bAccept();
}
