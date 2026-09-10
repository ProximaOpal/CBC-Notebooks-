import { createCipheriv, createDecipheriv, createHash, createHmac, createPublicKey, createVerify, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const COOKIE = "cbc_session";
const SESSION_DAYS = 7;

export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "";
}

export function googleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "";
}

export function sessionSecret() {
  const raw = String(process.env.SESSION_SECRET || process.env.AUTH_SECRET || "").trim();
  if (raw && raw !== "cbc-notebooks-session") return raw;
  if (process.env.NODE_ENV === "test") return "vitest-session-secret-do-not-use-in-production";
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET or AUTH_SECRET must be set in production");
  }
  if (!sessionSecret.ephemeral) {
    sessionSecret.ephemeral = randomBytes(32).toString("hex");
    console.warn("[security] SESSION_SECRET is missing; using an ephemeral process secret.");
  }
  return sessionSecret.ephemeral;
}
sessionSecret.ephemeral = "";

function aesKey() {
  return createHash("sha256").update(sessionSecret()).digest();
}

function sealSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function openSealed(payload) {
  try {
    const buf = Buffer.from(String(payload || ""), "base64url");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function b64urlToBuf(value) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(value) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function hiResPicture(url) {
  if (!url) return "";
  return url.replace(/=s\d+-c/, "=s256-c").replace(/sz=\d+/, "sz=256");
}

export function publicProfile(user) {
  if (!user) return null;
  return {
    id: user.id,
    google_id: user.google_id,
    email: user.email,
    email_verified: Boolean(user.email_verified),
    full_name: user.full_name,
    given_name: user.given_name,
    family_name: user.family_name,
    picture_url: user.picture_url,
    locale: user.locale,
    auth_provider: user.auth_provider,
    last_login_at: user.last_login_at,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function createUserStore(dataDir) {
  const usersFile = join(dataDir, "users.json");
  const sessionsFile = join(dataDir, "sessions.json");

  function load(file, fallback) {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return fallback;
    }
  }

  function save(file, value) {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(file, JSON.stringify(value, null, 2));
  }

  function users() {
    return load(usersFile, {});
  }

  function sessions() {
    return load(sessionsFile, {});
  }

  function upsertGoogleUser(payload, idToken) {
    const now = new Date().toISOString();
    const all = users();
    const googleId = String(payload.sub);
    const existing = Object.values(all).find((row) => row.google_id === googleId);
    const id = existing?.id || crypto.randomUUID();
    const given = payload.given_name || "";
    const family = payload.family_name || "";
    const fullName = payload.name || [given, family].filter(Boolean).join(" ").trim();
    const row = {
      id,
      google_id: googleId,
      email: payload.email || "",
      email_verified: Boolean(payload.email_verified),
      full_name: fullName,
      given_name: given,
      family_name: family,
      picture_url: hiResPicture(payload.picture || ""),
      locale: payload.locale || "",
      auth_provider: "GOOGLE",
      last_login_at: now,
      created_at: existing?.created_at || now,
      updated_at: now,
      google_id_token_hash: createHash("sha256").update(idToken).digest("hex"),
    };
    all[id] = row;
    save(usersFile, all);
    return row;
  }

  function createSession(user, idToken) {
    const all = sessions();
    const id = randomBytes(24).toString("hex");
    const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    all[id] = {
      id,
      user_id: user.id,
      exp,
      id_token_enc: idToken ? sealSecret(idToken) : undefined,
      created_at: new Date().toISOString(),
    };
    save(sessionsFile, all);
    return { id, exp };
  }

  function sessionToken(row) {
    if (!row) return null;
    if (row.id_token_enc) return openSealed(row.id_token_enc);
    return row.id_token || null;
  }

  function readSession(id) {
    if (!id) return null;
    const row = sessions()[id];
    if (!row || row.exp < Date.now()) return null;
    const user = users()[row.user_id];
    if (!user) return null;
    return { session: row, user, id_token: sessionToken(row) };
  }

  function destroySession(id) {
    const all = sessions();
    const row = all[id];
    delete all[id];
    save(sessionsFile, all);
    return row ? { ...row, id_token: sessionToken(row) } : null;
  }

  function findByEmail(email) {
    const needle = String(email || "").trim().toLowerCase();
    return Object.values(users()).find((row) => row.email === needle) || null;
  }

  function registerCredentials(input) {
    const email = String(input.email || "").trim().toLowerCase();
    if (findByEmail(email)) {
      const error = new Error("Email already exists");
      error.name = "DuplicateEmailError";
      throw error;
    }
    const now = new Date().toISOString();
    const all = users();
    const row = {
      id: crypto.randomUUID(),
      email,
      name: String(input.name || "").trim(),
      full_name: String(input.name || "").trim(),
      password_hash: input.passwordHash,
      auth_provider: "credentials",
      created_at: now,
      updated_at: now,
      last_login_at: now,
    };
    all[row.id] = row;
    save(usersFile, all);
    return row;
  }

  function touchLogin(user) {
    const all = users();
    if (!all[user.id]) return user;
    all[user.id] = { ...all[user.id], last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    save(usersFile, all);
    return all[user.id];
  }

  function getUser(id) {
    return users()[id] || null;
  }

  return { upsertGoogleUser, createSession, readSession, destroySession, getUser, findByEmail, registerCredentials, touchLogin };
}

export async function verifyGoogleIdToken(idToken, audience) {
  if (!idToken || idToken.split(".").length !== 3) throw new Error("Invalid ID token");
  if (!audience) throw new Error("GOOGLE_CLIENT_ID is not configured");

  try {
    const { OAuth2Client } = await import("google-auth-library");
    const client = new OAuth2Client(audience);
    const ticket = await client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error("Token payload missing sub");
    return payload;
  } catch (error) {
    const msg = String(error?.message || error);
    if (/Cannot find package|MODULE_NOT_FOUND/.test(msg)) {
      return verifyWithJwks(idToken, audience);
    }
    throw error;
  }
}

async function verifyWithJwks(idToken, audience) {
  const [h, p, s] = idToken.split(".");
  const header = JSON.parse(b64urlToBuf(h).toString("utf8"));
  const payload = JSON.parse(b64urlToBuf(p).toString("utf8"));
  const certs = await fetch(GOOGLE_CERTS).then((res) => {
    if (!res.ok) throw new Error("Unable to fetch Google signing certs");
    return res.json();
  });
  const jwk = (certs.keys || []).find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Unknown Google token key");
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${h}.${p}`);
  if (!verifier.verify(key, b64urlToBuf(s))) throw new Error("Invalid Google token signature");
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) < now) throw new Error("Google token expired");
  if (payload.aud !== audience) throw new Error("Google token audience mismatch");
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new Error("Google token issuer mismatch");
  return payload;
}

export async function revokeGoogleToken(token) {
  if (!token) return { revoked: false };
  const res = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return { revoked: res.status === 200, status: res.status };
}

export function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const idx = part.indexOf("=");
      if (idx < 1) return;
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    });
  return out;
}

export function readSignedSessionId(cookieHeader) {
  const raw = parseCookies(cookieHeader)[COOKIE];
  if (!raw || !raw.includes(".")) return "";
  const idx = raw.lastIndexOf(".");
  const id = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  if (!safeEqual(sign(id), mac)) return "";
  return id;
}

export function sessionCookie(sessionId, exp, secure) {
  const value = `${sessionId}.${sign(sessionId)}`;
  const maxAge = Math.max(0, Math.floor((exp - Date.now()) / 1000));
  const parts = [
    `${COOKIE}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure) {
  const parts = [`${COOKIE}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function isAllowedOrigin(origin, host) {
  if (!origin) return true;
  const allowed = [
    process.env.AUTH_URL,
    process.env.GOOGLE_CALLBACK_URL,
    host ? `http://${host}` : "",
    host ? `https://${host}` : "",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:3000",
  ].filter(Boolean);
  return allowed.some((item) => origin === item || origin.startsWith(item.replace(/\/$/, "")));
}
