import { NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedUser } from "@/middleware/isAuthenticated";
import { hasKindAccess } from "@/lib/payments/entitlements";

export class PaymentRequiredError extends Error {
  constructor(public kind: string) {
    super("Payment required");
    this.name = "PaymentRequiredError";
  }
}

export async function requireEntitledUser(kind: string) {
  const user = await requireAuthenticatedUser();
  if (!hasKindAccess(user.id, kind)) throw new PaymentRequiredError(kind);
  return user;
}

export function contentGateError(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof PaymentRequiredError) {
    return NextResponse.json(
      { error: "Payment required", code: "PAYMENT_REQUIRED", kind: error.kind },
      { status: 402 }
    );
  }
  throw error;
}
