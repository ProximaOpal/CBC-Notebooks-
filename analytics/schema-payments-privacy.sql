-- Additive M-Pesa and ODPC tables. Do not drop telemetry_events.

CREATE TABLE IF NOT EXISTS mpesa_intents (
  id                   TEXT PRIMARY KEY,
  checkout_request_id  TEXT UNIQUE NOT NULL,
  merchant_request_id  TEXT,
  amount               INTEGER NOT NULL,
  account_reference    TEXT NOT NULL,
  msisdn_masked        TEXT NOT NULL,
  status               TEXT NOT NULL,
  result_code          TEXT,
  result_desc          TEXT,
  receipt              TEXT UNIQUE,
  query_after          TIMESTAMPTZ NOT NULL,
  queried_at           TIMESTAMPTZ,
  callback_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS c2b_payments (
  id                   TEXT PRIMARY KEY,
  trans_id             TEXT UNIQUE NOT NULL,
  amount               TEXT NOT NULL,
  bill_ref_number      TEXT NOT NULL,
  business_short_code  TEXT,
  msisdn_masked        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  subject_hash  TEXT NOT NULL,
  status        TEXT NOT NULL,
  user_id       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS privacy_requests_subject_idx ON privacy_requests (subject_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS mpesa_intents_status_idx ON mpesa_intents (status, query_after);

CREATE TABLE IF NOT EXISTS user_ai_queries (
  user_id    TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS transaction_id TEXT;
