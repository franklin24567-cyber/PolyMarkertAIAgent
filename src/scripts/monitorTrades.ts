import "dotenv/config";
/**
 * Poll tracked wallets for new trades and record them as ObservedTrade rows
 * (deduped by wallet+market+timestamp). This is purely observational -
 * nothing here places any order.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { walletProfiles, observedTrades } from "../lib/db/schema";
import { fetchWalletTrades } from "../lib/adapters/polymarket";
import { logInfo, logError } from "../lib/logger";

async function main() {
  const tracked = await db.select().from(walletProfiles).where(eq(walletProfiles.status, "track"));
  logInfo(`[monitorTrades] Monitoring ${tracked.length} tracked wallets for new trades...`);

  let newTradeCount = 0;

  for (const wallet of tracked) {
    try {
      const activity = await fetchWalletTrades(wallet.address, 1, 100);

      for (const a of activity) {
        const marketId = typeof a.market === "string" ? a.market : a.conditionId ?? "unknown";
        const timestamp = a.timestamp ?? Math.floor(Date.now() / 1000);

        const dupe = await db
          .select()
          .from(observedTrades)
          .where(
            and(
              eq(observedTrades.walletAddress, wallet.address),
              eq(observedTrades.marketId, marketId),
              eq(observedTrades.timestamp, timestamp)
            )
          )
          .limit(1);

        if (dupe.length > 0) continue;

        await db.insert(observedTrades).values({
          walletAddress: wallet.address,
          marketId,
          conditionId: a.conditionId,
          marketQuestion: typeof a.market === "string" ? a.market : null,
          outcome: a.outcome ?? null,
          side: (a.side === "NO" ? "NO" : "YES") as "YES" | "NO",
          walletEntryPrice: typeof a.price === "number" ? a.price : 0,
          detectedPrice: typeof a.price === "number" ? a.price : null,
          size: typeof a.size === "number" ? a.size : 0,
          timestamp,
          rawTradeJson: JSON.stringify(a),
          isDemoData: false,
        });
        newTradeCount += 1;
      }
    } catch (err) {
      logError(`[monitorTrades] Failed to poll ${wallet.address}:`, err instanceof Error ? err.message : String(err));
    }
  }

  logInfo(`[monitorTrades] Recorded ${newTradeCount} new observed trades.`);
}

main().catch((err) => {
  logError("[monitorTrades] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
