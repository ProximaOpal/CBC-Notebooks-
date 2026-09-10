import { getAccount } from "@/lib/auth/accounts";
import { getSessionIdFromCookie, readSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

async function fromGisCookie() {
  const sessionId = await getSessionIdFromCookie();
  if (!sessionId) return null;
  const session = readSessionRecord(sessionId);
  if (!session) return null;
  const fileUser = getAccount(session.userId);
  if (fileUser) return { id: fileUser.id, email: fileUser.email, name: fileUser.name || fileUser.full_name };
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: session.userId } });
    if (dbUser) return { id: dbUser.id, email: dbUser.email, name: dbUser.name };
  } catch {
    /* Prisma is optional when DATABASE_URL is unset */
  }
  return { id: session.userId, email: null, name: null };
}

async function fromNextAuth() {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      email: session.user.email || null,
      name: session.user.name || null,
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser() {
  return (await fromGisCookie()) || (await fromNextAuth());
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new AuthRequiredError();
  return user;
}

export async function isAuthenticated() {
  return Boolean(await getAuthenticatedUser());
}
