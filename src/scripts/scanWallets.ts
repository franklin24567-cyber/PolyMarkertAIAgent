import "dotenv/config";
/**
 * Refresh trade history + scores for every tracked/watched wallet.
 *
 * PAPER TRADING ONLY. Read-only against the Polymarket data API.
 */
import { inArray, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { walletProfiles } from "../lib/db/schema";
import { fetchWalletTrades } from "../lib/adapters/polymarket";
import { scoreWallet, type WalletTradeRecord } from "../lib/scoring/walletScorer";
import { logInfo, logError } from "../lib/logger";

async function main() {
  const wallets = await db
    .select()
    .from(walletProfiles)
    .where(inArray(walletProfiles.status, ["track", "watch"]));

  logInfo(`[scanWallets] Scanning ${wallets.length} tracked/watched wallets...`);

  for (const wallet of wallets) {
    try {
      const activity = await fetchWalletTrades(wallet.address, 30, 500);

      const trades: WalletTradeRecord[] = activity.map((a) => ({
        pnl: typeof a.profit === "number" ? a.profit : 0,
        size: typeof a.size === "number" ? a.size : 0,
        category: typeof a.market === "string" ? a.market : undefined,
        resolved: true,
        liquidity: typeof a.liquidity === "number" ? a.liquidity : undefined,
        spread: typeof a.spread === "number" ? a.spread : undefined,
        timestamp: a.timestamp,
      }));

      const roi30d =
        trades.length > 0
          ? trades.reduce((sum, t) => sum + t.pnl, 0) / Math.max(1, trades.reduce((sum, t) => sum + t.size, 0))
          : null;

      const result = scoreWallet(trades, { roi30d });

      await db
        .update(walletProfiles)
        .set({
          roi30d,
          consistencyScore: result.consistencyScore,
          copyabilityScore: result.copyabilityScore,
          oneHitWonderPenalty: result.oneHitWonderPenalty,
          globalScore: result.globalScore,
          bestCategory: result.bestCategory,
          categoryStrengthsJson: JSON.stringify(result.categoryStrengths),
          tradeCount30d: trades.length,
          resolvedTradeCount30d: trades.filter((t) => t.resolved).length,
          averageTradeSize: trades.length ? trades.reduce((s, t) => s + t.size, 0) / trades.length : null,
          averageLiquidity: result.liquidityScore,
          lastScannedAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(walletProfiles.address, wallet.address));

      logInfo(`[scanWallets] Updated ${wallet.address}: globalScore=${result.globalScore.toFixed(2)}`);
    } catch (err) {
      logError(`[scanWallets] Failed to scan ${wallet.address}:`, err instanceof Error ? err.message : String(err));
    }
  }
}

main().catch((err) => {
  logError("[scanWallets] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
