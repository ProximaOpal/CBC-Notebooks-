import { NextResponse } from "next/server";
import { appendJsonl } from "@/lib/persist/json-store";
import { c2bSchema, assertC2bWebhook } from "@/lib/webhooks/guard";
import { confirmC2bPayment, type C2bPayload } from "@/lib/payments/mpesa-resilience";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertC2bWebhook(req);
  } catch {
    return NextResponse.json({ ResultCode: "C2B00016", ResultDesc: "Unauthorized" }, { status: 403 });
  }
  const parsed = c2bSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ResultCode: "C2B00016", ResultDesc: parsed.error.issues[0]?.message || "Rejected" });
  }
  appendJsonl("c2b.jsonl", { ...parsed.data, at: new Date().toISOString() });
  return NextResponse.json(confirmC2bPayment(parsed.data as C2bPayload));
}
