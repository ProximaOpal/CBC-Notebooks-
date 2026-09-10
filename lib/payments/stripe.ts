import Stripe from "stripe";
import { publicSiteOrigin } from "@/lib/site";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export async function createStripeSession(
  amount: number,
  currency: string,
  referenceId: string,
  userEmail?: string,
  description = "CBC Notebooks"
) {
  const stripe = getStripe();
  const unitAmount = Math.round(Number(amount) * (currency.toUpperCase() === "KES" ? 100 : 100));
  if (!Number.isFinite(unitAmount) || unitAmount < 1) throw new Error("Invalid Stripe amount");
  const origin = publicSiteOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/?payment=success&ref=${encodeURIComponent(referenceId)}`,
    cancel_url: `${origin}/?payment=cancelled&ref=${encodeURIComponent(referenceId)}`,
    customer_email: userEmail || undefined,
    client_reference_id: referenceId,
    metadata: { reference_id: referenceId },
    payment_intent_data: {
      metadata: { reference_id: referenceId },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: unitAmount,
          product_data: { name: description },
        },
      },
    ],
  });
  return session;
}

export function constructStripeEvent(rawBody: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
