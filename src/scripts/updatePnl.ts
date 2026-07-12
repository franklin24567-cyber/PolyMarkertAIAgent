import "dotenv/config";
/**
 * Refresh currentPrice + unrealizedPnl for every open PaperTrade, and
 * record a PnlSnapshot for charting. Simulated only - no real capital.
 */
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { paperTrades, pnlSnapshots, marketSnapshots } from "../lib/db/schema";
import { fetchMarket, fetchMarketPrice } from "../lib/adapters/polymarket";
import { computePaperPnl } from "../lib/pnl";
import { logInfo, logError } from "../lib/logger";

async function main() {
  const open = await db.select().from(paperTrades).where(eq(paperTrades.status, "open"));
  logInfo(`[updatePnl] Updating PnL for ${open.length} open paper trades...`);

  for (const trade of open) {
    try {
      const snapshot = (
        await db.select().from(marketSnapshots).where(eq(marketSnapshots.marketId, trade.marketId)).limit(1)
      )[0];

      let currentPrice = trade.currentPrice ?? trade.entryPrice;

      if (snapshot?.conditionId) {
        const market = await fetchMarket(snapshot.conditionId);
        const token = market.tokens?.find((t) => t.outcome === trade.side);
        if (token) {
          currentPrice = await fetchMarketPrice(token.token_id);
        }
      }

      const pnl = computePaperPnl({
        side: trade.side,
        entryPrice: trade.entryPrice,
        currentPrice,
        simulatedPositionSize: trade.simulatedPositionSize,
      });

      await db
        .update(paperTrades)
        .set({ currentPrice, unrealizedPnl: pnl })
        .where(eq(paperTrades.id, trade.id));

      await db.insert(pnlSnapshots).values({ paperTradeId: trade.id, price: currentPrice, pnl });

      logInfo(`[updatePnl] Trade ${trade.id}: price=${currentPrice.toFixed(3)} pnl=${pnl.toFixed(2)}`);
    } catch (err) {
      logError(`[updatePnl] Failed to update trade ${trade.id}:`, err instanceof Error ? err.message : String(err));
    }
  }
}

main().catch((err) => {
  logError("[updatePnl] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
