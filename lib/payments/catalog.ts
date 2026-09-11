import {
  getSku as readSku,
  listSkus as listClientSkus,
  quoteItems,
  resolveSkuCode,
  verifyClientTotal,
} from "../../src/assets/js/data/payments.js";
import type { ResourceType } from "./types";

export type CatalogSku = {
  sku: string;
  amount: number;
  currency: "KES" | "USD";
  description: string;
  resource_type: ResourceType;
  ttlHours?: number;
};

export type CartQuote = {
  currency: "KES";
  lines: CatalogSku[];
  totalAmount: number;
};

export const AMOUNT_CAP: Record<string, number> = {
  KES: 20_000,
  USD: 200,
  EUR: 200,
};

function toCatalog(row: {
  sku: string;
  amount: number;
  currency?: string;
  label?: string;
  detail?: string;
  resource_type?: string;
  ttlHours?: number;
}): CatalogSku {
  return {
    sku: row.sku,
    amount: row.amount,
    currency: (row.currency || "KES") as "KES" | "USD",
    description: row.detail || row.label || row.sku,
    resource_type: (row.resource_type || "Notes") as ResourceType,
    ttlHours: row.ttlHours,
  };
}

export function getSku(code: string | undefined | null): CatalogSku | null {
  const row = readSku(code);
  return row ? toCatalog(row) : null;
}

export function listSkus(): CatalogSku[] {
  return listClientSkus().map(toCatalog);
}

export function quoteCart(input: {
  sku?: string;
  items?: string[];
  amount?: number;
  totalAmount?: number;
  metadata?: { item?: unknown; resource_type?: unknown; sku?: unknown; items?: unknown };
}): CartQuote {
  const fromMeta = Array.isArray(input.metadata?.items) ? input.metadata.items.map((item) => String(item)) : [];
  const codes = (input.items && input.items.length ? input.items : fromMeta).filter(Boolean);
  if (!codes.length) {
    const hinted = String(input.sku || input.metadata?.sku || input.metadata?.item || input.metadata?.resource_type || "")
      .trim();
    if (hinted.includes("+")) codes.push(...hinted.split("+"));
    else if (hinted) codes.push(hinted);
  }
  const claimed = input.totalAmount ?? input.amount;
  const quote = verifyClientTotal(codes, claimed);
  const lines = quote.lines.map(toCatalog);
  const cap = AMOUNT_CAP[quote.currency] ?? 20_000;
  if (quote.totalAmount > cap) throw new Error("Catalog amount exceeds cap");
  return { currency: "KES", lines, totalAmount: quote.totalAmount };
}

export function quoteFromRequest(input: {
  sku?: string;
  items?: string[];
  amount?: number;
  totalAmount?: number;
  currency?: string;
  metadata?: { item?: unknown; resource_type?: unknown; sku?: unknown; items?: unknown };
}): CatalogSku & { lines: CatalogSku[]; totalAmount: number } {
  const cart = quoteCart(input);
  const primary = cart.lines[0];
  return {
    ...primary,
    sku: cart.lines.map((line) => line.sku).join("+"),
    amount: cart.totalAmount,
    description: cart.lines.map((line) => line.description).join(", "),
    lines: cart.lines,
    totalAmount: cart.totalAmount,
  };
}

export { resolveSkuCode, quoteItems, verifyClientTotal };
