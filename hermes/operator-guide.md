# Hermes Operator Guide

This guide explains how Hermes (or a human operator standing in for it)
should run the PolyMarket AI Agent day-to-day.

## 1. First-time setup

```bash
cp .env.example .env.local     # fill in optional keys; leave Telegram blank if unused
npm install
npm run db:generate            # generate SQL migration from schema.ts (only when schema changes)
npm run db:migrate             # apply migrations to ./polymarket-bot.db
npm run seed                   # populate clearly-labeled DEMO DATA for the dashboard
npm run dev                    # start the dashboard at http://localhost:3000
```

## 2. Running the live pipeline (real Polymarket data, paper trades only)

Run scripts in this order, either manually or on the cron schedule in
`hermes/cron-examples.md`:

```bash
npm run scan:leaderboard
npm run scan:wallets
npm run monitor:trades
npm run score:trades
npm run paper:update-pnl
npm run review:outcomes
npm run update:rules
npm run report:daily
```

Each script is idempotent-ish and safe to re-run: they dedupe by natural
keys (wallet address, market id + timestamp, etc.) and only ever insert
paper-trading records.

## 3. Promoting a wallet from "watch" to "track"

New wallets discovered via `scan:leaderboard` default to `status = "watch"`.
Hermes (or the operator) should only flip a wallet to `status = "track"`
after reviewing its scores (`globalScore`, `consistencyScore`,
`oneHitWonderPenalty`) on the Wallet Rankings page. This is currently a
manual/DB-level decision in v1 - there is no UI toggle by design, so that a
human always makes the final "start following this wallet" call.

## 4. Interpreting the Decision Journal

Every observed trade produces exactly one `decision_journal` row with:

- `decision`: `paper_copy` | `watchlist` | `skip`
- `copyScore` / `confidence`: 0..1 outputs of `scoreTrade()`
- `reasonsJson` / `risksJson`: human-readable justification

If you disagree with a decision, do not edit the row - instead, treat it as
signal for `update:rules` (or open a manual RuleChange with your own
reasoning) so the change is versioned and auditable.

## 5. When APIs fail

If `scan:leaderboard`, `scan:wallets`, `monitor:trades`, or `score:trades`
fail because a Polymarket endpoint is down/changed/rate-limited, the script
will throw with the real HTTP error and exit non-zero. Do not silently
retry with fabricated data or skip the failure - surface it (cron logs,
Telegram if configured) and re-run once the underlying issue is resolved.

## 6. Rule changes

`update:rules` only nudges thresholds when there's a clear 7-day pattern in
`outcome_reviews` (e.g. losing paper_copy trades consistently had thin
liquidity or wide spreads). Every change creates a new `RuleSet` version and
a `RuleChange` audit row citing the evidence. Review the Rules page
periodically to confirm changes make sense; you can always reactivate a
prior `RuleSet` version manually if a change looks wrong.

## 7. Going beyond v1 (out of scope for this system prompt)

Anything involving real order placement, wallet signing, or spending funds
is explicitly **out of scope** for Hermes in this version. Do not attempt to
wire in a private key, a signer, or a "live mode" toggle - that would
require a completely separate, much more carefully reviewed system with its
own explicit human sign-off, which this repository does not implement.
