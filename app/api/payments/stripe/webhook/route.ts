import { NextResponse } from "next/server";
import { constructStripeEvent } from "@/lib/payments/stripe";
import { applySuccess } from "@/lib/payments/entitlements";
import {
  getTransactionByReference,
  getTransactionByProviderReference,
  markStatus,
} from "@/lib/payments/transactions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  const raw = await req.text();
  try {
    const event = constructStripeEvent(raw, signature);
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const object = event.data.object as {
        id?: string;
        client_reference_id?: string;
        payment_intent?: string;
        metadata?: { reference_id?: string };
      };
      const reference =
        object.client_reference_id ||
        object.metadata?.reference_id ||
        "";
      const providerRef = String(object.payment_intent || object.id || "");
      const tx =
        (reference && getTransactionByReference(reference)) ||
        getTransactionByProviderReference(providerRef);
      if (tx && tx.status !== "SUCCESS") applySuccess(tx, { provider_reference: providerRef });
    }
    if (event.type === "payment_intent.payment_failed" || event.type === "checkout.session.expired") {
      const object = event.data.object as { id?: string; metadata?: { reference_id?: string } };
      const tx =
        (object.metadata?.reference_id && getTransactionByReference(object.metadata.reference_id)) ||
        getTransactionByProviderReference(String(object.id || ""));
      if (tx) markStatus({ id: tx.id }, "FAILED", { failure_reason: event.type });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe] webhook error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook verification failed" },
      { status: 400 }
    );
  }
}
