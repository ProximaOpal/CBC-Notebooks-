import { NextResponse } from "next/server";
import { parseStkCallback } from "@/lib/payments/mpesa";
import { recordStkCallback } from "@/lib/payments/mpesa-resilience";
import { applySuccess } from "@/lib/payments/entitlements";
import { getTransactionByProviderReference, markStatus } from "@/lib/payments/transactions";
import { assertCallbackAllowlist } from "@/lib/webhooks/guard";

export const runtime = "nodejs";

type Envelope = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number | string;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> };
    };
  };
};

function applyParsed(callback: NonNullable<Envelope["Body"]>["stkCallback"]) {
  if (!callback) return;
  recordStkCallback(callback);
  const parsed = parseStkCallback(callback);
  const tx = getTransactionByProviderReference(parsed.checkoutRequestId);
  if (!tx) return;
  if (parsed.resultCode === "0") {
    applySuccess(tx, { mpesa_receipt_number: parsed.receipt || null });
    return;
  }
  markStatus(
    { id: tx.id },
    parsed.resultCode === "1037" ? "TIMED_OUT" : "FAILED",
    { failure_reason: parsed.resultDesc }
  );
}

export async function POST(req: Request) {
  try {
    assertCallbackAllowlist(req);
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Forbidden" }, { status: 403 });
  }
  const envelope = (await req.json().catch(() => ({}))) as Envelope;
  const callback = envelope.Body?.stkCallback;
  if (!callback) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Missing stkCallback" }, { status: 400 });
  }
  applyParsed(callback);
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
