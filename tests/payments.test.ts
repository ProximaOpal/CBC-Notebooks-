import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { quoteFromRequest } from "@/lib/payments/catalog";
import { initiateSchema, quoteOrThrow } from "@/lib/payments/initiate-schema";
import { toMsisdn } from "@/lib/payments/mpesa";
import { applySuccess } from "@/lib/payments/entitlements";
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

  it("quotes catalog amounts and ignores client-chosen prices", () => {
    const quoted = quoteFromRequest({
      sku: "math-notes",
      amount: 1,
      metadata: { item: "math-notes" },
    });
    expect(quoted.amount).toBe(50);
    expect(quoted.currency).toBe("KES");
    expect(() => quoteFromRequest({ amount: 9999 })).toThrow(/Unknown price item/);
  });

  it("rejects junk initiate payloads via Zod", () => {
    expect(initiateSchema.safeParse({}).success).toBe(true);
    expect(initiateSchema.safeParse({ method: "CASH" }).success).toBe(false);
    expect(initiateSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(initiateSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    const quoted = quoteOrThrow({ sku: "exams", amount: 1, user_id: "attacker" });
    expect(quoted.amount).toBe(100);
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
});
