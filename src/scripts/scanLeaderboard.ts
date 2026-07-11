import "dotenv/config";
/**
 * Scan the Polymarket leaderboard, record a LeaderboardScan, and upsert
 * WalletProfile rows for every wallet found (defaulting new wallets to
 * "watch" status - nothing is auto-promoted to "track").
 *
 * PAPER TRADING ONLY. This script only reads public leaderboard data; it
 * never touches funds or private keys.
 */
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { leaderboardScans, walletProfiles } from "../lib/db/schema";
import { fetchLeaderboard } from "../lib/adapters/polymarket";
import { logInfo, logError } from "../lib/logger";

async function main() {
  logInfo("[scanLeaderboard] Fetching Polymarket leaderboard (window=30d)...");
  const entries = await fetchLeaderboard("30d", 500);
  logInfo(`[scanLeaderboard] Retrieved ${entries.length} leaderboard entries.`);

  await db.insert(leaderboardScans).values({
    source: "polymarket-data-api",
    walletCount: entries.length,
    lookbackDays: 30,
    rawSummaryJson: JSON.stringify(entries.slice(0, 10)),
  });

  let created = 0;
  let updated = 0;

  for (const [index, entry] of entries.entries()) {
    const address = entry.proxyWallet;
    if (!address) continue;

    const existing = await db.select().from(walletProfiles).where(eq(walletProfiles.address, address)).limit(1);

    if (existing.length === 0) {
      await db.insert(walletProfiles).values({
        address,
        label: typeof entry.name === "string" ? entry.name : null,
        sourceRank: index + 1,
        status: "watch",
        isDemoData: false,
      });
      created += 1;
    } else {
      await db
        .update(walletProfiles)
        .set({ sourceRank: index + 1, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(walletProfiles.address, address));
      updated += 1;
    }
  }

  logInfo(`[scanLeaderboard] Done. Created ${created} new wallet profiles, updated ${updated} existing.`);
}

main().catch((err) => {
  logError("[scanLeaderboard] FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
