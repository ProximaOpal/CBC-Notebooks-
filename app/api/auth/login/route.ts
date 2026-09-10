import { NextResponse } from "next/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { publicAccount, registerCredentialsAccount, verifyCredentialsAccount } from "@/lib/auth/accounts";
import { createSessionRecord, setSessionCookie } from "@/lib/auth/session";
import { rememberSubjectRecord } from "@/middleware/privacy";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

async function issueSession(userId: string, email?: string | null) {
  const session = createSessionRecord(userId);
  await setSessionCookie(session.id, session.exp);
  if (email) rememberSubjectRecord(email, { email_present: true });
}

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid credentials" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const fileUser = await verifyCredentialsAccount(email, parsed.data.password);
  if (fileUser) {
    await issueSession(fileUser.id, fileUser.email);
    return NextResponse.json({ ok: true, user: publicAccount(fileUser) });
  }
  try {
    const dbUser = await prisma.user.findUnique({ where: { email } });
    if (dbUser?.passwordHash && (await bcrypt.compare(parsed.data.password, dbUser.passwordHash))) {
      await issueSession(dbUser.id, dbUser.email);
      return NextResponse.json({
        ok: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          full_name: dbUser.name,
          auth_provider: dbUser.authProvider || "credentials",
        },
      });
    }
  } catch {
    /* Prisma optional */
  }
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
