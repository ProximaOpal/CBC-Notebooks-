import { NextResponse } from "next/server";
import { deleteUserData, verifyPrivacyToken } from "@/middleware/privacy";
import { privacySubjectSchema } from "@/lib/webhooks/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = privacySubjectSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  if (!verifyPrivacyToken(email, "delete", parsed.data.token)) {
    return NextResponse.json({ error: "verification token invalid" }, { status: 403 });
  }
  const request = deleteUserData(email);
  return NextResponse.json({
    ok: true,
    request,
    message: "Erasure request fulfilled for stored account and profile records.",
  });
}
