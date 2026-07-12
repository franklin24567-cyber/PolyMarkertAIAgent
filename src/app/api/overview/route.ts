import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { paperTrades, walletProfiles, decisionJournal, dailyReports, ruleChanges } from "@/lib/db/schema";
import { startOfTodayUnix } from "@/lib/dateUtils";


/**
 * Aggregate stats for the dashboard overview page.
 */
export async function GET() {
  try {
    const openTrades = await db.select().from(paperTrades).where(eq(paperTrades.status, "open"));
    const closedTrades = await db.select().from(paperTrades).where(eq(paperTrades.status, "resolved"));

    const totalPaperPnl =
      openTrades.reduce((sum, t) => sum + (t.unrealizedPnl ?? 0), 0) +
      closedTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);

    const wins = closedTrades.filter((t) => (t.realizedPnl ?? 0) >= 0).length;
    const winRate = closedTrades.length > 0 ? wins / closedTrades.length : null;

    const trackedWallets = await db.select().from(walletProfiles).where(eq(walletProfiles.status, "track"));

    const todayStart = startOfTodayUnix();
    const decisionsToday = await db.select().from(decisionJournal);
    const copyCandidatesToday = decisionsToday.filter(
      (d) => d.decision === "paper_copy" && d.createdAt >= todayStart
    ).length;

    const latestReport = await db.select().from(dailyReports).orderBy(desc(dailyReports.date)).limit(1);
    const latestRuleChanges = await db.select().from(ruleChanges).orderBy(desc(ruleChanges.createdAt)).limit(5);

    const anyDemoData =
      openTrades.some((t) => t.isDemoData) ||
      closedTrades.some((t) => t.isDemoData) ||
      trackedWallets.some((w) => w.isDemoData);

    return NextResponse.json({
      isDemoData: anyDemoData,
      totalPaperPnl,
      winRate,
      openPositions: openTrades.length,
      trackedWalletCount: trackedWallets.length,
      copyCandidatesToday,
      latestReport: latestReport[0] ?? null,
      latestRuleChanges,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching overview" },
      { status: 500 }
    );
  }
}
