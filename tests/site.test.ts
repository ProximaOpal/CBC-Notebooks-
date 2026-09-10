import { afterEach, describe, expect, it } from "vitest";
import { publicAbsoluteUrl, publicSiteOrigin } from "@/lib/site";

describe("production site origin", () => {
  const envKeys = ["NODE_ENV", "AUTH_URL", "NEXT_PUBLIC_SITE_URL", "RENDER_EXTERNAL_URL", "GOOGLE_CALLBACK_URL"];
  const snapshot = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of envKeys) {
      if (snapshot[key] == null) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  });

  it("ignores localhost env on the live Render host", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_URL = "http://localhost:8080";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    delete process.env.RENDER_EXTERNAL_URL;
    expect(publicSiteOrigin()).toBe("https://cbcnotebooks.co.ke");
    expect(publicAbsoluteUrl("http://localhost:3000/api/payments/mpesa/callback", "/api/payments/mpesa/callback")).toBe(
      "https://cbcnotebooks.co.ke/api/payments/mpesa/callback"
    );
  });
});
