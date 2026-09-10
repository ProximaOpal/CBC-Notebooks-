"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { rememberSubjectRecord } from "@/middleware/privacy";
import { registerCredentialsAccount } from "@/lib/auth/accounts";

export type AuthActionResult = {
  ok: boolean;
  error?: string;
};

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function getAuthenticatedUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function handleCredentialsLogin(formData: FormData): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid credentials" };
  }
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Invalid credentials" };
    }
    return { ok: false, error: "Unable to sign in" };
  }
}

export async function handleRegisterUser(formData: FormData): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Check the form and try again" };
  }
  const email = parsed.data.email.toLowerCase();
  try {
    await registerCredentialsAccount({
      name: parsed.data.name,
      email,
      password: parsed.data.password,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "DuplicateEmailError") {
      return { ok: false, error: "Email already exists" };
    }
    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return { ok: false, error: "Email already exists" };
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      await prisma.user.create({
        data: {
          name: parsed.data.name,
          email,
          passwordHash,
        },
      });
    } catch {
      return { ok: false, error: "Unable to register" };
    }
  }
  rememberSubjectRecord(email, { name: parsed.data.name, email_present: true });
  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function handleGoogleSignIn(): Promise<void> {
  await signIn("google", { redirectTo: "/" });
}

export async function handleSignOut(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
