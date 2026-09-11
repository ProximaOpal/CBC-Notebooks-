/**
 * Daraja Lipa Na M-Pesa Online for the Node static host (Render serve.mjs).
 */
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

function pad(value) {
  return String(value).padStart(2, "0");
}

function timestamp(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function password(ts) {
  return Buffer.from(`${shortcode()}${passkey()}${ts}`).toString("base64");
}

function callbackUrl() {
  return (
    process.env.MPESA_CALLBACK_URL ||
    process.env.MPESA_STK_CALLBACK_URL ||
    "https://cbcnotebooks.co.ke/api/payments/mpesa/callback"
  );
}

let tokenCache = null;

async function token() {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;
  const key = process.env.MPESA_CONSUMER_KEY || "";
  const secret = process.env.MPESA_CONSUMER_SECRET || "";
  if (!key || !secret) throw new Error("M-Pesa consumer credentials are not configured");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja token failed (${res.status})`);
  const json = await res.json();
  tokenCache = {
    token: json.access_token,
    expiresAt: now + Number(json.expires_in || 3599) * 1000,
  };
  return tokenCache.token;
}

export async function initiateStkPush(msisdn, amount, referenceId, description = "CBC Notebooks") {
  const kes = Math.round(Number(amount));
  if (!Number.isFinite(kes) || kes < 1) throw new Error("Amount must be at least 1 KES");
  if (!shortcode() || !passkey()) throw new Error("M-Pesa shortcode/passkey are not configured");
  const ts = timestamp();
  const access = await token();
  const res = await fetch(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode(),
      Password: password(ts),
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: kes,
      PartyA: msisdn,
      PartyB: shortcode(),
      PhoneNumber: msisdn,
      CallBackURL: callbackUrl(),
      AccountReference: String(referenceId).slice(0, 12),
      TransactionDesc: String(description).slice(0, 13),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || String(body.ResponseCode) !== "0" || !body.CheckoutRequestID) {
    throw new Error(body.CustomerMessage || body.ResponseDescription || body.errorMessage || "STK Push was rejected");
  }
  return body;
}

export function parseStkCallback(callback) {
  const items = callback.CallbackMetadata?.Item || [];
  const read = (name) => items.find((item) => item.Name === name)?.Value;
  return {
    checkoutRequestId: String(callback.CheckoutRequestID || ""),
    merchantRequestId: String(callback.MerchantRequestID || ""),
    resultCode: String(callback.ResultCode ?? ""),
    resultDesc: String(callback.ResultDesc || ""),
    receipt: read("MpesaReceiptNumber") != null ? String(read("MpesaReceiptNumber")) : undefined,
  };
}
