import { NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedUser } from "@/middleware/isAuthenticated";
import { listEntitlements } from "@/lib/payments/entitlements";
import { aiUsage, canAskAi } from "@/lib/payments/ai-quota";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json({
      entitlements: listEntitlements(user.id),
      ask_ai: { ...canAskAi(user.id), used: aiUsage(user.id).count },
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    throw error;
  }
}
