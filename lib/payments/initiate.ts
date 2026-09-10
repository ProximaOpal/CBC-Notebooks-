import { NextResponse } from "next/server";
import { quoteOrThrow, type InitiateBody } from "./initiate-schema";
import { initiateStkPush, toMsisdn } from "@/lib/payments/mpesa";
import { createStripeSession } from "@/lib/payments/stripe";
import { createTransaction, publicTransaction, updateTransaction } from "@/lib/payments/transactions";
import { resolveMethod, type InitiatePaymentInput } from "@/lib/payments/types";

export { initiateSchema, quoteOrThrow, type InitiateBody } from "./initiate-schema";

export async function startPayment(
  input: InitiateBody,
  user: { id: string; email?: string | null }
) {
  const sku = quoteOrThrow(input);
  const method = resolveMethod({
    ...input,
    amount: sku.amount,
    currency: sku.currency,
  } as InitiatePaymentInput);
  const tx = createTransaction({
    user_id: user.id,
    provider: method,
    amount: sku.amount,
    currency: sku.currency,
    metadata: {
      ...(input.metadata as Record<string, unknown> | undefined),
      sku: sku.sku,
      item: sku.sku,
      resource_type: sku.resource_type,
      country: input.country || "KE",
      email: input.email || user.email || undefined,
      phone: input.phone,
    },
  });

  try {
    if (method === "MPESA") {
      if (!input.phone) {
        updateTransaction(tx.id, { status: "FAILED", failure_reason: "M-Pesa requires a Kenyan phone number" });
        return { error: "M-Pesa requires a Kenyan phone number", status: 400 as const };
      }
      const msisdn = toMsisdn(input.phone);
      const stk = await initiateStkPush(msisdn, sku.amount, tx.reference_id, input.description || sku.description);
      const next = updateTransaction(tx.id, { provider_reference: stk.CheckoutRequestID });
      return {
        ok: true as const,
        method,
        transaction: next ? publicTransaction(next) : publicTransaction(tx),
        checkout_request_id: stk.CheckoutRequestID,
        customer_message: stk.CustomerMessage,
      };
    }

    const session = await createStripeSession(
      sku.amount,
      sku.currency,
      tx.reference_id,
      input.email || user.email || undefined,
      input.description || sku.description
    );
    const next = updateTransaction(tx.id, {
      provider_reference: String(session.payment_intent || session.id),
    });
    return {
      ok: true as const,
      method,
      transaction: next ? publicTransaction(next) : publicTransaction(tx),
      checkout_url: session.url,
      session_id: session.id,
    };
  } catch (error) {
    updateTransaction(tx.id, {
      status: "FAILED",
      failure_reason: error instanceof Error ? error.message : "Payment initiate failed",
    });
    throw error;
  }
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
