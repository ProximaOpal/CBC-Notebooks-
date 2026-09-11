import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import {
  ASK_AI_FREE,
  ASK_AI_SKU,
  ASK_AI_TTL_MS,
  CONTENT_SKUS,
  getSku,
  verifyClientTotal,
} from "../../src/assets/js/data/payments.js";
import { SUBJECTS } from "../../src/assets/js/data/subjects.js";
import { initiateStkPush, parseStkCallback } from "./daraja.mjs";
import { dataDir, loadJson, saveJson } from "./fs-json.mjs";

function nowIso() {
  return new Date().toISOString();
}

function toMsisdn(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  throw new Error("Enter a valid Kenyan mobile number (2547/2541)");
}

function emptyTx() {
  return { byId: {}, byReference: {}, byProviderRef: {} };
}

function readTx() {
  return loadJson("transactions.json", emptyTx());
}

function writeTx(store) {
  saveJson("transactions.json", store);
}

function entitlements() {
  return loadJson("entitlements.json", {});
}

function saveEntitlements(rows) {
  saveJson("entitlements.json", rows);
}

function aiStore() {
  return loadJson("user_ai_queries.json", {});
}

function saveAi(store) {
  saveJson("user_ai_queries.json", store);
}

function publicTransaction(tx) {
  return {
    id: tx.id,
    reference_id: tx.reference_id,
    provider: tx.provider,
    provider_reference: tx.provider_reference,
    mpesa_receipt_number: tx.mpesa_receipt_number,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    metadata: tx.metadata,
    failure_reason: tx.failure_reason,
    created_at: tx.created_at,
    updated_at: tx.updated_at,
  };
}

function lineSkusFromTx(tx) {
  if (Array.isArray(tx.metadata?.items) && tx.metadata.items.length) return tx.metadata.items.map(String);
  const single = String(tx.metadata?.item || tx.metadata?.sku || "");
  return single ? [single] : [];
}

export function grantPaid(tx, extras = {}) {
  if (tx.status === "FAILED" || tx.status === "TIMED_OUT") return tx;
  const store = readTx();
  const current = store.byId[tx.id];
  if (!current) return tx;
  if (current.status === "SUCCESS") {
    return { ...current, ...extras };
  }
  const next = {
    ...current,
    ...extras,
    status: "SUCCESS",
    updated_at: nowIso(),
  };
  store.byId[tx.id] = next;
  writeTx(store);
  const rows = entitlements();
  for (const raw of lineSkusFromTx(next)) {
    const sku = getSku(raw)?.sku || raw;
    const ttl = sku === ASK_AI_SKU || getSku(sku)?.ttlHours ? ASK_AI_TTL_MS : 0;
    rows[`${next.user_id}:${sku}`] = {
      user_id: next.user_id,
      item: sku,
      sku,
      released_at: nowIso(),
      expires_at: ttl ? new Date(Date.now() + ttl).toISOString() : null,
      transaction_id: next.id,
    };
  }
  saveEntitlements(rows);
  return next;
}

export function hasEntitlement(userId, item) {
  const sku = getSku(item)?.sku || String(item || "");
  const row = entitlements()[`${userId}:${sku}`];
  if (!row) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return false;
  return true;
}

export function hasKindAccess(userId, kind) {
  const skus = CONTENT_SKUS[kind] || [kind];
  return skus.some((sku) => hasEntitlement(userId, sku));
}

export function applyStkCallback(callback) {
  const parsed = parseStkCallback(callback || {});
  const store = readTx();
  const id = store.byProviderRef[parsed.checkoutRequestId];
  const tx = id ? store.byId[id] : null;
  if (!tx) return parsed;
  if (parsed.resultCode === "0") {
    grantPaid(tx, { mpesa_receipt_number: parsed.receipt || null });
  } else {
    const status = parsed.resultCode === "1037" ? "TIMED_OUT" : "FAILED";
    store.byId[tx.id] = {
      ...tx,
      status,
      failure_reason: parsed.resultDesc,
      updated_at: nowIso(),
    };
    writeTx(store);
  }
  return parsed;
}

