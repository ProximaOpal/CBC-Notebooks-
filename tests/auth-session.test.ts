import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createSessionRecord,
  destroySessionRecord,
  parseSignedSessionCookie,
  readSessionRecord,
  signSessionId,
} from "@/lib/auth/session-store";
import { hmacSecret } from "@/lib/security/secrets";
import { useTempDataDir } from "./helpers";

useTempDataDir();

describe("Domain B auth/session", () => {
  it("rejects HMAC cookie tampering", () => {
    const { id } = createSessionRecord("user-42");
    const good = `${id}.${signSessionId(id)}`;
    expect(parseSignedSessionCookie(good)).toBe(id);
    expect(parseSignedSessionCookie(`${id}.aaaa`)).toBe("");
    expect(parseSignedSessionCookie("not-a-cookie")).toBe("");
  });

  it("does not keep a raw Google ID token in the session record", () => {
    const token = "ya29.raw-google-id-token-value";
    const { id } = createSessionRecord("user-42", token);
    const row = readSessionRecord(id);
    expect(row?.idToken).toBe(token);
    const onDisk = readFileSync(join(process.env.DATA_DIR as string, "gis-sessions.json"), "utf8");
    expect(onDisk).not.toContain("ya29.raw-google-id-token-value");
  });

  it("logout destroys the persisted session", () => {
    const { id } = createSessionRecord("user-42", "id-token");
    const removed = destroySessionRecord(id);
    expect(removed?.userId).toBe("user-42");
    expect(readSessionRecord(id)).toBeNull();
  });

  it("refuses well-known HMAC fallbacks outside test/production misconfig", () => {
    expect(hmacSecret("session")).toContain("test-session-secret");
    const previous = process.env.NODE_ENV;
    const session = process.env.SESSION_SECRET;
    const auth = process.env.AUTH_SECRET;
    const vitest = process.env.VITEST;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.VITEST;
      delete process.env.SESSION_SECRET;
      delete process.env.AUTH_SECRET;
      expect(() => hmacSecret("session")).toThrow(/SESSION_SECRET/);
    } finally {
      process.env.NODE_ENV = previous;
      process.env.SESSION_SECRET = session;
      process.env.AUTH_SECRET = auth;
      if (vitest) process.env.VITEST = vitest;
    }
  });
});
