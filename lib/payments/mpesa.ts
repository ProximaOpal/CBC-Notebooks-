/**
 * Safaricom Daraja Lipa Na M-Pesa Online (STK Push).
 * Password = Base64(Shortcode + Passkey + Timestamp)
 */

import { rememberStkIntent, scheduleStkQueryFallback } from "./mpesa-resilience";

export type DarajaToken = { access_token: string; expires_in: number };
export type StkPushResult = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
};

type TokenCache = { token: string; expiresAt: number };

let tokenCache: TokenCache | null = null;

function darajaBase() {
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

function callbackUrl() {
  return (
    process.env.MPESA_CALLBACK_URL ||
    process.env.MPESA_STK_CALLBACK_URL ||
    "http://localhost:3000/api/payments/mpesa/callback"
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function darajaTimestamp(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function darajaPassword(ts: string) {
  return Buffer.from(`${shortcode()}${passkey()}${ts}`).toString("base64");
}

/** 07xx / 01xx / +2547xx / 2547xx / 2541xx → 254XXXXXXXXX */
export function toMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  throw new Error("Enter a valid Kenyan mobile number (2547/2541)");
}

export function maskMsisdn(msisdn: string) {
  return msisdn.replace(/(\d{5})\d{4}(\d{3})/, "$1****$2");
}

export async function getDarajaToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;
  const key = process.env.MPESA_CONSUMER_KEY || "";
  const secret = process.env.MPESA_CONSUMER_SECRET || "";
  if (!key || !secret) throw new Error("M-Pesa consumer credentials are not configured");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[mpesa] token error", res.status, body);
    throw new Error(`Daraja token failed (${res.status})`);
  }
  const json = (await res.json()) as DarajaToken;
  if (!json.access_token) throw new Error("Daraja token missing access_token");
  tokenCache = {
    token: json.access_token,
    expiresAt: now + Number(json.expires_in || 3599) * 1000,
  };
  return json.access_token;
}

async function darajaPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const token = await getDarajaToken();
  const res = await fetch(`${darajaBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as T & { errorMessage?: string; errorCode?: string };
  if (!res.ok) {
    console.error("[mpesa] request failed", path, res.status, json);
    throw new Error(json.errorMessage || `Daraja request failed (${res.status})`);
  }
  return json;
}

export async function initiateStkPush(
  phoneNumber: string,
  amount: number,
  referenceId: string,
  description = "CBC Notebooks"
): Promise<StkPushResult> {
  const msisdn = toMsisdn(phoneNumber);
  const kes = Math.round(Number(amount));
  if (!Number.isFinite(kes) || kes < 1) throw new Error("Amount must be at least 1 KES");
  if (!shortcode() || !passkey()) throw new Error("M-Pesa shortcode/passkey are not configured");
  const ts = darajaTimestamp();
  const body = await darajaPost<StkPushResult>("/mpesa/stkpush/v1/processrequest", {
    BusinessShortCode: shortcode(),
    Password: darajaPassword(ts),
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: kes,
    PartyA: msisdn,
    PartyB: shortcode(),
    PhoneNumber: msisdn,
    CallBackURL: callbackUrl(),
    AccountReference: referenceId.slice(0, 12),
    TransactionDesc: description.slice(0, 13),
  });
  if (String(body.ResponseCode) !== "0" || !body.CheckoutRequestID) {
    console.error("[mpesa] stk rejected", body);
    throw new Error(body.CustomerMessage || body.ResponseDescription || "STK Push was rejected");
  }
  rememberStkIntent({
    checkoutRequestId: body.CheckoutRequestID,
    merchantRequestId: body.MerchantRequestID,
    amount: kes,
    accountReference: referenceId,
    msisdn,
  });
  scheduleStkQueryFallback(body.CheckoutRequestID);
  return body;
}

export async function queryStkStatus(checkoutRequestId: string) {
  const ts = darajaTimestamp();
  return darajaPost<Record<string, unknown>>("/mpesa/stkpushquery/v1/query", {
    BusinessShortCode: shortcode(),
    Password: darajaPassword(ts),
    Timestamp: ts,
    CheckoutRequestID: checkoutRequestId,
  });
}

export type StkCallback = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number | string;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> };
};

export function parseStkCallback(callback: StkCallback) {
  const items = callback.CallbackMetadata?.Item || [];
  const read = (name: string) => items.find((item) => item.Name === name)?.Value;
  return {
    checkoutRequestId: String(callback.CheckoutRequestID || ""),
    merchantRequestId: String(callback.MerchantRequestID || ""),
    resultCode: String(callback.ResultCode ?? ""),
    resultDesc: String(callback.ResultDesc || ""),
    receipt: read("MpesaReceiptNumber") != null ? String(read("MpesaReceiptNumber")) : undefined,
    amount: read("Amount") != null ? Number(read("Amount")) : undefined,
    phone: read("PhoneNumber") != null ? String(read("PhoneNumber")) : undefined,
  };
}
