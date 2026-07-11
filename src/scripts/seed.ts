import "dotenv/config";
/**
 * Seed the local SQLite database with clearly-labeled DEMO DATA so the
 * dashboard has something to show out of the box. This never calls any
 * real API and never represents real trades/funds - every row inserted
 * here sets isDemoData = true (or a "DEMO DATA" label) so the UI/API can
 * distinguish it from anything produced by the real scanners.
 */
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  walletProfiles,
  observedTrades,
  decisionJournal,
  paperTrades,
  pnlSnapshots,
  marketSnapshots,
  ruleSets,
  dailyReports,
} from "../lib/db/schema";
import { DEFAULT_RULE_SET } from "../lib/scoring/tradeScorer";
import { computePaperPnl } from "../lib/pnl";
import { logInfo } from "../lib/logger";

const nowSec = Math.floor(Date.now() / 1000);
const daysAgo = (n: number) => nowSec - n * 86400;

const DEMO_WALLETS = [
  {
    address: "0xDEMO0000000000000000000000000000000001",
    label: "DEMO DATA - PoliticsWhale.eth",
    sourceRank: 1,
    status: "track" as const,
    roi30d: 0.34,
    consistencyScore: 0.78,
    copyabilityScore: 0.82,
    oneHitWonderPenalty: 0,
    globalScore: 0.81,
    bestCategory: "Politics",
    tradeCount30d: 42,
    winRate30d: 0.71,
  },
  {
    address: "0xDEMO0000000000000000000000000000000002",
    label: "DEMO DATA - SportsSharp",
    sourceRank: 2,
    status: "track" as const,
    roi30d: 0.21,
    consistencyScore: 0.65,
    copyabilityScore: 0.7,
    oneHitWonderPenalty: 0.1,
    globalScore: 0.64,
    bestCategory: "Sports",
    tradeCount30d: 65,
    winRate30d: 0.58,
  },
  {
    address: "0xDEMO0000000000000000000000000000000003",
    label: "DEMO DATA - CryptoSignals",
    sourceRank: 3,
    status: "watch" as const,
    roi30d: 0.12,
    consistencyScore: 0.4,
    copyabilityScore: 0.55,
    oneHitWonderPenalty: 0.05,
    globalScore: 0.48,
    bestCategory: "Crypto",
    tradeCount30d: 18,
    winRate30d: 0.5,
  },
  {
    address: "0xDEMO0000000000000000000000000000000004",
    label: "DEMO DATA - OneHitWonder",
    sourceRank: 4,
    status: "watch" as const,
    roi30d: 0.45,
    consistencyScore: 0.2,
    copyabilityScore: 0.4,
    oneHitWonderPenalty: 0.45,
    globalScore: 0.32,
    bestCategory: "Crypto",
    tradeCount30d: 6,
    winRate30d: 0.33,
  },
  {
    address: "0xDEMO0000000000000000000000000000000005",
    label: "DEMO DATA - LowLiquidityLarry",
    sourceRank: 5,
    status: "ignore" as const,
    roi30d: -0.05,
    consistencyScore: 0.3,
    copyabilityScore: 0.25,
    oneHitWonderPenalty: 0,
    globalScore: 0.22,
    bestCategory: "Entertainment",
    tradeCount30d: 11,
    winRate30d: 0.36,
  },
];

async function seedWallets() {
  for (const w of DEMO_WALLETS) {
    await db
      .insert(walletProfiles)
      .values({
        ...w,
        categoryStrengthsJson: JSON.stringify([
          { category: w.bestCategory, tradeCount: w.tradeCount30d, winRate: w.winRate30d, averageReturn: w.roi30d, edgeScore: w.globalScore },
        ]),
        averageTradeSize: 250,
        resolvedTradeCount30d: Math.round(w.tradeCount30d * 0.8),
        averageLiquidity: 12000,
        averageSpread: 0.03,
        averageEntryTiming: 0.05,
        copyabilityNotes: "DEMO DATA - illustrative notes only.",
        riskNotes: w.oneHitWonderPenalty > 0.3 ? "DEMO DATA - high one-hit-wonder risk." : "DEMO DATA - no major flags.",
        lastScannedAt: nowSec,
        isDemoData: true,
      })
      .onConflictDoNothing();
  }
  logInfo(`[seed] Inserted ${DEMO_WALLETS.length} demo wallet profiles.`);
}

