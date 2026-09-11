import { loadJson, saveJson } from "@/lib/persist/json-store";
import { getSku } from "./catalog";
import { markStatus, type Transaction } from "./transactions";
import { isTerminal } from "./locking";
import { ASK_AI_SKU, ASK_AI_TTL_MS, CONTENT_SKUS } from "../../src/assets/js/data/payments.js";

const FILE = "entitlements.json";

export type Entitlement = {
  user_id: string;
  item: string;
  sku: string;
  released_at: string;
  expires_at: string | null;
  transaction_id?: string;
};

function all(): Record<string, Entitlement> {
  return loadJson<Record<string, Entitlement>>(FILE, {});
}

function write(rows: Record<string, Entitlement>) {
  saveJson(FILE, rows);
}

function keyFor(userId: string, sku: string) {
  return `${userId}:${sku}`;
}

export function entitlementSkusFromTx(tx: Transaction): string[] {
  const items = tx.metadata?.items;
  if (Array.isArray(items) && items.length) return items.map((item) => String(item));
  const single = String(tx.metadata?.item || tx.metadata?.sku || tx.metadata?.resource_type || "");
  return single ? [single] : [];
}

export function releaseEntitlement(tx: Transaction) {
  const rows = all();
  const released: Entitlement[] = [];
  for (const raw of entitlementSkusFromTx(tx)) {
    const sku = getSku(raw)?.sku || raw;
    const catalog = getSku(sku);
    const ttlMs = catalog?.ttlHours ? catalog.ttlHours * 60 * 60 * 1000 : sku === ASK_AI_SKU ? ASK_AI_TTL_MS : 0;
    const record: Entitlement = {
      user_id: tx.user_id,
      item: sku,
      sku,
      released_at: new Date().toISOString(),
      expires_at: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
      transaction_id: tx.id,
    };
    rows[keyFor(tx.user_id, sku)] = record;
    released.push(record);
  }
  write(rows);
  console.info("[payments] entitlement released", released);
  return released;
}

export function hasEntitlement(userId: string, item: string) {
  const sku = getSku(item)?.sku || String(item || "");
  const row = all()[keyFor(userId, sku)];
  if (!row) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return false;
  return true;
}

export function hasAnyEntitlement(userId: string, items: string[]) {
  return items.some((item) => hasEntitlement(userId, item));
}

export function entitlementsForKind(kind: string): string[] {
  return CONTENT_SKUS[kind] || [kind];
}

export function hasKindAccess(userId: string, kind: string) {
  return hasAnyEntitlement(userId, entitlementsForKind(kind));
}

export function listEntitlements(userId: string) {
  return Object.values(all()).filter((row) => row.user_id === userId && (!row.expires_at || Date.parse(row.expires_at) > Date.now()));
}

export function applySuccess(tx: Transaction, extras: Partial<Transaction> = {}) {
  if (isTerminal(tx.status) && tx.status !== "SUCCESS") return tx;
  const next = markStatus({ id: tx.id }, "SUCCESS", extras);
  if (next && next.status === "SUCCESS") releaseEntitlement(next);
  return next;
}
