/**
 * Production host: static dist + Safaricom Daraja STK/C2B callbacks.
 * Render start command: node scripts/serve.mjs
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, appendFile, statSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createUserStore, readSignedSessionId } from "./lib/google-session.mjs";
import {
  applyStkCallback,
  handleAskAi,
  handleContent,
  handleEntitlements,
  handleInitiate,
  handleStatus,
} from "./lib/commerce-http.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const dist = join(root, "dist");
const pub = existsSync(join(dist, "index.html")) ? dist : join(root, "src");
const dataDir = join(root, ".data");
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

function requireUser(req, res) {
  const sessionId = readSignedSessionId(req.headers.cookie);
  const current = userStore.readSession(sessionId);
  if (!current) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }
  return current;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
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

function callbackIpOk(req) {
  const allow = String(process.env.MPESA_CALLBACK_IPS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allow.length) return true;
  const forwarded = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "");
  const ip = forwarded.split(",")[0]?.trim() || "";
  return Boolean(ip) && allow.includes(ip);
}

async function handleStkCallback(req, res) {
  if (!callbackIpOk(req)) {
    return sendJson(res, 403, { ResultCode: 1, ResultDesc: "Forbidden" });
  }
  const body = JSON.parse((await readBody(req)) || "{}");
  const callback = body?.Body?.stkCallback;
  if (!callback) {
    return sendJson(res, 400, { ResultCode: 1, ResultDesc: "Missing stkCallback" });
  }
  mkdirSync(dataDir, { recursive: true });
  appendFile(
    join(dataDir, "stk-callbacks.jsonl"),
    JSON.stringify({
      checkoutRequestId: callback.CheckoutRequestID,
      merchantRequestId: callback.MerchantRequestID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
      at: new Date().toISOString(),
    }) + "\n",
    () => {}
  );
  if (String(callback.ResultCode) === "0") {
    applyStkCallback(callback);
  } else {
    applyStkCallback(callback);
  }
  sendJson(res, 200, { ResultCode: 0, ResultDesc: "Accepted" });
}

function c2bAccept() {
  return { ResultCode: "0", ResultDesc: "Accepted" };
}

function c2bReject(reason) {
  return { ResultCode: "C2B00016", ResultDesc: reason };
}

async function handleC2bValidation(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  if (!body.TransID || !body.BillRefNumber || !body.TransAmount) {
    return sendJson(res, 200, c2bReject("Malformed C2B payload"));
  }
  sendJson(res, 200, c2bAccept());
}

async function handleC2bConfirmation(req, res) {
  const body = JSON.parse((await readBody(req)) || "{}");
  if (!body.TransID || !body.BillRefNumber || !body.TransAmount) {
    return sendJson(res, 200, c2bReject("Malformed C2B payload"));
  }
  mkdirSync(dataDir, { recursive: true });
  appendFile(
    join(dataDir, "c2b.jsonl"),
    JSON.stringify({
      transId: body.TransID,
      amount: body.TransAmount,
      billRef: body.BillRefNumber,
      at: new Date().toISOString(),
    }) + "\n",
    () => {}
  );
  sendJson(res, 200, c2bAccept());
}

function serveStatic(req, res, url) {
  const rawPath = decodeURIComponent(url.pathname);
  const rel = rawPath === "/" ? "/index.html" : rawPath;
  const abs = normalize(join(pub, rel));
  if (!abs.startsWith(pub)) {
    send(res, 403, "forbidden");
    return;
  }
  if (existsSync(abs) && statSync(abs).isFile()) {
    const type = MIME[extname(abs)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    createReadStream(abs).pipe(res);
    return;
  }
  const asIndex = normalize(join(pub, decodeURIComponent(url.pathname), "index.html"));
  if (asIndex.startsWith(pub) && existsSync(asIndex) && statSync(asIndex).isFile()) {
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    createReadStream(asIndex).pipe(res);
    return;
  }
  const fallback = join(pub, "index.html");
  if (existsSync(fallback)) {
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    createReadStream(fallback).pipe(res);
    return;
  }
  send(res, 404, "not found");
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const path = url.pathname;
  if (
    req.method === "POST" &&
    (path === "/api/payments/mpesa/callback" || path === "/api/payments/mpesa/stk-callback")
  ) {
    handleStkCallback(req, res).catch(() => send(res, 400, "invalid json"));
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
  if (req.method === "POST" && path === "/api/payments/initiate") {
    const current = requireUser(req, res);
    if (!current) return;
    readBody(req)
      .then((raw) => handleInitiate({ id: current.user.id, email: current.user.email }, JSON.parse(raw || "{}")))
      .then((out) => sendJson(res, out.status || 200, out))
      .catch((err) => sendJson(res, 502, { error: err instanceof Error ? err.message : "Unable to start payment" }));
    return;
  }
  if (req.method === "GET" && path.startsWith("/api/payments/status/")) {
    const current = requireUser(req, res);
    if (!current) return;
    const referenceId = decodeURIComponent(path.slice("/api/payments/status/".length));
    const out = handleStatus({ id: current.user.id }, referenceId);
    sendJson(res, out.status || 200, out);
    return;
  }
  if (req.method === "POST" && path === "/api/ask-ai") {
    const current = requireUser(req, res);
    if (!current) return;
    readBody(req)
      .then((raw) => {
        const payload = JSON.parse(raw || "{}");
        return handleAskAi({ id: current.user.id }, payload.query || payload.q);
      })
      .then((out) => sendJson(res, out.status || 200, out))
      .catch(() => send(res, 400, "invalid json"));
    return;
  }
  if (req.method === "GET" && path === "/api/entitlements/me") {
    const current = requireUser(req, res);
    if (!current) return;
    sendJson(res, 200, handleEntitlements({ id: current.user.id }));
    return;
  }
  if (req.method === "GET" && path.startsWith("/api/content/")) {
    const current = requireUser(req, res);
    if (!current) return;
    const parts = path.split("/").filter(Boolean);
    const kind = parts[2];
    const id = parts[3];
    const out = handleContent({ id: current.user.id }, kind, id);
    if (out.status) {
      sendJson(res, out.status, out);
      return;
    }
    if (out.bytes) {
      res.writeHead(200, {
        "Content-Type": MIME[out.type] || "application/octet-stream",
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline; filename=\"view\"",
      });
      res.end(out.bytes);
      return;
    }
    sendJson(res, 200, out);
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res, url);
    return;
  }
  send(res, 405, "method not allowed");
});

server.listen(PORT, () => {
  console.log("CBC Notebooks → http://localhost:" + PORT);
});