const DEMO_MARKETS = [
  { marketId: "demo-market-election-2024", question: "DEMO DATA - Will Candidate X win the election?", category: "Politics", liquidity: 45000, spread: 0.02, timeToResolution: 20 * 86400 },
  { marketId: "demo-market-superbowl", question: "DEMO DATA - Will Team A win the Super Bowl?", category: "Sports", liquidity: 30000, spread: 0.03, timeToResolution: 10 * 86400 },
  { marketId: "demo-market-btc-100k", question: "DEMO DATA - Will BTC hit $100k this month?", category: "Crypto", liquidity: 8000, spread: 0.06, timeToResolution: 5 * 86400 },
  { marketId: "demo-market-thin-liquidity", question: "DEMO DATA - Obscure micro-cap market", category: "Crypto", liquidity: 1200, spread: 0.15, timeToResolution: 2 * 86400 },
];

async function seedMarketSnapshots() {
  for (const m of DEMO_MARKETS) {
    const existing = await db.select().from(marketSnapshots).where(eq(marketSnapshots.marketId, m.marketId)).limit(1);
    if (existing.length > 0) continue;
    await db.insert(marketSnapshots).values({
      marketId: m.marketId,
      conditionId: `${m.marketId}-cond`,
      question: m.question,
      category: m.category,
      yesPrice: 0.55,
      noPrice: 0.45,
      bestBid: 0.54,
      bestAsk: 0.56,
      spread: m.spread,
      liquidity: m.liquidity,
      volume: m.liquidity * 3,
      timeToResolution: m.timeToResolution,
      rawMarketJson: JSON.stringify({ demo: true, ...m }),
      isDemoData: true,
    });
  }
  logInfo(`[seed] Inserted ${DEMO_MARKETS.length} demo market snapshots.`);
}

async function seedTradesDecisionsAndPaperTrades() {
  const scenarios = [
    {
      wallet: DEMO_WALLETS[0],
      market: DEMO_MARKETS[0],
      side: "YES" as const,
      entryPrice: 0.52,
      detectedPrice: 0.55,
      size: 300,
      decision: "paper_copy" as const,
      score: 0.78,
      confidence: 0.75,
      positionSize: 18,
    },
    {
      wallet: DEMO_WALLETS[1],
      market: DEMO_MARKETS[1],
      side: "NO" as const,
      entryPrice: 0.4,
      detectedPrice: 0.42,
      size: 500,
      decision: "paper_copy" as const,
      score: 0.69,
      confidence: 0.65,
      positionSize: 15,
    },
    {
      wallet: DEMO_WALLETS[2],
      market: DEMO_MARKETS[2],
      side: "YES" as const,
      entryPrice: 0.6,
      detectedPrice: 0.66,
      size: 150,
      decision: "watchlist" as const,
      score: 0.5,
      confidence: 0.55,
      positionSize: 0,
    },
    {
      wallet: DEMO_WALLETS[3],
      market: DEMO_MARKETS[2],
      side: "YES" as const,
      entryPrice: 0.3,
      detectedPrice: 0.5,
      size: 90,
      decision: "skip" as const,
      score: 0.28,
      confidence: 0.3,
      positionSize: 0,
    },
    {
      wallet: DEMO_WALLETS[4],
      market: DEMO_MARKETS[3],
      side: "NO" as const,
      entryPrice: 0.2,
      detectedPrice: 0.22,
      size: 60,
      decision: "skip" as const,
      score: 0.22,
      confidence: 0.25,
      positionSize: 0,
    },
  ];

  let paperTradeCount = 0;

  for (const [i, s] of scenarios.entries()) {
    const [trade] = await db
      .insert(observedTrades)
      .values({
        walletAddress: s.wallet.address,
        marketId: s.market.marketId,
        conditionId: `${s.market.marketId}-cond`,
        marketQuestion: s.market.question,
        marketCategory: s.market.category,
        outcome: s.side === "YES" ? "Yes" : "No",
        side: s.side,
        walletEntryPrice: s.entryPrice,
        detectedPrice: s.detectedPrice,
        size: s.size,
        timestamp: daysAgo(i + 1),
        rawTradeJson: JSON.stringify({ demo: true }),
        isDemoData: true,
      })
      .returning();

    const [journal] = await db
      .insert(decisionJournal)
      .values({
        observedTradeId: trade.id,
        walletAddress: s.wallet.address,
        marketId: s.market.marketId,
        decision: s.decision,
        copyScore: s.score,
        confidence: s.confidence,
        reasonsJson: JSON.stringify([`DEMO DATA - illustrative reason for ${s.decision}`]),
        risksJson: JSON.stringify(s.decision === "skip" ? ["DEMO DATA - illustrative risk flag"] : []),
        walletQualityScore: s.wallet.globalScore,
        roiScore: Math.min(1, Math.max(0, s.wallet.roi30d / 0.5)),
        consistencyScore: s.wallet.consistencyScore,
        copyabilityScore: s.wallet.copyabilityScore,
        categoryFitScore: 0.8,
        entryTimingScore: 0.7,
        spreadScore: 0.75,
        liquidityScore: 0.7,
        thesisScore: 0.72,
        simulatedPositionSize: s.positionSize,
        createdAt: daysAgo(i + 1),
        isDemoData: true,
      })
      .returning();

    if (s.decision === "paper_copy") {
      const currentPrice = s.detectedPrice + (i === 0 ? 0.04 : -0.03);
      const pnl = computePaperPnl({
        side: s.side,
        entryPrice: s.detectedPrice,
        currentPrice,
        simulatedPositionSize: s.positionSize,
      });

      const [paperTrade] = await db
        .insert(paperTrades)
        .values({
          decisionJournalId: journal.id,
          walletAddress: s.wallet.address,
          marketId: s.market.marketId,
          outcome: s.side === "YES" ? "Yes" : "No",
          side: s.side,
          entryPrice: s.detectedPrice,
          currentPrice,
          simulatedPositionSize: s.positionSize,
          unrealizedPnl: pnl,
          status: "open",
          openedAt: daysAgo(i + 1),
          isDemoData: true,
        })
        .returning();

      await db.insert(pnlSnapshots).values([
        { paperTradeId: paperTrade.id, price: s.detectedPrice, pnl: 0, collectedAt: daysAgo(i + 1) },
        { paperTradeId: paperTrade.id, price: currentPrice, pnl, collectedAt: nowSec },
      ]);

      paperTradeCount += 1;
    }
  }

  logInfo(`[seed] Inserted ${scenarios.length} demo observed trades + decisions, ${paperTradeCount} demo paper trades.`);
}

