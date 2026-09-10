import { loadJson, saveJson } from "@/lib/persist/json-store";
import { markStatus, type Transaction } from "./transactions";
import { isTerminal } from "./locking";

const FILE = "entitlements.json";

type Entitlement = { user_id: string; item: string; released_at: string };

function all(): Record<string, Entitlement> {
  return loadJson<Record<string, Entitlement>>(FILE, {});
}

export function releaseEntitlement(tx: Transaction) {
  const item = String(tx.metadata.item || tx.metadata.resource_type || tx.reference_id);
  const record: Entitlement = {
    user_id: tx.user_id,
    item,
    released_at: new Date().toISOString(),
  };
  const rows = all();
  rows[`${tx.user_id}:${item}`] = record;
  saveJson(FILE, rows);
  console.info("[payments] entitlement released", record);
  return record;
}

export function hasEntitlement(userId: string, item: string) {
  return Boolean(all()[`${userId}:${item}`]);
}

export function applySuccess(tx: Transaction, extras: Partial<Transaction> = {}) {
  if (isTerminal(tx.status) && tx.status !== "SUCCESS") return tx;
  const next = markStatus({ id: tx.id }, "SUCCESS", extras);
  if (next && next.status === "SUCCESS") releaseEntitlement(next);
  return next;
}
