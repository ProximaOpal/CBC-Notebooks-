import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, appendFile, statSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import {
  createUserStore,
  verifyGoogleIdToken,
  revokeGoogleToken,
  googleClientId,
  publicProfile,
  readSignedSessionId,
  sessionCookie,
  clearSessionCookie,
  isAllowedOrigin,
} from "./lib/google-session.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const pub = join(root, "src");
const dataDir = join(root, ".data");
const eventsFile = join(dataDir, "events.jsonl");
const privacyFile = join(dataDir, "privacy-store.json");
const PORT = Number(process.env.PORT || 8080);
const userStore = createUserStore(dataDir);

function loadEnv() {
  [".env.local", ".env"].forEach((name) => {
    const file = join(root, name);
    if (!existsSync(file)) return;
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx < 1) return;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    });
  });
}
loadEnv();
const PII_KEYS = new Set([
  "email", "name", "firstname", "lastname", "phone", "mobile", "msisdn",
  "nationalid", "idnumber", "address", "password", "token", "ip", "ipaddress",
  "clientip", "xforwardedfor", "useragent", "cookie",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "text/plain") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function secret() {
  const raw = String(process.env.PRIVACY_SIGNING_SECRET || process.env.AUTH_SECRET || process.env.SESSION_SECRET || "").trim();
  if (raw && raw !== "cbc-notebooks-odpc") return raw;
  if (process.env.NODE_ENV === "test") return "vitest-privacy-secret-do-not-use-in-production";
  if (process.env.NODE_ENV === "production") {
    throw new Error("PRIVACY_SIGNING_SECRET or AUTH_SECRET must be set in production");
  }
  if (!secret.ephemeral) {
    secret.ephemeral = randomBytes(32).toString("hex");
    console.warn("[security] PRIVACY_SIGNING_SECRET is missing; using an ephemeral process secret.");
  }
  return secret.ephemeral;
}
secret.ephemeral = "";

function hashIdentifier(value) {
  return createHash("sha256").update(`${secret()}:${String(value).trim().toLowerCase()}`).digest("hex");
}

function signPrivacyToken(subject, type) {
  return createHmac("sha256", secret()).update(`${type}:${String(subject).trim().toLowerCase()}`).digest("hex");
}

function verifyPrivacyToken(subject, type, token) {
  const expected = Buffer.from(signPrivacyToken(subject, type));
  const given = Buffer.from(String(token || ""));
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

function loadPrivacyStore() {
  try {
    return JSON.parse(readFileSync(privacyFile, "utf8"));
  } catch {
    return { subjects: {}, requests: [] };
  }
}

function savePrivacyStore(store) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(privacyFile, JSON.stringify(store, null, 2));
}

function anonymizeIp(ip) {
  if (!ip) return null;
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.0.0`;
  }
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::`;
  return hashIdentifier(ip).slice(0, 16);
}

function stripPii(event, req) {
  const clean = {};
  Object.entries(event).forEach(([key, value]) => {
    if (PII_KEYS.has(key.toLowerCase())) return;
    clean[key] = value;
  });
  const forwarded = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "");
  const ip = anonymizeIp(forwarded.split(",")[0].trim());
  if (ip) clean.network_prefix = ip;
  return clean;
}

async function handleTelemetry(req, res) {
  try {
    const raw = (await readBody(req)) || "{}";
    const event = JSON.parse(raw);
    const clean = stripPii(event, req);
    mkdirSync(dataDir, { recursive: true });
    appendFile(eventsFile, JSON.stringify(clean) + "\n", () => {});
    send(res, 204, "");
  } catch {
    send(res, 400, "invalid json");
  }
}

function c2bAccept() {
  return { ResultCode: "0", ResultDesc: "Accepted" };
}

function c2bReject(reason) {
  return { ResultCode: "C2B00016", ResultDesc: reason };
}

