import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { pnlSnapshots, paperTrades } from "@/lib/db/schema";
import { timestampToDateString } from "@/lib/dateUtils";


/** PnL time series + win-rate breakdown for performance charts. */
export async function GET() {
  try {
    const snapshots = await db.select().from(pnlSnapshots).orderBy(asc(pnlSnapshots.collectedAt));
    const trades = await db.select().from(paperTrades);

    const byDay = new Map<string, number>();
    for (const s of snapshots) {
      const day = timestampToDateString(s.collectedAt);
      byDay.set(day, (byDay.get(day) ?? 0) + s.pnl);
    }
    const pnlSeries = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pnl]) => ({ date, pnl }));

    const resolved = trades.filter((t) => t.status === "resolved");
    const wins = resolved.filter((t) => (t.realizedPnl ?? 0) >= 0).length;
    const losses = resolved.length - wins;

    return NextResponse.json({
      isDemoData: trades.some((t) => t.isDemoData),
      pnlSeries,
      winLoss: { wins, losses, winRate: resolved.length > 0 ? wins / resolved.length : null },
      totalUnrealizedPnl: trades
        .filter((t) => t.status === "open")
        .reduce((sum, t) => sum + (t.unrealizedPnl ?? 0), 0),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching performance data" },
      { status: 500 }
    );
  }
}
