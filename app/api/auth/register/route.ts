import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validations/auth";
import { publicAccount, registerCredentialsAccount } from "@/lib/auth/accounts";
import { createSessionRecord, setSessionCookie } from "@/lib/auth/session";
import { rememberSubjectRecord } from "@/middleware/privacy";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the form and try again" }, { status: 400 });
  }
  try {
    const user = await registerCredentialsAccount(parsed.data);
    try {
      await prisma.user.create({
        data: {
          id: user.id,
          name: parsed.data.name,
          email: user.email,
          passwordHash: user.passwordHash,
          authProvider: "credentials",
        },
      });
    } catch {
      /* Prisma optional / unique conflict is fine — file store already has the user */
    }
    const session = createSessionRecord(user.id);
    await setSessionCookie(session.id, session.exp);
    rememberSubjectRecord(user.email, { name: user.name, email_present: true });
    return NextResponse.json({ ok: true, user: publicAccount(user) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "DuplicateEmailError") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    try {
      const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const created = await prisma.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          passwordHash,
          authProvider: "credentials",
        },
      });
      const session = createSessionRecord(created.id);
      await setSessionCookie(session.id, session.exp);
      return NextResponse.json({
        ok: true,
        user: { id: created.id, email: created.email, full_name: created.name, auth_provider: "credentials" },
      }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Unable to register" }, { status: 500 });
    }
  }
}
