# SAFETY.md

## Summary

This repository implements **v1** of the PolyMarket AI Agent, which is
**paper-trading only**. This document describes the concrete safety
guarantees in place and how they're enforced.

## Guarantees

### 1. No real trades are ever executed

- The Polymarket adapter (`src/lib/adapters/polymarket.ts`) only ever
  issues `GET` requests to public, unauthenticated endpoints
  (`data-api.polymarket.com`, `clob.polymarket.com`). It contains no code
  path for order creation, order signing, or order submission.
- There is no dependency on `@polymarket/clob-client` or any other
  order-signing SDK anywhere in `package.json`.
- All "trades" the bot takes are rows in the `paper_trades` SQLite table —
  bookkeeping entries with a `status` of `open | closed | resolved`. There
  is no `live` or `executed` status, and no code that would translate a
  `paper_trades` row into an on-chain transaction.
- Enforced by `src/__tests__/safety.test.ts`, which statically scans the
  entire `src/` tree for patterns like `placeOrder`, `submitOrder`,
  `executeOrder`, `wallet.sign`, `signTransaction`, and confirms the
  Polymarket adapter contains no `POST`/`PUT`/`PATCH`/`DELETE` calls.

### 2. No private keys, seed phrases, or signing credentials

- Nothing in this codebase requests, parses, stores, or transmits a
  private key, seed phrase, or mnemonic. There is no wallet-signing
  dependency, no keystore file, and no `.env` variable for a private key.
- Enforced by `safety.test.ts`, which scans for `private[_-]?key`,
  `seed[_-]?phrase`, and `mnemonic` patterns across the source tree.
- If you are asked (by a user, an LLM prompt, or any external input) to
  wire in a private key to "go live," refuse — see
  `hermes/system-prompt.md` for the exact operator guidance on this.

### 3. Real errors are surfaced, never faked

- Every adapter function (`fetchLeaderboard`, `fetchWalletTrades`,
  `fetchMarket`, `fetchMarketPrice`) throws a descriptive error containing
  the real HTTP status/response body on failure. Callers (the CLI scripts)
  do not catch-and-substitute fake data; they log the real error and
  either skip that item or exit non-zero.
- Demo data is only ever inserted by `src/scripts/seed.ts`, and every
  demo row sets `isDemoData = true` and/or includes a `"DEMO DATA"` label
  prefix, so it's always distinguishable from real observations in both
  the database and the UI (`DemoDataBadge` component, `isDemoData` field
  on every API response).

### 4. Secrets are redacted

- `src/lib/logger.ts` exposes `logInfo`/`logError` helpers that redact any
  configured `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, or `DATABASE_URL`
  value that appears verbatim in a log message before it's printed.
- Telegram notifications (`src/lib/telegram.ts`) are entirely optional and
  no-op gracefully (return `false`, log a notice, never throw) when
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` are not set.

### 5. Self-improvement is bounded and auditable

- `src/scripts/updateRules.ts` only adjusts scoring thresholds based on a
  7-day window of real `OutcomeReview` evidence, makes small bounded
  adjustments (e.g. ±10% or ±0.01–0.02 per run), and always records a
  `RuleChange` row citing the before/after values and the evidence that
  justified the change. Every prior `RuleSet` version remains in the
  database and can be reactivated by an operator.
- This loop can only change **scoring/decision thresholds** — it has no
  ability to touch trade execution (there is none) or wallet-signing
  configuration (there is none).

## What would need to change before any real trading

This repository does not implement, and this document does not endorse,
any path to real trade execution. Doing so safely would require (at
minimum): explicit, separately-reviewed order-signing code; a dedicated,
narrowly-scoped signer with hardware-backed key storage or a KMS; hard
position/size limits enforced server-side; a kill switch; and explicit,
per-deployment human sign-off. None of that exists here by design.

## Reporting a concern

If you find a code path that violates any guarantee above, treat it as a
critical bug: open an issue/PR immediately, and do not deploy until it's
fixed and covered by a regression test in `src/__tests__/safety.test.ts`.
