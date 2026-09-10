import { NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedUser } from "@/middleware/isAuthenticated";
import { publicTransaction, getTransactionByProviderReference, getTransactionByReference } from "@/lib/payments/transactions";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ referenceId: string }> }) {
  let user: { id: string };
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    throw error;
  }

  const { referenceId } = await context.params;
  const tx =
    getTransactionByReference(referenceId) || getTransactionByProviderReference(referenceId);
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (tx.user_id !== user.id) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({ transaction: publicTransaction(tx) });
}
