import "dotenv/config";
/**
 * Roll up a DailyReport summarizing the bot's (paper) performance, and
 * optionally push a summary to Telegram if configured. No real trades,
 * no real money - this only reports on simulated activity.
 */
import { and, gte, lt, eq, desc } from "drizzle-orm";
import { db } from "../lib/db";
import { paperTrades, decisionJournal, walletProfiles, dailyReports, ruleChanges } from "../lib/db/schema";
import { isTelegramConfigured, sendTelegramMessage } from "../lib/telegram";
import { logInfo, logError } from "../lib/logger";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const date = todayDateString();
  const dayStart = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const dayEnd = dayStart + 86400;

  const allOpen = await db.select().from(paperTrades).where(eq(paperTrades.status, "open"));
  const paperPnl = allOpen.reduce((sum, t) => sum + (t.unrealizedPnl ?? 0), 0);

  const closedToday = await db
    .select()
    .from(paperTrades)
    .where(and(eq(paperTrades.status, "resolved"), gte(paperTrades.resolvedAt, dayStart), lt(paperTrades.resolvedAt, dayEnd)));
  const wins = closedToday.filter((t) => (t.realizedPnl ?? 0) >= 0).length;
  const winRate = closedToday.length > 0 ? wins / closedToday.length : null;

  const decisionsToday = await db
    .select()
    .from(decisionJournal)
    .where(and(gte(decisionJournal.createdAt, dayStart), lt(decisionJournal.createdAt, dayEnd)));

  const copiedSignals = decisionsToday.filter((d) => d.decision === "paper_copy").length;
  const watchedSignals = decisionsToday.filter((d) => d.decision === "watchlist").length;
  const skippedSignals = decisionsToday.filter((d) => d.decision === "skip").length;

  const wallets = await db.select().from(walletProfiles).orderBy(desc(walletProfiles.globalScore)).limit(20);
  const bestWallets = wallets.slice(0, 5).map((w) => ({ address: w.address, label: w.label, globalScore: w.globalScore }));
  const worstWallets = [...wallets]
    .sort((a, b) => (a.globalScore ?? 0) - (b.globalScore ?? 0))
    .slice(0, 5)
    .map((w) => ({ address: w.address, label: w.label, globalScore: w.globalScore }));

  const recentRuleChanges = await db
    .select()
    .from(ruleChanges)
    .where(and(gte(ruleChanges.createdAt, dayStart), lt(ruleChanges.createdAt, dayEnd)));

  const summary =
    `Paper PnL: $${paperPnl.toFixed(2)} | Win rate: ${winRate != null ? (winRate * 100).toFixed(0) + "%" : "n/a"} | ` +
    `Open positions: ${allOpen.length} | New signals: ${decisionsToday.length} ` +
    `(copied ${copiedSignals}, watched ${watchedSignals}, skipped ${skippedSignals}) | ` +
    `Rule changes today: ${recentRuleChanges.length}`;

  const existing = await db.select().from(dailyReports).where(eq(dailyReports.date, date)).limit(1);

  const payload = {
    date,
    paperPnl,
    winRate,
    openPositions: allOpen.length,
    newSignals: decisionsToday.length,
    copiedSignals,
    watchedSignals,
    skippedSignals,
    bestWalletsJson: JSON.stringify(bestWallets),
    worstWalletsJson: JSON.stringify(worstWallets),
    ruleChangesJson: JSON.stringify(recentRuleChanges),
    summary,
    isDemoData: false,
  };

  if (existing.length > 0) {
    await db.update(dailyReports).set(payload).where(eq(dailyReports.date, date));
  } else {
    await db.insert(dailyReports).values(payload);
  }

  logInfo(`[dailyReport] ${date}: ${summary}`);

  if (isTelegramConfigured()) {
    const sent = await sendTelegramMessage(`*PolyMarket AI Agent - Daily Report (${date})*\n${summary}\n\n_Paper trading only - no real funds involved._`);
    await db.update(dailyReports).set({ sentToTelegram: sent }).where(eq(dailyReports.date, date));
  } else {
    logInfo("[dailyReport] Telegram not configured; skipping notification.");
  }
}

main().catch((err) => {
  logError("[dailyReport] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