function c2bWebhookOk(req) {
  const expected = String(process.env.MPESA_C2B_WEBHOOK_SECRET || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const given = String(req.headers["x-mpesa-webhook-token"] || url.searchParams.get("token") || "");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function handleC2bValidation(req, res) {
  if (!c2bWebhookOk(req)) return sendJson(res, 403, c2bReject("Unauthorized"));
  const body = JSON.parse((await readBody(req)) || "{}");
  const amount = Number(body.TransAmount || 0);
  const billRef = String(body.BillRefNumber || "").trim();
  const transId = String(body.TransID || "").trim();
  if (!transId) return sendJson(res, 200, c2bReject("Missing TransID"));
  if (!Number.isFinite(amount) || amount <= 0) return sendJson(res, 200, c2bReject("Invalid amount"));
  if (!billRef) return sendJson(res, 200, c2bReject("Missing account reference"));
  sendJson(res, 200, c2bAccept());
}

async function handleC2bConfirmation(req, res) {
  if (!c2bWebhookOk(req)) return sendJson(res, 403, c2bReject("Unauthorized"));
  const body = JSON.parse((await readBody(req)) || "{}");
  if (!body.TransID || !body.BillRefNumber || !body.TransAmount) {
    return sendJson(res, 200, c2bReject("Malformed C2B payload"));
  }
  mkdirSync(dataDir, { recursive: true });
  appendFile(join(dataDir, "c2b.jsonl"), JSON.stringify({
    transId: body.TransID,
    amount: body.TransAmount,
    billRef: body.BillRefNumber,
    at: new Date().toISOString(),
  }) + "\n", () => {});
  sendJson(res, 200, c2bAccept());
}

async function handlePrivacyExport(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  const email = String(body.email || "").trim().toLowerCase();
  if (!email.includes("@") || !email.includes(".")) return sendJson(res, 400, { error: "Invalid email" });
  if (!String(body.token || "").trim()) return sendJson(res, 400, { error: "token required" });
  if (!verifyPrivacyToken(email, "export", body.token)) {
    return sendJson(res, 403, { error: "verification token invalid" });
  }
  const store = loadPrivacyStore();
  const request = {
    id: randomBytes(12).toString("hex"),
    type: "export",
    subjectHash: hashIdentifier(email),
    status: "fulfilled",
    createdAt: new Date().toISOString(),
    fulfilledAt: new Date().toISOString(),
    lawfulBasis: "Kenya Data Protection Act 2019 ss.26-28",
  };
  store.requests.push(request);
  savePrivacyStore(store);
  sendJson(res, 200, {
    request,
    data: {
      controller: "CBC Notebooks",
      contact: "privacy@cbcnotebooks.co.ke",
      odpc: "Office of the Data Protection Commissioner, Kenya",
      generated_at: new Date().toISOString(),
      subject_hash: request.subjectHash,
      records: store.subjects[request.subjectHash] || {
        notice: "No account profile stored for this identifier. Telemetry is stored without personal identifiers.",
      },
    },
  });
}

async function handlePrivacyDelete(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  const email = String(body.email || "").trim().toLowerCase();
  if (!email.includes("@") || !email.includes(".")) return sendJson(res, 400, { error: "Invalid email" });
  if (!String(body.token || "").trim()) return sendJson(res, 400, { error: "token required" });
  if (!verifyPrivacyToken(email, "delete", body.token)) {
    return sendJson(res, 403, { error: "verification token invalid" });
  }
  const store = loadPrivacyStore();
  const hash = hashIdentifier(email);
  delete store.subjects[hash];
  const request = {
    id: randomBytes(12).toString("hex"),
    type: "delete",
    subjectHash: hash,
    status: "fulfilled",
    createdAt: new Date().toISOString(),
    fulfilledAt: new Date().toISOString(),
    lawfulBasis: "Kenya Data Protection Act 2019 ss.26-28",
  };
  store.requests.push(request);
  savePrivacyStore(store);
  sendJson(res, 200, { ok: true, request });
}

async function handleCredentialsLogin(req, res) {
  const origin = String(req.headers.origin || "");
  if (!isAllowedOrigin(origin, req.headers.host)) {
    sendJson(res, 403, { error: "Invalid origin" });
    return;
  }
  const body = JSON.parse((await readBody(req)) || "{}");
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || password.length < 8) {
    sendJson(res, 400, { error: "Invalid credentials" });
    return;
  }
  const user = userStore.findByEmail(email);
  if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    sendJson(res, 401, { error: "Invalid credentials" });
    return;
  }
  const fresh = userStore.touchLogin(user);
  const session = userStore.createSession(fresh);
  res.setHeader("Set-Cookie", sessionCookie(session.id, session.exp, isSecureReq(req)));
  sendJson(res, 200, { ok: true, user: publicProfile(fresh) });
}

