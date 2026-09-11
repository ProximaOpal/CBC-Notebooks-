import { loadJson, saveJson } from "@/lib/persist/json-store";
import { ASK_AI_FREE, ASK_AI_SKU } from "../../src/assets/js/data/payments.js";
import { hasEntitlement } from "./entitlements";

const FILE = "user_ai_queries.json";

export type AiLedger = {
  count: number;
  updated_at: string;
};

type Store = Record<string, AiLedger>;

function read(): Store {
  return loadJson<Store>(FILE, {});
}

function write(store: Store) {
  saveJson(FILE, store);
}

export function aiUsage(userId: string): AiLedger {
  return read()[userId] || { count: 0, updated_at: new Date(0).toISOString() };
}

export function canAskAi(userId: string) {
  const used = aiUsage(userId).count;
  if (used < ASK_AI_FREE) return { allowed: true as const, remaining: ASK_AI_FREE - used, reason: "free" as const };
  if (hasEntitlement(userId, ASK_AI_SKU)) {
    return { allowed: true as const, remaining: 0, reason: "day_pass" as const };
  }
  return { allowed: false as const, remaining: 0, reason: "paywall" as const };
}

/** Increment only after the request is authorized. */
export function recordAiQuery(userId: string, query: string) {
  const store = read();
  const current = store[userId] || { count: 0, updated_at: new Date(0).toISOString() };
  const next: AiLedger = { count: current.count + 1, updated_at: new Date().toISOString() };
  store[userId] = next;
  write(store);
  return { ...next, query };
}

export function askAiPaywall() {
  return {
    error: "Ask AI day pass required",
    code: "ASK_AI_PAYWALL",
    sku: ASK_AI_SKU,
    amount: 100,
    currency: "KES",
    free_used: ASK_AI_FREE,
  };
}
