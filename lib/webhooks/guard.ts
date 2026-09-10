import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const c2bSchema = z.object({
  TransactionType: z.string().optional(),
  TransID: z.string().min(1),
  TransTime: z.string().optional(),
  TransAmount: z.string().min(1),
  BusinessShortCode: z.string().optional(),
  BillRefNumber: z.string().min(1),
  InvoiceNumber: z.string().optional(),
  OrgAccountBalance: z.string().optional(),
  ThirdPartyTransID: z.string().optional(),
  MSISDN: z.string().optional(),
  FirstName: z.string().optional(),
  MiddleName: z.string().optional(),
  LastName: z.string().optional(),
});

export const privacySubjectSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().min(16),
});

export const googleCredentialSchema = z.object({
  credential: z.string().min(20),
});

function readToken(req: Request, queryKey = "token") {
  const header = req.headers.get("x-mpesa-webhook-token") || req.headers.get("x-webhook-token") || "";
  const url = new URL(req.url);
  return header || url.searchParams.get(queryKey) || "";
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function assertC2bWebhook(req: Request) {
  const expected = String(process.env.MPESA_C2B_WEBHOOK_SECRET || "").trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("C2B webhook secret is not configured");
      err.name = "WebhookAuthError";
      throw err;
    }
    return;
  }
  if (!equal(readToken(req), expected)) {
    const err = new Error("Invalid C2B webhook token");
    err.name = "WebhookAuthError";
    throw err;
  }
}

export function assertReconcileAuth(req: Request) {
  const expected = String(process.env.MPESA_RECONCILE_SECRET || process.env.CRON_SECRET || "").trim();
  if (!expected) {
    const err = new Error("Reconcile secret is not configured");
    err.name = "WebhookAuthError";
    throw err;
  }
  const given = req.headers.get("x-reconcile-token") || readToken(req);
  if (!equal(given, expected)) {
    const err = new Error("Invalid reconcile token");
    err.name = "WebhookAuthError";
    throw err;
  }
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  return forwarded.split(",")[0]?.trim() || "";
}

export function assertCallbackAllowlist(req: Request) {
  const allow = String(process.env.MPESA_CALLBACK_IPS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allow.length) return;
  const ip = clientIp(req);
  if (!ip || !allow.includes(ip)) {
    const err = new Error("Callback IP not allowed");
    err.name = "WebhookAuthError";
    throw err;
  }
}
