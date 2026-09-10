import { NextResponse } from "next/server";
import { AuthRequiredError, requireAuthenticatedUser } from "@/middleware/isAuthenticated";
import { initiateSchema } from "@/lib/payments/initiate-schema";
import { jsonError, startPayment } from "@/lib/payments/initiate";

export const runtime = "nodejs";

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
    const result = await startPayment(parsed.data, user);
    if ("error" in result) return jsonError(result.error, result.status);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[payments] initiate failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start payment" },
      { status: 502 }
    );
  }
}
