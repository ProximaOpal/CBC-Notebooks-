import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { quoteFromRequest } from "@/lib/payments/catalog";
import { initiateSchema, quoteOrThrow } from "@/lib/payments/initiate-schema";
import { toMsisdn } from "@/lib/payments/mpesa";
import { applySuccess, hasEntitlement, hasKindAccess } from "@/lib/payments/entitlements";
import { canAskAi, recordAiQuery } from "@/lib/payments/ai-quota";
import { rememberStkIntent, recordStkCallback } from "@/lib/payments/mpesa-resilience";
import {
  createTransaction,
  getTransaction,
  getTransactionByReference,
  markStatus,
} from "@/lib/payments/transactions";
import { canTransition } from "@/lib/payments/locking";
import { resetPersistCache } from "@/lib/persist/json-store";
import { useTempDataDir } from "./helpers";

useTempDataDir();

describe("Domain A payments", () => {
  it("normalizes Safaricom and Airtel MSISDNs", () => {
    expect(toMsisdn("0712345678")).toBe("254712345678");
    expect(toMsisdn("+254712345678")).toBe("254712345678");
    expect(toMsisdn("254712345678")).toBe("254712345678");
    expect(toMsisdn("0112345678")).toBe("254112345678");
    expect(toMsisdn("254112345678")).toBe("254112345678");
  });

  it("quotes catalog amounts and rejects a mismatched client total", () => {
    const quoted = quoteFromRequest({
      sku: "math-notes",
      metadata: { item: "math-notes" },
    });
    expect(quoted.amount).toBe(50);
    expect(quoted.currency).toBe("KES");
    expect(quoted.totalAmount).toBe(50);
    expect(() => quoteFromRequest({ amount: 9999 })).toThrow(/Unknown price item/);
    expect(() => quoteFromRequest({ sku: "visual-notes", totalAmount: 1 })).toThrow(/totalAmount/);
  });

  it("aggregates a cart from catalog unit prices only", () => {
    const cart = quoteFromRequest({ items: ["visual-notes", "exams", "audiobooks"], totalAmount: 300 });
    expect(cart.totalAmount).toBe(300);
    expect(cart.lines.map((line) => line.sku)).toEqual(["visual-notes", "exams", "audiobooks"]);
    expect(() => quoteFromRequest({ items: ["visual-notes", "exams"], totalAmount: 50 })).toThrow(/totalAmount/);
  });

  it("rejects junk initiate payloads via Zod", () => {
    expect(initiateSchema.safeParse({}).success).toBe(true);
    expect(initiateSchema.safeParse({ method: "CASH" }).success).toBe(false);
    expect(initiateSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(initiateSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    const quoted = quoteOrThrow({ sku: "exams", user_id: "attacker" });
    expect(quoted.amount).toBe(100);
    expect(quoted.totalAmount).toBe(100);
  });

  it("persists transactions across cache reset and locks terminal status", () => {
    const tx = createTransaction({
      user_id: "user-1",
      provider: "MPESA",
      amount: 50,
      currency: "KES",
      metadata: { sku: "math-notes" },
    });
    resetPersistCache();
    const reloaded = getTransaction(tx.id);
    expect(reloaded?.amount).toBe(50);
    expect(canTransition("PENDING", "SUCCESS")).toBe(true);
    markStatus({ id: tx.id }, "SUCCESS");
    const blocked = markStatus({ id: tx.id }, "FAILED", { failure_reason: "should not overwrite" });
    expect(blocked?.status).toBe("SUCCESS");
    expect(blocked?.failure_reason).not.toBe("should not overwrite");
  });

  it("maps STK ResultCode 0 / 1032 / 1037 onto the ledger", () => {
    const paid = createTransaction({
      user_id: "u1",
      provider: "MPESA",
      amount: 50,
      currency: "KES",
    });
    rememberStkIntent({
      checkoutRequestId: "chk-ok",
      amount: 50,
      accountReference: paid.reference_id,
      msisdn: "254712345678",
    });
    recordStkCallback({
      CheckoutRequestID: "chk-ok",
      ResultCode: 0,
      ResultDesc: "The service request is processed successfully.",
      CallbackMetadata: { Item: [{ Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" }] },
    });
    expect(getTransactionByReference(paid.reference_id)?.status).toBe("SUCCESS");
    expect(getTransactionByReference(paid.reference_id)?.mpesa_receipt_number).toBe("NLJ7RT61SV");

    const cancelled = createTransaction({
      user_id: "u1",
      provider: "MPESA",
      amount: 50,
      currency: "KES",
    });
    rememberStkIntent({
      checkoutRequestId: "chk-cancel",
      amount: 50,
      accountReference: cancelled.reference_id,
      msisdn: "254712345678",
    });
    recordStkCallback({ CheckoutRequestID: "chk-cancel", ResultCode: "1032", ResultDesc: "cancelled" });
    expect(getTransactionByReference(cancelled.reference_id)?.status).toBe("FAILED");

    const timed = createTransaction({
      user_id: "u1",
      provider: "MPESA",
      amount: 50,
      currency: "KES",
    });
    rememberStkIntent({
      checkoutRequestId: "chk-timeout",
      amount: 50,
      accountReference: timed.reference_id,
      msisdn: "254712345678",
    });
    recordStkCallback({ CheckoutRequestID: "chk-timeout", ResultCode: "1037", ResultDesc: "timeout" });
    expect(getTransactionByReference(timed.reference_id)?.status).toBe("TIMED_OUT");
  });

  it("writes transaction JSON to disk", () => {
    const tx = createTransaction({
      user_id: "disk",
      provider: "STRIPE",
      amount: 50,
      currency: "KES",
    });
    applySuccess(tx);
    const raw = readFileSync(join(process.env.DATA_DIR as string, "transactions.json"), "utf8");
    expect(raw).toContain(tx.reference_id);
    expect(raw).toContain("SUCCESS");
  });

  it("releases each cart line only after a successful ledger write", () => {
    const tx = createTransaction({
      user_id: "u-cart",
      provider: "MPESA",
      amount: 150,
      currency: "KES",
      metadata: { items: ["visual-notes", "exams"] },
    });
    applySuccess(tx);
    expect(hasEntitlement("u-cart", "visual-notes")).toBe(true);
    expect(hasEntitlement("u-cart", "exams")).toBe(true);
    expect(hasKindAccess("u-cart", "notes")).toBe(true);
    expect(hasKindAccess("u-cart", "videos")).toBe(false);
  });

  it("allows five free Ask AI questions then requires the day pass", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(canAskAi("u-ai").allowed).toBe(true);
      recordAiQuery("u-ai", "question " + i);
    }
    expect(canAskAi("u-ai").allowed).toBe(false);
    const pass = createTransaction({
      user_id: "u-ai",
      provider: "MPESA",
      amount: 100,
      currency: "KES",
      metadata: { items: ["ask-ai-daily"] },
    });
    applySuccess(pass);
    expect(canAskAi("u-ai").reason).toBe("day_pass");
    expect(canAskAi("u-ai").allowed).toBe(true);
  });
});
