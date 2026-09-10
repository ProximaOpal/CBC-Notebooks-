import { NextResponse } from "next/server";
import { c2bSchema, assertC2bWebhook } from "@/lib/webhooks/guard";
import { validateC2bPayment, type C2bPayload } from "@/lib/payments/mpesa-resilience";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ResultCode: "C2B00016", ResultDesc: "Unauthorized" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    assertC2bWebhook(req);
  } catch {
    return unauthorized();
  }
  const parsed = c2bSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ResultCode: "C2B00016", ResultDesc: parsed.error.issues[0]?.message || "Rejected" });
  }
  return NextResponse.json(validateC2bPayment(parsed.data as C2bPayload));
}
