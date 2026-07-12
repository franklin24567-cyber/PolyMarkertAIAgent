import "dotenv/config";
/**
 * Review paper trades whose markets have resolved (or aged past 24h) and
 * record OutcomeReview entries capturing whether the original decision was
 * good - this is the feedback signal for self-improvement (updateRules.ts).
 */
import { eq, and, notInArray, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { paperTrades, outcomeReviews, decisionJournal } from "../lib/db/schema";
import { logInfo, logError } from "../lib/logger";

const ONE_HOUR = 3600;
const SIX_HOURS = 6 * 3600;
const TWENTY_FOUR_HOURS = 24 * 3600;

async function main() {
  const candidates = await db
    .select()
    .from(paperTrades)
    .where(
      and(
        notInArray(
          paperTrades.id,
          sql`(select paper_trade_id from outcome_reviews where paper_trade_id is not null)`
        )
      )
    );

  const nowSec = Math.floor(Date.now() / 1000);
  let reviewed = 0;

  for (const trade of candidates) {
    const ageSeconds = nowSec - trade.openedAt;
    const isResolved = trade.status === "resolved";
    if (!isResolved && ageSeconds < ONE_HOUR) continue;

    try {
      const journalRows = await db
        .select()
        .from(decisionJournal)
        .where(eq(decisionJournal.id, trade.decisionJournalId))
        .limit(1);
      const journal = journalRows[0];

      const finalOutcome = isResolved ? trade.outcome ?? "resolved" : "pending";
      const simulatedPnl = trade.realizedPnl ?? trade.unrealizedPnl ?? 0;
      const wasDecisionGood = simulatedPnl >= 0;

      const lessons: string[] = [];
      if (!wasDecisionGood && journal) {
        lessons.push(
          `Decision "${journal.decision}" with score ${journal.copyScore?.toFixed(2)} resulted in a loss (${simulatedPnl.toFixed(2)}).`
        );
      } else if (wasDecisionGood && journal) {
        lessons.push(`Decision "${journal.decision}" resulted in a gain (${simulatedPnl.toFixed(2)}).`);
      }

      await db.insert(outcomeReviews).values({
        decisionJournalId: trade.decisionJournalId,
        paperTradeId: trade.id,
        priceAfter1h: ageSeconds >= ONE_HOUR ? trade.currentPrice : null,
        priceAfter6h: ageSeconds >= SIX_HOURS ? trade.currentPrice : null,
        priceAfter24h: ageSeconds >= TWENTY_FOUR_HOURS ? trade.currentPrice : null,
        finalOutcome,
        simulatedPnl,
        wasDecisionGood,
        lessonsJson: JSON.stringify(lessons),
      });

      reviewed += 1;
    } catch (err) {
      logError(`[reviewOutcomes] Failed to review trade ${trade.id}:`, err instanceof Error ? err.message : String(err));
    }
  }

  logInfo(`[reviewOutcomes] Created ${reviewed} outcome reviews.`);
}

main().catch((err) => {
  logError("[reviewOutcomes] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
