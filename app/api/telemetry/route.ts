import { NextResponse } from "next/server";
import { anonymizeTelemetry } from "@/middleware/privacy";
import { appendJsonl } from "@/lib/persist/json-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clean = anonymizeTelemetry(body, req.headers);
  appendJsonl("events.jsonl", { ...clean, stored_at: new Date().toISOString() });
  return NextResponse.json({ ok: true, stored: true, event: clean.event || "unknown" }, { status: 202 });
}
