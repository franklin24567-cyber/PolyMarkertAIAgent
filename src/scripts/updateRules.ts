import "dotenv/config";
/**
 * Self-improvement loop: analyze the last 7 days of OutcomeReviews and
 * nudge scoring thresholds in the active RuleSet based on real losses.
 * Every change is versioned (new RuleSet row) and logged (RuleChange row)
 * with the evidence that justified it - this is fully auditable and never
 * touches trade execution, only future scoring behavior.
 */
import { desc, eq, gte } from "drizzle-orm";
import { db } from "../lib/db";
import { outcomeReviews, decisionJournal, observedTrades, marketSnapshots, ruleSets, ruleChanges } from "../lib/db/schema";
import { getActiveRuleSet, ensureInitialRuleSet } from "../lib/rules";
import { type TradeScorerRuleSet } from "../lib/scoring/tradeScorer";
import { logInfo, logError } from "../lib/logger";

const SEVEN_DAYS_SECONDS = 7 * 86400;

async function main() {
  await ensureInitialRuleSet();
  const { id: activeId, version: activeVersion, rules } = await getActiveRuleSet();

  const cutoff = Math.floor(Date.now() / 1000) - SEVEN_DAYS_SECONDS;
  const recentReviews = await db
    .select()
    .from(outcomeReviews)
    .where(gte(outcomeReviews.reviewTime, cutoff))
    .orderBy(desc(outcomeReviews.reviewTime));

  logInfo(`[updateRules] Analyzing ${recentReviews.length} outcome reviews from the last 7 days.`);

  const losingReviews = recentReviews.filter((r) => r.wasDecisionGood === false);

  if (losingReviews.length === 0) {
    logInfo("[updateRules] No losing paper_copy trades in the review window - no rule changes needed.");
    return;
  }

  const newRules: TradeScorerRuleSet = { ...rules };
  const evidence: string[] = [];
  const reasons: string[] = [];

  let spreadSum = 0;
  let spreadCount = 0;
  let liquiditySum = 0;
  let liquidityCount = 0;
  let lateEntryLosses = 0;

  for (const review of losingReviews) {
    const journalRows = await db
      .select()
      .from(decisionJournal)
      .where(eq(decisionJournal.id, review.decisionJournalId))
      .limit(1);
    const journal = journalRows[0];
    if (!journal || journal.decision !== "paper_copy") continue;

    const tradeRows = await db.select().from(observedTrades).where(eq(observedTrades.id, journal.observedTradeId)).limit(1);
    const trade = tradeRows[0];
    if (!trade) continue;

    const snapshotRows = await db.select().from(marketSnapshots).where(eq(marketSnapshots.marketId, trade.marketId)).limit(1);
    const snapshot = snapshotRows[0];

    if (snapshot?.spread != null) {
      spreadSum += snapshot.spread;
      spreadCount += 1;
    }
    if (snapshot?.liquidity != null) {
      liquiditySum += snapshot.liquidity;
      liquidityCount += 1;
    }

    const priceMovement = Math.abs((trade.detectedPrice ?? trade.walletEntryPrice) - trade.walletEntryPrice);
    if (priceMovement > rules.maxPriceMovementSinceEntry) {
      lateEntryLosses += 1;
    }
  }

  if (spreadCount > 0) {
    const avgSpread = spreadSum / spreadCount;
    if (avgSpread > rules.maxSpread) {
      newRules.maxSpread = Math.max(0.01, +(rules.maxSpread - 0.01).toFixed(3));
      reasons.push("Losing paper_copy trades had above-threshold spreads; tightening maxSpread.");
      evidence.push(`avgSpreadOfLosers=${avgSpread.toFixed(4)} (previous maxSpread=${rules.maxSpread})`);
    }
  }

  if (liquidityCount > 0) {
    const avgLiquidity = liquiditySum / liquidityCount;
    if (avgLiquidity < rules.minLiquidity) {
      newRules.minLiquidity = Math.round(rules.minLiquidity * 1.1);
      reasons.push("Losing paper_copy trades had below-threshold liquidity; raising minLiquidity by 10%.");
      evidence.push(`avgLiquidityOfLosers=${avgLiquidity.toFixed(0)} (previous minLiquidity=${rules.minLiquidity})`);
    }
  }

  if (lateEntryLosses >= 2) {
    newRules.maxPriceMovementSinceEntry = Math.max(0.05, +(rules.maxPriceMovementSinceEntry - 0.02).toFixed(3));
    reasons.push("Multiple losses came from late entries (large price movement since wallet's entry); lowering maxPriceMovementSinceEntry.");
    evidence.push(`lateEntryLossCount=${lateEntryLosses} (previous maxPriceMovementSinceEntry=${rules.maxPriceMovementSinceEntry})`);
  }

  if (reasons.length === 0) {
    logInfo("[updateRules] Losses did not trigger any known adjustment heuristic - no rule changes made.");
    return;
  }

  const newVersion = activeVersion + 1;

  await db.update(ruleSets).set({ active: false }).where(eq(ruleSets.active, true));

  const [newRuleSet] = await db
    .insert(ruleSets)
    .values({
      version: newVersion,
      active: true,
      rulesJson: JSON.stringify(newRules),
    })
    .returning();

  await db.insert(ruleChanges).values({
    oldRuleSetId: activeId,
    newRuleSetId: newRuleSet.id,
    changedBy: "hermes-self-improvement",
    reason: reasons.join(" "),
    evidenceSummary: evidence.join("; "),
    beforeJson: JSON.stringify(rules),
    afterJson: JSON.stringify(newRules),
  });

  logInfo(`[updateRules] Created RuleSet v${newVersion}. Reasons: ${reasons.join(" | ")}`);
}

main().catch((err) => {
  logError("[updateRules] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
