# Cron Schedule Examples

These are example schedules for running the CLI scripts under `src/scripts/`
via `node-cron`, a system crontab, or a scheduler like Vercel Cron / GitHub
Actions. All jobs are read-only against Polymarket + write-only to your local
paper-trading database — none of them touch real funds.

## Suggested cadence

| Script                  | Schedule (cron)     | Frequency        | Purpose                                   |
|--------------------------|----------------------|------------------|--------------------------------------------|
| `scan:leaderboard`       | `0 */6 * * *`         | Every 6 hours    | Refresh the candidate wallet pool          |
| `scan:wallets`           | `15 */2 * * *`        | Every 2 hours    | Refresh scores for tracked/watched wallets |
| `monitor:trades`         | `*/5 * * * *`         | Every 5 minutes  | Poll tracked wallets for new trades        |
| `score:trades`           | `*/5 * * * *`         | Every 5 minutes  | Score new trades, open paper trades        |
| `paper:update-pnl`       | `0 * * * *`           | Hourly           | Mark-to-market PnL for open paper trades   |
| `review:outcomes`        | `30 * * * *`          | Hourly (offset)  | Review aged/resolved paper trades          |
| `update:rules`           | `0 3 * * *`            | Daily at 03:00   | Self-improvement pass over 7d of reviews   |
| `report:daily`           | `0 23 * * *`           | Daily at 23:00   | Generate + (optionally) send daily report  |

## Example: node-cron in a standalone worker process

```ts
import cron from "node-cron";
import { execFileSync } from "child_process";

function run(script: string) {
  try {
    execFileSync("npx", ["tsx", `src/scripts/${script}.ts`], { stdio: "inherit" });
  } catch (err) {
    console.error(`[cron] ${script} failed:`, err);
  }
}

cron.schedule("0 */6 * * *", () => run("scanLeaderboard"));
cron.schedule("15 */2 * * *", () => run("scanWallets"));
cron.schedule("*/5 * * * *", () => run("monitorTrades"));
cron.schedule("*/5 * * * *", () => run("scoreTrades"));
cron.schedule("0 * * * *", () => run("updatePnl"));
cron.schedule("30 * * * *", () => run("reviewOutcomes"));
cron.schedule("0 3 * * *", () => run("updateRules"));
cron.schedule("0 23 * * *", () => run("dailyReport"));
```

## Example: crontab (system/VM deployment)

```cron
0 */6 * * * cd /path/to/app && npm run scan:leaderboard >> logs/scan-leaderboard.log 2>&1
15 */2 * * * cd /path/to/app && npm run scan:wallets >> logs/scan-wallets.log 2>&1
*/5 * * * * cd /path/to/app && npm run monitor:trades >> logs/monitor-trades.log 2>&1
*/5 * * * * cd /path/to/app && npm run score:trades >> logs/score-trades.log 2>&1
0 * * * * cd /path/to/app && npm run paper:update-pnl >> logs/update-pnl.log 2>&1
30 * * * * cd /path/to/app && npm run review:outcomes >> logs/review-outcomes.log 2>&1
0 3 * * * cd /path/to/app && npm run update:rules >> logs/update-rules.log 2>&1
0 23 * * * cd /path/to/app && npm run report:daily >> logs/daily-report.log 2>&1
```

## Example: Vercel Cron (vercel.json)

Vercel Cron triggers HTTP endpoints, not CLI scripts directly, so wrap each
script in a small internal API route (e.g. `src/app/api/internal/cron/[job]/route.ts`)
that shells out to (or re-implements) the corresponding script, and protect it
with a shared secret header. Note SQLite on Vercel is ephemeral - see the
README's "Production Notes" before relying on cron writes in that environment.

```json
{
  "crons": [
    { "path": "/api/internal/cron/monitor-trades", "schedule": "*/5 * * * *" },
    { "path": "/api/internal/cron/score-trades", "schedule": "*/5 * * * *" },
    { "path": "/api/internal/cron/update-pnl", "schedule": "0 * * * *" },
    { "path": "/api/internal/cron/daily-report", "schedule": "0 23 * * *" }
  ]
}
```
