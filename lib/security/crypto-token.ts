import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { hmacSecret } from "./secrets";

function key() {
  return createHash("sha256").update(hmacSecret("session")).digest();
}

/** AES-256-GCM seal so Google ID tokens are not stored as plaintext. */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function openSealed(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, "base64url");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
