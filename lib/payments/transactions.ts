import { randomUUID } from "node:crypto";
import { loadJson, saveJson } from "@/lib/persist/json-store";
import { canTransition } from "./locking";
import type { PaymentMetadata, PaymentProvider, PaymentStatus, Transaction } from "./types";

const FILE = "transactions.json";

type Store = {
  byId: Record<string, Transaction>;
  byReference: Record<string, string>;
  byProviderRef: Record<string, string>;
};

function empty(): Store {
  return { byId: {}, byReference: {}, byProviderRef: {} };
}

function read(): Store {
  return loadJson<Store>(FILE, empty());
}

function write(store: Store) {
  saveJson(FILE, store);
}

function now() {
  return new Date().toISOString();
}

export function createTransaction(input: {
  user_id?: string;
  reference_id?: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  metadata?: PaymentMetadata;
}): Transaction {
  const created = now();
  const tx: Transaction = {
    id: randomUUID(),
    user_id: input.user_id || "anon",
    reference_id: input.reference_id || randomUUID(),
    provider: input.provider,
    provider_reference: null,
    mpesa_receipt_number: null,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    status: "PENDING",
    metadata: input.metadata || {},
    failure_reason: null,
    created_at: created,
    updated_at: created,
  };
  const store = read();
  store.byId[tx.id] = tx;
  store.byReference[tx.reference_id] = tx.id;
  write(store);
  return tx;
}

export function getTransaction(id: string) {
  return read().byId[id] || null;
}

export function getTransactionByReference(referenceId: string) {
  const store = read();
  const id = store.byReference[referenceId];
  return id ? store.byId[id] || null : null;
}

export function getTransactionByProviderReference(providerReference: string) {
  const store = read();
  const id = store.byProviderRef[providerReference];
  return id ? store.byId[id] || null : null;
}

export function updateTransaction(
  id: string,
  patch: Partial<
    Pick<Transaction, "provider_reference" | "mpesa_receipt_number" | "status" | "failure_reason" | "metadata">
  >
): Transaction | null {
  const store = read();
  const current = store.byId[id];
  if (!current) return null;
  if (patch.status && !canTransition(current.status, patch.status)) {
    return current;
  }
  const next: Transaction = {
    ...current,
    ...patch,
    metadata: patch.metadata ? { ...current.metadata, ...patch.metadata } : current.metadata,
    updated_at: now(),
  };
  store.byId[id] = next;
  if (next.provider_reference) store.byProviderRef[next.provider_reference] = id;
  store.byReference[next.reference_id] = id;
  write(store);
  return next;
}

export function markStatus(
  lookup: { id?: string; reference_id?: string; provider_reference?: string },
  status: PaymentStatus,
  extras: Partial<Transaction> = {}
) {
  const tx =
    (lookup.id && getTransaction(lookup.id)) ||
    (lookup.reference_id && getTransactionByReference(lookup.reference_id)) ||
    (lookup.provider_reference && getTransactionByProviderReference(lookup.provider_reference));
  if (!tx) return null;
  return updateTransaction(tx.id, { status, ...extras });
}

export function listTransactions() {
  return Object.values(read().byId);
}

export function publicTransaction(tx: Transaction) {
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
