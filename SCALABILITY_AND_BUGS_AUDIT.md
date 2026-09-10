# Scalability and bugs audit — CBC Notebooks

Date: 11 September 2026  
Scope: dual-runtime monolith (static `src/` on port 8080 + Next.js App Router). Render still publishes the static site.

## Phase 1 findings (unchanged contracts)

P0: in-memory payment/session maps; hardcoded HMAC fallbacks; unauthenticated initiate/status with client-chosen `amount`/`user_id` and live Daraja queries on GET; SHA-256 passwords in `localStorage`.

P1: open C2B webhooks; Prisma-required Google callback; dual Google env vars; privacy default secret; Next telemetry not persisted; NextAuth Credentials + Adapter + JWT; no first-party tests.

## Phase 2 fixes (this pass)

Worked domain-by-domain. API paths and JSON envelopes were kept. Persistence is durable JSON under `.data/` (Prisma remains optional when `DATABASE_URL` is set). Redis/queues were not introduced.

### Domain A — Payments

- Server-side catalog (`lib/payments/catalog.ts`) is the source of truth for amount/currency. Client `amount` and `user_id` are ignored.
- `POST /api/payments/initiate` and Stripe checkout require an authenticated session.
- `GET /api/payments/status/:referenceId` requires the owning session and **does not** call Daraja. Reconciliation is `POST /api/payments/mpesa/reconcile` with `MPESA_RECONCILE_SECRET`.
- Transactions, STK intents, receipts, and entitlements persist to JSON with optimistic locking (`PENDING` → terminal only once).
- Tests: MSISDN `2547`/`2541`, catalog ignore-amount, Zod junk, STK `0`/`1032`/`1037`, disk persist, lock.

### Domain B — Auth / session

- Production refuses missing `SESSION_SECRET` / `AUTH_SECRET`. Well-known fallbacks (`cbc-notebooks-session`) are rejected.
- GIS sessions persist under `.data/gis-sessions.json`. Google ID tokens are AES-256-GCM sealed, not stored as plaintext in a process `Map`.
- `GOOGLE_CLIENT_ID` and `AUTH_GOOGLE_ID` resolve through one helper. NextAuth Google provider uses the same aliases. Adapter is JWT-only and skipped when `DATABASE_URL` is unset.
- Google callback still returns `{ ok, user }`; Prisma is best-effort, file store is the fallback.
- Tests: HMAC mismatch, sealed token on disk, logout destroys session, production secret throw.

### Domain C — Static credentials overlay

- Overlay no longer SHA-256 hashes into `localStorage`. It POSTs `/api/auth/login` and `/api/auth/register` (`credentials: include`).
- Server stores bcrypt hashes. Duplicate email → 409 `Email already exists`.
- UI session cache is `sessionStorage` profile only; HttpOnly `cbc_session` cookie is the source of truth. Legacy `cbc-auth-users` is cleared on write.
- Tests: overlay validators, duplicate email, bcrypt (not 64-char SHA-256).

### Domain D — Webhooks and privacy

- C2B validation/confirmation require `MPESA_C2B_WEBHOOK_SECRET` (`?token=` or `x-mpesa-webhook-token`). Zod rejects malformed bodies as `C2B00016`.
- Optional `MPESA_CALLBACK_IPS` allowlist on STK callbacks.
- Privacy export/delete use Zod email + token (min 16). Signing uses `PRIVACY_SIGNING_SECRET` with no ODPC fallback string. Requests persist to `.data/privacy-store.json`.
- Next `/api/telemetry` still returns 202 and now appends anonymized JSONL.

## What is still Phase 3

- Redis / shared session store across many Node processes
- BullMQ (or similar) instead of `setTimeout` STK fallback
- Rate limits, circuit breakers, connection pooling
- Making Prisma the live ledger instead of JSON files
- Rotating session cookies and retiring `next-auth` beta

## How to verify

```bash
npm test
```

Set `SESSION_SECRET` (and `PRIVACY_SIGNING_SECRET`) before `npm run dev` / `npm run dev:next`. Register C2B URLs with `?token=` matching `MPESA_C2B_WEBHOOK_SECRET`.
