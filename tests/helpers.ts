import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetPersistCache } from "@/lib/persist/json-store";

export function useTempDataDir() {
  beforeEach(() => {
    process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "cbc-phase2-"));
    process.env.SESSION_SECRET = "test-session-secret-32chars-long!!";
    process.env.AUTH_SECRET = process.env.SESSION_SECRET;
    process.env.PRIVACY_SIGNING_SECRET = "test-privacy-secret-32chars-long";
    process.env.MPESA_C2B_WEBHOOK_SECRET = "c2b-test-token";
    process.env.MPESA_RECONCILE_SECRET = "reconcile-test-token";
    resetPersistCache();
  });

  afterEach(() => {
    resetPersistCache();
  });
}
