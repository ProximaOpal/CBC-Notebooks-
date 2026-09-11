/** Canonical CBC tariff — client overlay and server quote share this file. */

export const ASK_AI_FREE = 5;
export const ASK_AI_SKU = "ask-ai-daily";
export const ASK_AI_TTL_MS = 24 * 60 * 60 * 1000;

export const PAY_SKUS = [
  { sku: "visual-notes", amount: 50, currency: "KES", label: "Visual PDF Notes", detail: "View-only KICD notes", icon: "📒", tone: "teal", resource_type: "Notes" },
  { sku: "mastery-notes", amount: 100, currency: "KES", label: "Detailed Mastery Notes", detail: "Worked examples and mastery notes", icon: "📘", tone: "blue", resource_type: "Notes" },
  { sku: "videos", amount: 100, currency: "KES", label: "Videos", detail: "Lesson videos for the selected subject", icon: "🎬", tone: "navy", resource_type: "Videos" },
  { sku: "gallery", amount: 100, currency: "KES", label: "Photo Gallery", detail: "Photo gallery for the selected subject", icon: "🖼️", tone: "teal", resource_type: "Gallery" },
  { sku: "experiments", amount: 100, currency: "KES", label: "Experiments", detail: "Virtual laboratory experiments", icon: "🧪", tone: "blue", resource_type: "Experiments" },
  { sku: "exams", amount: 100, currency: "KES", label: "Exams", detail: "Papers and marking schemes", icon: "📝", tone: "navy", resource_type: "Exam" },
  { sku: "audiobooks", amount: 150, currency: "KES", label: "AudioBooks", detail: "Listen-along lessons", icon: "🎧", tone: "teal", resource_type: "AudioBooks" },
  { sku: "immersive", amount: 200, currency: "KES", label: "Immersive Learning", detail: "Immersive and 3D learning paths", icon: "🌐", tone: "blue", resource_type: "Immersive" },
  { sku: "ask-ai-daily", amount: 100, currency: "KES", label: "Ask AI Day Pass", detail: "Unlimited Ask AI for 24 hours after 5 free questions", icon: "✦", tone: "navy", resource_type: "AskAI", ttlHours: 24 },
];

export const SKU_ALIASES = {
  notes: "visual-notes",
  "math-notes": "visual-notes",
  "3d-pass": "experiments",
  experiments: "experiments",
  "ask-ai": "ask-ai-daily",
  askai: "ask-ai-daily",
};

export const RESOURCE_SKU = {
  notes: "visual-notes",
  videos: "videos",
  gallery: "gallery",
  experiments: "experiments",
  audiobooks: "audiobooks",
  immersive: "immersive",
  exams: "exams",
};

/** SKUs that unlock a content kind. Client never uses this as a gate. */
export const CONTENT_SKUS = {
  notes: ["visual-notes", "mastery-notes", "subscription"],
  videos: ["videos", "subscription"],
  gallery: ["gallery", "subscription"],
  experiments: ["experiments", "subscription"],
  audiobooks: ["audiobooks", "subscription"],
  immersive: ["immersive", "subscription"],
  exams: ["exams", "subscription"],
  "ask-ai": ["ask-ai-daily"],
};

const BY_CODE = Object.fromEntries(PAY_SKUS.map((item) => [item.sku, item]));

export function resolveSkuCode(code) {
  const raw = String(code || "").trim().toLowerCase();
  if (!raw) return "";
  if (BY_CODE[raw]) return raw;
  return SKU_ALIASES[raw] || raw;
}

export function skuByCode(code) {
  return BY_CODE[resolveSkuCode(code)] || PAY_SKUS[0];
}

export function getSku(code) {
  return BY_CODE[resolveSkuCode(code)] || null;
}

export function skuForResource(resource) {
  return skuByCode(RESOURCE_SKU[resource] || "visual-notes");
}

export function listSkus() {
  return PAY_SKUS.slice();
}

export function quoteItems(codes) {
  const seen = new Set();
  const lines = [];
  for (const code of Array.isArray(codes) ? codes : [codes]) {
    const sku = getSku(code);
    if (!sku) {
      throw new Error("Unknown price item. Send catalog sku(s).");
    }
    if (seen.has(sku.sku)) continue;
    seen.add(sku.sku);
    lines.push(sku);
  }
  if (!lines.length) throw new Error("Unknown price item. Send catalog sku(s).");
  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  return { currency: "KES", lines, totalAmount };
}

export function verifyClientTotal(codes, claimedTotal) {
  const quote = quoteItems(codes);
  if (claimedTotal == null || claimedTotal === "") return quote;
  const claimed = Number(claimedTotal);
  if (!Number.isFinite(claimed) || claimed !== quote.totalAmount) {
    throw new Error("totalAmount does not match catalog");
  }
  return quote;
}
