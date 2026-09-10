import { NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedUser } from "@/middleware/isAuthenticated";
import { initiateSchema, quoteOrThrow } from "@/lib/payments/initiate-schema";
import { createStripeSession } from "@/lib/payments/stripe";
import { createTransaction, updateTransaction } from "@/lib/payments/transactions";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  let user: { id: string; email?: string | null };
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthRequiredError) return jsonError("Authentication required", 401);
    throw error;
  }

  const parsed = initiateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }

  try {
    const sku = quoteOrThrow(parsed.data);
    const tx = createTransaction({
      user_id: user.id,
      provider: "STRIPE",
      amount: sku.amount,
      currency: sku.currency,
      metadata: {
        ...(parsed.data.metadata as Record<string, unknown> | undefined),
        sku: sku.sku,
        item: sku.sku,
      },
    });
    const session = await createStripeSession(
      sku.amount,
      sku.currency,
      tx.reference_id,
      parsed.data.email || user.email || undefined,
      parsed.data.description || sku.description
    );
    updateTransaction(tx.id, { provider_reference: String(session.payment_intent || session.id) });
    return NextResponse.json({
      ok: true,
      checkout_url: session.url,
      session_id: session.id,
      reference_id: tx.reference_id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Stripe checkout" },
      { status: 502 }
    );
  }
}