async function handleCredentialsRegister(req, res) {
  const origin = String(req.headers.origin || "");
  if (!isAllowedOrigin(origin, req.headers.host)) {
    sendJson(res, 403, { error: "Invalid origin" });
    return;
  }
  const body = JSON.parse((await readBody(req)) || "{}");
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (name.length < 2 || !email.includes("@") || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    sendJson(res, 400, { error: "Check the form and try again" });
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = userStore.registerCredentials({ name, email, passwordHash });
    const session = userStore.createSession(user);
    res.setHeader("Set-Cookie", sessionCookie(session.id, session.exp, isSecureReq(req)));
    sendJson(res, 201, { ok: true, user: publicProfile(user) });
  } catch (error) {
    if (error?.name === "DuplicateEmailError") {
      sendJson(res, 409, { error: "Email already exists" });
      return;
    }
    sendJson(res, 500, { error: "Unable to register" });
  }
}

function isSecureReq(req) {
  return Boolean(req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production");
}

function requireUser(req, res) {
  const sessionId = readSignedSessionId(req.headers.cookie);
  const current = userStore.readSession(sessionId);
  if (!current) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }
  return current;
}

async function handleGoogleConfig(_req, res) {
  sendJson(res, 200, {
    client_id: googleClientId(),
    callback_url: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
    scopes: ["openid", "email", "profile"],
  });
}

async function handleGoogleCallback(req, res) {
  const origin = String(req.headers.origin || "");
  if (!isAllowedOrigin(origin, req.headers.host)) {
    sendJson(res, 403, { error: "Invalid origin" });
    return;
  }
  const body = JSON.parse((await readBody(req)) || "{}");
  const credential = String(body.credential || "");
  if (!credential) {
    sendJson(res, 400, { error: "Missing Google credential" });
    return;
  }
  try {
    const payload = await verifyGoogleIdToken(credential, googleClientId());
    const user = userStore.upsertGoogleUser(payload, credential);
    const session = userStore.createSession(user, credential);
    res.setHeader("Set-Cookie", sessionCookie(session.id, session.exp, isSecureReq(req)));
    sendJson(res, 200, { ok: true, user: publicProfile(user) });
  } catch (error) {
    sendJson(res, 401, { error: error instanceof Error ? error.message : "Google authentication failed" });
  }
}

function handleProfile(req, res) {
  const current = requireUser(req, res);
  if (!current) return;
  sendJson(res, 200, publicProfile(current.user));
}

async function handleLogout(req, res) {
  const sessionId = readSignedSessionId(req.headers.cookie);
  const removed = userStore.destroySession(sessionId);
  if (removed?.id_token) await revokeGoogleToken(removed.id_token);
  res.setHeader("Set-Cookie", clearSessionCookie(isSecureReq(req)));
  sendJson(res, 200, { ok: true, revoked: Boolean(removed?.id_token) });
}

function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://127.0.0.1`);
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const abs = normalize(join(pub, decodeURIComponent(file)));
  if (!abs.startsWith(pub)) {
    send(res, 403, "forbidden");
    return;
  }
  if (!existsSync(abs) || statSync(abs).isDirectory()) {
    send(res, 404, "not found");
    return;
  }
  const type = MIME[extname(abs)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(abs).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1`);
  const path = url.pathname;
  if (req.method === "POST" && path.startsWith("/api/telemetry")) {
    handleTelemetry(req, res);
    return;
  }
  if (req.method === "GET" && (path === "/api/auth/google" || path === "/auth/google")) {
    handleGoogleConfig(req, res);
    return;
  }
  if (req.method === "POST" && (path === "/api/auth/google/callback" || path === "/auth/google/callback")) {
    handleGoogleCallback(req, res).catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "POST" && (path === "/api/auth/login" || path === "/auth/login")) {
    handleCredentialsLogin(req, res).catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "POST" && (path === "/api/auth/register" || path === "/auth/register")) {
    handleCredentialsRegister(req, res).catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "GET" && (path === "/api/user/profile" || path === "/user/profile")) {
    handleProfile(req, res);
    return;
  }
  if (req.method === "POST" && (path === "/api/auth/logout" || path === "/auth/logout")) {
    handleLogout(req, res).catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "POST" && path === "/api/payments/mpesa/c2b-validation") {
    handleC2bValidation(req, res).catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "POST" && path === "/api/payments/mpesa/c2b-confirmation") {
    handleC2bConfirmation(req, res).catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "POST" && path === "/api/privacy/export") {
    handlePrivacyExport(req, res).catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "POST" && path === "/api/privacy/delete") {
    handlePrivacyDelete(req, res).catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }
  send(res, 405, "method not allowed");
});

server.listen(PORT, () => {
  console.log("CBC Notebooks → http://localhost:" + PORT);
});
