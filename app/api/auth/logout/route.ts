import { NextResponse } from "next/server";
import { revokeGoogleToken } from "@/lib/auth/google";
import {
  clearSessionCookie,
  destroySessionRecord,
  getSessionIdFromCookie,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const sessionId = await getSessionIdFromCookie();
  const session = sessionId ? destroySessionRecord(sessionId) : null;
  if (session?.idToken) await revokeGoogleToken(session.idToken);
  await clearSessionCookie();
  return NextResponse.json({ ok: true, revoked: Boolean(session?.idToken) });
}
