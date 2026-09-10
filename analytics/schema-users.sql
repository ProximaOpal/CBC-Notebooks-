-- Google account profile (additive). Do not drop existing telemetry tables.

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  google_id       TEXT UNIQUE,
  email           TEXT UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  full_name       TEXT,
  given_name      TEXT,
  family_name     TEXT,
  picture_url     TEXT,
  locale          TEXT,
  auth_provider   TEXT NOT NULL DEFAULT 'GOOGLE',
  password_hash   TEXT,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
