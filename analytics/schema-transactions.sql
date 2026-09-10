-- Unified checkout ledger for M-Pesa and Stripe. Additive.

CREATE TABLE IF NOT EXISTS transactions (
  id                    UUID PRIMARY KEY,
  user_id               TEXT,
  reference_id          TEXT UNIQUE NOT NULL,
  provider              TEXT NOT NULL CHECK (provider IN ('MPESA', 'STRIPE')),
  provider_reference    TEXT,
  mpesa_receipt_number  TEXT,
  amount                NUMERIC(12,2) NOT NULL,
  currency              TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'TIMED_OUT')),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_provider_ref_idx ON transactions (provider_reference);
CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS entitlements (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  item         TEXT NOT NULL,
  released_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item)
);
