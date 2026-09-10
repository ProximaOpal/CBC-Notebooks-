import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGoogleIdToken } from "@/lib/auth/google";
import { publicAccount, upsertGoogleAccount } from "@/lib/auth/accounts";
import { createSessionRecord, setSessionCookie } from "@/lib/auth/session";
import { googleCredentialSchema } from "@/lib/webhooks/guard";
import { rememberSubjectRecord } from "@/middleware/privacy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = googleCredentialSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing Google credential" }, { status: 400 });
  }
  try {
    const profile = await verifyGoogleIdToken(parsed.data.credential);
    const now = new Date();
    let savedId = "";
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { googleId: profile.google_id },
            ...(profile.email ? [{ email: profile.email }] : []),
          ],
        },
      });
      const saved = user
        ? await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.google_id,
              email: profile.email,
              emailVerified: profile.email_verified ? now : null,
              name: profile.full_name,
              givenName: profile.given_name,
              familyName: profile.family_name,
              image: profile.picture_url,
              locale: profile.locale,
              authProvider: "GOOGLE",
              lastLoginAt: now,
            },
          })
        : await prisma.user.create({
            data: {
              googleId: profile.google_id,
              email: profile.email,
              emailVerified: profile.email_verified ? now : null,
              name: profile.full_name,
              givenName: profile.given_name,
              familyName: profile.family_name,
              image: profile.picture_url,
              locale: profile.locale,
              authProvider: "GOOGLE",
              lastLoginAt: now,
            },
          });
      savedId = saved.id;
    } catch {
      /* file store is the durable fallback when Prisma is unavailable */
    }
    const fileUser = upsertGoogleAccount(profile);
    if (!savedId) savedId = fileUser.id;
    if (profile.email) rememberSubjectRecord(profile.email, { google_id: profile.google_id, email_present: true });
    const session = createSessionRecord(savedId, parsed.data.credential);
    await setSessionCookie(session.id, session.exp);
    return NextResponse.json({
      ok: true,
      user: publicAccount({ ...fileUser, id: savedId }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google authentication failed" },
      { status: 401 }
    );
  }
}
