import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAY_SKUS, skuForResource } from "../src/assets/js/data/payments.js";
import { getSku } from "../lib/payments/catalog.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("payment overlay clone", () => {
  it("keeps client SKU amounts in lockstep with the server catalog", () => {
    for (const item of PAY_SKUS) {
      const catalog = getSku(item.sku);
      expect(catalog?.amount).toBe(item.amount);
      expect(catalog?.currency).toBe("KES");
    }
    expect(skuForResource("exams").sku).toBe("exams");
    expect(skuForResource("experiments").sku).toBe("experiments");
    expect(skuForResource("notes").amount).toBe(50);
    expect(PAY_SKUS.find((item) => item.sku === "audiobooks")?.amount).toBe(150);
    expect(PAY_SKUS.find((item) => item.sku === "immersive")?.amount).toBe(200);
    expect(PAY_SKUS.find((item) => item.sku === "ask-ai-daily")?.amount).toBe(100);
  });

  it("ships the two-phone overlay chrome in the public shell", () => {
    const html = readFileSync(join(root, "src", "index.html"), "utf8");
    expect(html).toContain('id="payOverlay"');
    expect(html).toContain("My Payments");
    expect(html).toContain("Payment Details");
    expect(html).toContain('id="payPhone"');
    expect(html).toContain("Send STK");
    expect(html).toContain("pay-overlay.css");
  });
});
