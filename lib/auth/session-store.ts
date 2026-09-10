import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hmacSecret } from "@/lib/security/secrets";
import { openSealed, sealSecret } from "@/lib/security/crypto-token";
import { loadJson, saveJson } from "@/lib/persist/json-store";

export const SESSION_COOKIE = "cbc_session";
const FILE = "gis-sessions.json";

type SessionRow = {
  userId: string;
  idTokenEnc?: string;
  exp: number;
};

function store(): Record<string, SessionRow> {
  return loadJson<Record<string, SessionRow>>(FILE, {});
}

function persist(all: Record<string, SessionRow>) {
  saveJson(FILE, all);
}

function secret() {
  return hmacSecret("session");
}

export function signSessionId(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseSignedSessionCookie(raw: string) {
  if (!raw.includes(".")) return "";
  const idx = raw.lastIndexOf(".");
  const id = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  try {
    if (!safeEqual(signSessionId(id), mac)) return "";
  } catch {
    return "";
  }
  return id;
}

export function createSessionRecord(userId: string, idToken?: string) {
  const id = randomBytes(24).toString("hex");
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const all = store();
  all[id] = {
    userId,
    idTokenEnc: idToken ? sealSecret(idToken) : undefined,
    exp,
  };
  persist(all);
  return { id, exp };
}

export function readSessionRecord(id: string) {
  if (!id) return null;
  const all = store();
  const row = all[id];
  if (!row || row.exp < Date.now()) {
    if (row) {
      delete all[id];
      persist(all);
    }
    return null;
  }
  return {
    userId: row.userId,
    idToken: row.idTokenEnc ? openSealed(row.idTokenEnc) : null,
    exp: row.exp,
  };
}

export function destroySessionRecord(id: string) {
  const all = store();
  const row = all[id] || null;
  if (row) {
    delete all[id];
    persist(all);
  }
  if (!row) return null;
  return {
    userId: row.userId,
    idToken: row.idTokenEnc ? openSealed(row.idTokenEnc) : null,
    exp: row.exp,
  };
}
