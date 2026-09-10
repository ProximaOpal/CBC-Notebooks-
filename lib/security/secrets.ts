/**
 * HMAC / signing secrets. Production refuses to boot with a missing or well-known fallback.
 */

import { randomBytes } from "node:crypto";

const FORBIDDEN = new Set(["", "cbc-notebooks-session", "cbc-notebooks-odpc"]);
const ephemeral = new Map<string, string>();

export type SecretKind = "session" | "privacy";

function readRaw(kind: SecretKind): string {
  if (kind === "privacy") {
    return String(process.env.PRIVACY_SIGNING_SECRET || process.env.AUTH_SECRET || process.env.SESSION_SECRET || "");
  }
  return String(process.env.SESSION_SECRET || process.env.AUTH_SECRET || "");
}

export function isTestEnv() {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

export function hmacSecret(kind: SecretKind): string {
  const raw = readRaw(kind).trim();
  if (raw && !FORBIDDEN.has(raw)) return raw;
  if (isTestEnv()) return `vitest-${kind}-secret-do-not-use-in-production`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      kind === "privacy"
        ? "PRIVACY_SIGNING_SECRET or AUTH_SECRET must be set in production"
        : "SESSION_SECRET or AUTH_SECRET must be set in production"
    );
  }
  let generated = ephemeral.get(kind);
  if (!generated) {
    generated = randomBytes(32).toString("hex");
    ephemeral.set(kind, generated);
    console.warn(`[security] ${kind} secret is missing; using an ephemeral process secret. Set SESSION_SECRET.`);
  }
  return generated;
}

export function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "").trim();
}

export function googleClientSecret() {
  return String(process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "").trim();
}

export function assertProductionSecrets() {
  hmacSecret("session");
  hmacSecret("privacy");
  return true;
}
