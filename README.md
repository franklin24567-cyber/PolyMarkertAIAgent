# PolyMarket AI Agent

A **Hermes-powered, self-improving Polymarket copy-trading bot** with a
Next.js/Vercel dashboard.

> ## 📄 PAPER TRADING ONLY — v1
> This version **never places real trades, never spends real money, and
> never asks for, stores, or uses a private key**. Every "trade" it opens is
> a row in a local SQLite database representing a *simulated* position.
> See [`SAFETY.md`](./SAFETY.md) for the full safety model.

## What this is

The bot watches public Polymarket wallet activity, scores wallets and
individual trades against a versioned, auditable rule set, and — for
trades that clear the bar — opens a **paper trade** and tracks its
simulated PnL over time. A self-improvement loop periodically reviews how
paper trades performed and nudges the scoring thresholds based on real
evidence, logging every change. **Hermes** is the operator persona/prompt
set that runs this loop (see [`hermes/`](./hermes)).

## Tech stack

- **Next.js 14** (App Router) + TypeScript
- **React** + **Tailwind CSS** (dark-mode dashboard)
- **SQLite** locally via **Drizzle ORM** (`better-sqlite3`)
- **recharts** for PnL / win-rate charts
- Vercel-ready architecture (see "Production Notes" below)

## Project layout

```
src/
  app/
    (dashboard)/        # Sidebar layout + dashboard pages
    api/                # REST-ish JSON API routes
  components/           # Shared dashboard UI (charts, badges, sidebar)
  lib/
    adapters/polymarket.ts   # Read-only Polymarket HTTP client
    db/                       # Drizzle schema + connection
    scoring/                  # walletScorer.ts, tradeScorer.ts (pure fns)
    pnl.ts, rules.ts, telegram.ts, logger.ts
  scripts/               # CLI jobs (scan, monitor, score, report, ...)
  __tests__/             # Jest unit tests
hermes/                  # Hermes system prompt + operator docs
drizzle/                 # Generated SQL migrations
```

## Getting started

```bash
cp .env.example .env.local   # optional keys; safe to leave Telegram blank
npm install
npm run db:generate          # only needed when schema.ts changes
npm run db:migrate           # creates/updates ./polymarket-bot.db
npm run seed                 # inserts clearly-labeled DEMO DATA
npm run dev                  # http://localhost:3000
```

## Running the live pipeline

These CLI scripts only ever *read* public Polymarket data and *write* to
your local paper-trading database — they never sign or submit anything:

```bash
npm run scan:leaderboard   # discover/refresh candidate wallets
npm run scan:wallets       # refresh scores for tracked/watched wallets
npm run monitor:trades     # poll tracked wallets for new trades
npm run score:trades       # score new trades, open paper trades
npm run paper:update-pnl   # mark-to-market PnL for open paper trades
npm run review:outcomes    # review aged/resolved paper trades
npm run update:rules       # self-improvement pass (versions a new RuleSet)
npm run report:daily       # generate + (optionally) send daily report
```

If any Polymarket API call fails, the script throws the **real** error and
exits non-zero — it never falls back to fake or cached data. See
[`hermes/cron-examples.md`](./hermes/cron-examples.md) for suggested
schedules.

## Dashboard pages

| Page | Route | Purpose |
|---|---|---|
| Overview | `/` | KPIs, PnL chart, copy candidates, latest rule changes |
| Wallet Rankings | `/wallets` | Scored wallet table (ROI, consistency, copyability, one-hit-wonder) |
| Wallet Detail | `/wallets/[address]` | Per-wallet scores, category strengths, recent decisions/trades |
| Trade Signals | `/signals` | Feed of observed trades from tracked wallets |
| Paper Trades | `/paper-trades` | All simulated positions + unrealized PnL |
| Decision Journal | `/decisions` | Every `paper_copy` / `watchlist` / `skip` decision with reasons/risks |
| Performance | `/performance` | PnL line chart + win/loss bar chart |
| Rules | `/rules` | RuleSet versions + self-improvement change history |
| Reports | `/reports` | Daily/weekly summaries |

## API routes

`GET /api/overview`, `/api/wallets`, `/api/wallets/[address]`, `/api/trades`,
`/api/paper-trades`, `/api/decisions`, `/api/performance`, `/api/rules`,
`/api/reports`. Every response includes an `isDemoData` boolean so
consumers can distinguish seeded demo rows from real observed data. Errors
return a real message and a non-200 status code — nothing is swallowed.

## Scoring model

- **Wallet scoring** (`src/lib/scoring/walletScorer.ts`): ROI, consistency
  (inverse coefficient of variation of per-trade returns), a one-hit-wonder
  penalty (0–0.5, triggered when a single trade is >50% of total profit),
  copyability (liquidity/spread/entry-timing quality), and category edge.
- **Trade scoring** (`src/lib/scoring/tradeScorer.ts`): combines wallet
  quality with market-specific factors (spread, liquidity, time-to-
  resolution, price movement since the wallet's entry) against the active
  **RuleSet**, and outputs a `paper_copy` / `watchlist` / `skip` decision
  with explicit reasons and risks.
- **Default RuleSet thresholds** live in `DEFAULT_RULE_SET`
  (`src/lib/scoring/tradeScorer.ts`) and are seeded as RuleSet v1.
- **Paper PnL**: YES side `= (current - entry) * (size / entry)`; NO side
  `= (entry - current) * (size / (1 - entry))` (`src/lib/pnl.ts`).

## Self-improvement loop

`npm run update:rules` looks at the last 7 days of `OutcomeReview` rows and,
only when there's a clear pattern (e.g. losing `paper_copy` trades
consistently had thin liquidity or wide spreads, or came from late entries),
creates a new, incrementally-adjusted `RuleSet` version and a `RuleChange`
audit row citing the evidence. Nothing is ever silently overwritten — every
prior version remains in the database and can be reactivated.

## Testing

```bash
npm test
```

Includes unit tests for wallet scoring, trade scoring, paper PnL math, rule
versioning, and a dedicated `safety.test.ts` that statically scans the
source tree to assert there is no private-key handling and no real order
placement/signing code path.

## Production notes (Vercel)

- SQLite (`better-sqlite3`) is file-based; **Vercel's filesystem is
  ephemeral and read-only outside `/tmp`** between deployments/invocations.
  The dashboard will work for read-only browsing of whatever was seeded
  into the deployed bundle, but writes from cron-triggered scripts won't
  persist across deployments.
- For a real production deployment, point `DATABASE_URL` at a hosted
  SQLite-compatible service like **Turso** (libSQL, drop-in compatible with
  Drizzle's SQLite dialect), or swap the schema/connection over to a
  Postgres driver (e.g. **Neon**) using Drizzle's Postgres dialect.
- Telegram notifications are fully optional — set `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_ID` as Vercel environment variables to enable them;
  otherwise `dailyReport.ts` skips notification gracefully.

## Environment variables

See [`.env.example`](./.env.example). No secret is ever required to run the
app in paper-trading mode; Telegram credentials are the only optional
values, and they're never logged (see `src/lib/logger.ts`).

## Safety

See [`SAFETY.md`](./SAFETY.md) for the complete list of safety guarantees
and how they're enforced/tested in this codebase.
