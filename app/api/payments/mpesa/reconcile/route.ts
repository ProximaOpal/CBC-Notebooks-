import { NextResponse } from "next/server";
import { processDueStkQueries } from "@/lib/payments/mpesa-resilience";
import { assertReconcileAuth } from "@/lib/webhooks/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertReconcileAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const updated = await processDueStkQueries();
  return NextResponse.json({ ok: true, reconciled: updated.length });
}
