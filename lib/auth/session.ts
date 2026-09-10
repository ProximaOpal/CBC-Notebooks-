import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  parseSignedSessionCookie,
  signSessionId,
} from "./session-store";

export {
  SESSION_COOKIE,
  createSessionRecord,
  destroySessionRecord,
  parseSignedSessionCookie,
  readSessionRecord,
  safeEqual,
  signSessionId,
} from "./session-store";

export async function setSessionCookie(sessionId: string, exp: number) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, `${sessionId}.${signSessionId(sessionId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionIdFromCookie() {
  const jar = await cookies();
  return parseSignedSessionCookie(jar.get(SESSION_COOKIE)?.value || "");
}