async function seedRuleSet() {
  const existing = await db.select().from(ruleSets).limit(1);
  if (existing.length > 0) {
    logInfo("[seed] RuleSet already exists, skipping.");
    return;
  }
  await db.insert(ruleSets).values({
    version: 1,
    active: true,
    rulesJson: JSON.stringify(DEFAULT_RULE_SET),
  });
  logInfo("[seed] Inserted initial RuleSet v1.");
}

async function seedDailyReports() {
  for (let i = 2; i >= 0; i--) {
    const date = new Date((nowSec - i * 86400) * 1000).toISOString().slice(0, 10);
    const existing = await db.select().from(dailyReports).where(eq(dailyReports.date, date)).limit(1);
    if (existing.length > 0) continue;

    await db.insert(dailyReports).values({
      date,
      paperPnl: [12.4, -3.1, 8.75][i] ?? 0,
      winRate: [0.6, 0.5, 0.67][i] ?? null,
      openPositions: 2,
      newSignals: 5,
      copiedSignals: 2,
      watchedSignals: 1,
      skippedSignals: 2,
      bestWalletsJson: JSON.stringify(DEMO_WALLETS.slice(0, 2).map((w) => ({ address: w.address, label: w.label, globalScore: w.globalScore }))),
      worstWalletsJson: JSON.stringify(DEMO_WALLETS.slice(-2).map((w) => ({ address: w.address, label: w.label, globalScore: w.globalScore }))),
      ruleChangesJson: JSON.stringify([]),
      summary: `DEMO DATA - illustrative daily summary for ${date}.`,
      sentToTelegram: false,
      createdAt: nowSec - i * 86400,
      isDemoData: true,
    });
  }
  logInfo("[seed] Inserted 3 demo daily reports.");
}

async function main() {
  logInfo("[seed] Seeding database with DEMO DATA (paper trading only, no real funds/API calls)...");
  await seedWallets();
  await seedMarketSnapshots();
  await seedTradesDecisionsAndPaperTrades();
  await seedRuleSet();
  await seedDailyReports();
  logInfo("[seed] Done.");
}

main().catch((err) => {
  console.error("[seed] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
