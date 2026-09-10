import { NextResponse } from "next/server";
import { parseStkCallback } from "@/lib/payments/mpesa";
import { recordStkCallback } from "@/lib/payments/mpesa-resilience";
import { applySuccess } from "@/lib/payments/entitlements";
import { getTransactionByProviderReference, markStatus } from "@/lib/payments/transactions";
import { assertCallbackAllowlist } from "@/lib/webhooks/guard";

export const runtime = "nodejs";

type StkCallbackEnvelope = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      ResultCode?: number | string;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> };
    };
  };
};

export async function POST(req: Request) {
  try {
    assertCallbackAllowlist(req);
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Forbidden" }, { status: 403 });
  }
  const envelope = (await req.json().catch(() => ({}))) as StkCallbackEnvelope;
  const callback = envelope.Body?.stkCallback || {};
  recordStkCallback(callback);
  const parsed = parseStkCallback(callback);
  const tx = parsed.checkoutRequestId ? getTransactionByProviderReference(parsed.checkoutRequestId) : null;
  if (tx) {
    if (parsed.resultCode === "0") applySuccess(tx, { mpesa_receipt_number: parsed.receipt || null });
    else {
      markStatus(
        { id: tx.id },
        parsed.resultCode === "1037" ? "TIMED_OUT" : "FAILED",
        { failure_reason: parsed.resultDesc }
      );
    }
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