export async function handleInitiate(user, body) {
  const codes = Array.isArray(body.items) && body.items.length
    ? body.items
    : [body.sku, body.metadata?.sku, body.metadata?.item].filter(Boolean);
  let quote;
  try {
    quote = verifyClientTotal(codes, body.totalAmount ?? body.amount);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid cart", status: 400 };
  }
  const lines = quote.lines.map((line) => line.sku);
  const created = nowIso();
  const tx = {
    id: randomUUID(),
    user_id: user.id,
    reference_id: randomUUID(),
    provider: "MPESA",
    provider_reference: null,
    mpesa_receipt_number: null,
    amount: quote.totalAmount,
    currency: "KES",
    status: "PENDING",
    metadata: {
      ...(body.metadata || {}),
      sku: lines.join("+"),
      item: lines[0],
      items: lines,
      catalog_total: quote.totalAmount,
      phone: body.phone,
    },
    failure_reason: null,
    created_at: created,
    updated_at: created,
  };
  const store = readTx();
  store.byId[tx.id] = tx;
  store.byReference[tx.reference_id] = tx.id;
  writeTx(store);
  if (!body.phone) {
    store.byId[tx.id] = { ...tx, status: "FAILED", failure_reason: "M-Pesa requires a Kenyan phone number", updated_at: nowIso() };
    writeTx(store);
    return { error: "M-Pesa requires a Kenyan phone number", status: 400 };
  }
  const msisdn = toMsisdn(body.phone);
  const stk = await initiateStkPush(msisdn, quote.totalAmount, tx.reference_id, body.description || quote.lines.map((l) => l.label).join(", "));
  const next = {
    ...tx,
    provider_reference: stk.CheckoutRequestID,
    updated_at: nowIso(),
  };
  store.byId[tx.id] = next;
  store.byProviderRef[stk.CheckoutRequestID] = tx.id;
  writeTx(store);
  return {
    ok: true,
    method: "MPESA",
    transaction: publicTransaction(next),
    checkout_request_id: stk.CheckoutRequestID,
    customer_message: stk.CustomerMessage,
    quote: { lines: quote.lines, totalAmount: quote.totalAmount, currency: quote.currency },
  };
}

export function handleStatus(user, referenceId) {
  const store = readTx();
  const id = store.byReference[referenceId] || store.byProviderRef[referenceId];
  const tx = id ? store.byId[id] : null;
  if (!tx || tx.user_id !== user.id) return { error: "Transaction not found", status: 404 };
  return { transaction: publicTransaction(tx) };
}

export function handleAskAi(user, query) {
  const q = String(query || "").trim();
  if (!q) return { error: "Question is required", status: 400 };
  const ledger = aiStore();
  const used = ledger[user.id]?.count || 0;
  const allowed = used < ASK_AI_FREE || hasEntitlement(user.id, ASK_AI_SKU);
  if (!allowed) {
    return {
      error: "Ask AI day pass required",
      code: "ASK_AI_PAYWALL",
      sku: ASK_AI_SKU,
      amount: 100,
      currency: "KES",
      free_used: ASK_AI_FREE,
      status: 402,
    };
  }
  ledger[user.id] = { count: used + 1, updated_at: nowIso() };
  saveAi(ledger);
  const needle = q.toLowerCase();
  const results = SUBJECTS.filter((sub) =>
    (sub.name + " " + sub.topics.map((t) => t.name + " " + t.detail).join(" ")).toLowerCase().includes(needle)
  )
    .slice(0, 8)
    .map((sub) => ({
      id: sub.id,
      name: sub.name,
      level: sub.level,
      topics: sub.topics.slice(0, 4).map((t) => t.name),
    }));
  return {
    ok: true,
    quota: { remaining: Math.max(0, ASK_AI_FREE - (used + 1)), reason: used < ASK_AI_FREE ? "free" : "day_pass" },
    query: q,
    results,
  };
}

export function handleContent(user, kind, id) {
  if (!hasKindAccess(user.id, kind)) {
    return { error: "Payment required", code: "PAYMENT_REQUIRED", kind, status: 402 };
  }
  const root = process.env.CONTENT_ROOT || join(dataDir(), "private-content");
  const safeKind = String(kind || "").replace(/[^a-z0-9-]/gi, "");
  const safeId = String(id || "").replace(/[^a-z0-9._-]/gi, "");
  const candidates = [
    join(root, safeKind, safeId),
    join(root, safeKind, `${safeId}.pdf`),
    join(root, safeKind, `${safeId}.mp3`),
    join(root, safeKind, `${safeId}.mp4`),
  ];
  for (const file of candidates) {
    const abs = normalize(file);
    if (!abs.startsWith(normalize(root))) continue;
    if (existsSync(abs) && statSync(abs).isFile()) {
      return { file: abs, type: extname(abs), bytes: readFileSync(abs) };
    }
  }
  return { entitled: true, kind: safeKind, id: safeId, viewer: "canvas", downloadable: false };
}

export function handleEntitlements(user) {
  const used = aiStore()[user.id]?.count || 0;
  const rows = Object.values(entitlements()).filter(
    (row) => row.user_id === user.id && (!row.expires_at || Date.parse(row.expires_at) > Date.now())
  );
  return {
    entitlements: rows,
    ask_ai: {
      allowed: used < ASK_AI_FREE || hasEntitlement(user.id, ASK_AI_SKU),
      remaining: Math.max(0, ASK_AI_FREE - used),
      used,
    },
  };
}
