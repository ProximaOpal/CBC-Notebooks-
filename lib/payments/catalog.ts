import type { ResourceType } from "./types";

export type CatalogSku = {
  sku: string;
  amount: number;
  currency: "KES" | "USD";
  description: string;
  resource_type: ResourceType;
};

const SKUS: Record<string, CatalogSku> = {
  "math-notes": {
    sku: "math-notes",
    amount: 50,
    currency: "KES",
    description: "Grade 6 Mathematics notes",
    resource_type: "Notes",
  },
  notes: {
    sku: "notes",
    amount: 50,
    currency: "KES",
    description: "CBC notes",
    resource_type: "Notes",
  },
  exams: {
    sku: "exams",
    amount: 100,
    currency: "KES",
    description: "CBC exams",
    resource_type: "Exam",
  },
  audiobooks: {
    sku: "audiobooks",
    amount: 80,
    currency: "KES",
    description: "AudioBooks",
    resource_type: "AudioBooks",
  },
  immersive: {
    sku: "immersive",
    amount: 150,
    currency: "KES",
    description: "Immersive Learning",
    resource_type: "Immersive",
  },
  "3d-pass": {
    sku: "3d-pass",
    amount: 200,
    currency: "KES",
    description: "3D Pass",
    resource_type: "3D Pass",
  },
  subscription: {
    sku: "subscription",
    amount: 500,
    currency: "KES",
    description: "Monthly subscription",
    resource_type: "Subscription",
  },
};

export const AMOUNT_CAP: Record<string, number> = {
  KES: 20_000,
  USD: 200,
  EUR: 200,
};

export function getSku(code: string | undefined | null): CatalogSku | null {
  if (!code) return null;
  return SKUS[String(code).trim().toLowerCase()] || null;
}

export function listSkus(): CatalogSku[] {
  return Object.values(SKUS);
}

export function quoteFromRequest(input: {
  sku?: string;
  amount?: number;
  currency?: string;
  metadata?: { item?: unknown; resource_type?: unknown; sku?: unknown };
}): CatalogSku {
  const hinted = String(input.sku || input.metadata?.sku || input.metadata?.item || input.metadata?.resource_type || "")
    .trim()
    .toLowerCase();
  const sku = getSku(hinted);
  if (!sku) {
    throw new Error("Unknown price item. Send a catalog sku.");
  }
  const cap = AMOUNT_CAP[sku.currency] ?? sku.amount;
  if (sku.amount > cap) throw new Error("Catalog amount exceeds cap");
  return sku;
}
