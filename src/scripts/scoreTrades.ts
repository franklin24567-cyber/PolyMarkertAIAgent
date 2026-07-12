import "dotenv/config";
/**
 * Score newly observed trades against the active RuleSet, write a
 * DecisionJournal entry for each, and open a PaperTrade for anything
 * decided "paper_copy". No real orders are ever placed.
 */
import { eq, notInArray, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { observedTrades, decisionJournal, paperTrades, walletProfiles, marketSnapshots } from "../lib/db/schema";
import { fetchMarket } from "../lib/adapters/polymarket";
import { scoreTrade } from "../lib/scoring/tradeScorer";
import { getActiveRuleSet } from "../lib/rules";
import { logInfo, logError } from "../lib/logger";

async function main() {
  const { rules } = await getActiveRuleSet();

  const unscored = await db
    .select()
    .from(observedTrades)
    .where(notInArray(observedTrades.id, sql`(select observed_trade_id from decision_journal)`));

  logInfo(`[scoreTrades] Found ${unscored.length} unscored observed trades.`);

  for (const trade of unscored) {
    try {
      const walletRows = await db.select().from(walletProfiles).where(eq(walletProfiles.address, trade.walletAddress)).limit(1);
      const wallet = walletRows[0];
      if (!wallet) {
        logError(`[scoreTrades] No wallet profile for ${trade.walletAddress}, skipping trade ${trade.id}`);
        continue;
      }

      let snapshot = (
        await db.select().from(marketSnapshots).where(eq(marketSnapshots.marketId, trade.marketId)).limit(1)
      )[0];

      if (!snapshot && trade.conditionId) {
        const market = await fetchMarket(trade.conditionId);
        const [inserted] = await db
          .insert(marketSnapshots)
          .values({
            marketId: trade.marketId,
            conditionId: trade.conditionId,
            question: market.question ?? trade.marketQuestion ?? null,
            category: market.category ?? trade.marketCategory ?? null,
            rawMarketJson: JSON.stringify(market),
          })
          .returning();
        snapshot = inserted;
      }

      const categoryStrengths = wallet.categoryStrengthsJson ? JSON.parse(wallet.categoryStrengthsJson) : undefined;

      const result = scoreTrade(
        {
          roi30d: wallet.roi30d,
          consistencyScore: wallet.consistencyScore,
          copyabilityScore: wallet.copyabilityScore,
          globalScore: wallet.globalScore,
          oneHitWonderPenalty: wallet.oneHitWonderPenalty,
          bestCategory: wallet.bestCategory,
          categoryStrengths,
        },
        {
          marketCategory: trade.marketCategory ?? snapshot?.category,
          walletEntryPrice: trade.walletEntryPrice,
          detectedPrice: trade.detectedPrice ?? trade.walletEntryPrice,
          side: trade.side,
        },
        {
          spread: snapshot?.spread ?? null,
          liquidity: snapshot?.liquidity ?? null,
          timeToResolution: snapshot?.timeToResolution ?? null,
        },
        rules
      );

      const [journalEntry] = await db
        .insert(decisionJournal)
        .values({
          observedTradeId: trade.id,
          walletAddress: trade.walletAddress,
          marketId: trade.marketId,
          decision: result.decision,
          copyScore: result.score,
          confidence: result.confidence,
          reasonsJson: JSON.stringify(result.reasons),
          risksJson: JSON.stringify(result.risks),
          walletQualityScore: result.breakdown.walletQualityScore,
          roiScore: result.breakdown.roiScore,
          consistencyScore: result.breakdown.consistencyScore,
          copyabilityScore: result.breakdown.copyabilityScore,
          categoryFitScore: result.breakdown.categoryFitScore,
          entryTimingScore: result.breakdown.entryTimingScore,
          spreadScore: result.breakdown.spreadScore,
          liquidityScore: result.breakdown.liquidityScore,
          thesisScore: result.breakdown.thesisScore,
          simulatedPositionSize: result.simulatedPositionSize,
          isDemoData: false,
        })
        .returning();

      if (result.decision === "paper_copy") {
        await db.insert(paperTrades).values({
          decisionJournalId: journalEntry.id,
          walletAddress: trade.walletAddress,
          marketId: trade.marketId,
          outcome: trade.outcome,
          side: trade.side,
          entryPrice: trade.detectedPrice ?? trade.walletEntryPrice,
          currentPrice: trade.detectedPrice ?? trade.walletEntryPrice,
          simulatedPositionSize: result.simulatedPositionSize,
          unrealizedPnl: 0,
          status: "open",
          isDemoData: false,
        });
      }

      logInfo(`[scoreTrades] Trade ${trade.id} -> ${result.decision} (score=${result.score.toFixed(2)})`);
    } catch (err) {
      logError(`[scoreTrades] Failed to score trade ${trade.id}:`, err instanceof Error ? err.message : String(err));
    }
  }
}

main().catch((err) => {
  logError("[scoreTrades] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
