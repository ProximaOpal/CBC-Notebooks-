import { describe, expect, it } from "vitest";
import { assertC2bWebhook, c2bSchema, privacySubjectSchema } from "@/lib/webhooks/guard";
import { validateC2bPayment } from "@/lib/payments/mpesa-resilience";
import { exportUserData, signPrivacyToken, verifyPrivacyToken } from "@/middleware/privacy";
import { useTempDataDir } from "./helpers";

useTempDataDir();

describe("Domain D webhooks and privacy", () => {
  it("rejects malformed C2B payloads", () => {
    expect(c2bSchema.safeParse({}).success).toBe(false);
    expect(c2bSchema.safeParse({ TransID: "ABC", TransAmount: "50", BillRefNumber: "ref-1" }).success).toBe(true);
    expect(validateC2bPayment({ TransAmount: "50", BillRefNumber: "ref" }).ResultCode).toBe("C2B00016");
    expect(validateC2bPayment({ TransID: "ABC", TransAmount: "0", BillRefNumber: "ref" }).ResultCode).toBe("C2B00016");
  });

  it("requires the C2B webhook token", () => {
    const url = "http://localhost/api/payments/mpesa/c2b-validation";
    expect(() => assertC2bWebhook(new Request(url, { method: "POST" }))).toThrow(/Invalid C2B webhook token/);
    expect(() =>
      assertC2bWebhook(new Request(`${url}?token=c2b-test-token`, { method: "POST" }))
    ).not.toThrow();
  });

  it("returns 403 semantics without a valid privacy token", () => {
    expect(privacySubjectSchema.safeParse({ email: "not-an-email", token: "abcd" }).success).toBe(false);
    expect(verifyPrivacyToken("ada@school.ke", "export", "nope")).toBe(false);
    const token = signPrivacyToken("ada@school.ke", "export");
    expect(verifyPrivacyToken("ada@school.ke", "export", token)).toBe(true);
    const exported = exportUserData("ada@school.ke");
    expect(exported.request.status).toBe("fulfilled");
    expect(exported.data.controller).toBe("CBC Notebooks");
  });
});
