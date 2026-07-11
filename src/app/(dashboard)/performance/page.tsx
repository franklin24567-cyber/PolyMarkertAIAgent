import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { pnlSnapshots, paperTrades } from "@/lib/db/schema";
import { PnlLineChart } from "@/components/charts/PnlLineChart";
import { WinRateBarChart } from "@/components/charts/WinRateBarChart";
import { KpiCard } from "@/components/KpiCard";
import { DemoDataBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const snapshots = await db.select().from(pnlSnapshots).orderBy(asc(pnlSnapshots.collectedAt));
  const trades = await db.select().from(paperTrades);

  const byDay = new Map<string, number>();
  for (const s of snapshots) {
    const day = new Date(s.collectedAt * 1000).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + s.pnl);
  }
  const pnlSeries = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date, pnl }));

  const resolved = trades.filter((t) => t.status === "resolved");
  const wins = resolved.filter((t) => (t.realizedPnl ?? 0) >= 0).length;
  const losses = resolved.length - wins;
  const totalUnrealized = trades.filter((t) => t.status === "open").reduce((s, t) => s + (t.unrealizedPnl ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Performance</h1>
        <DemoDataBadge isDemoData={trades.some((t) => t.isDemoData)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Unrealized PnL (open)" value={`$${totalUnrealized.toFixed(2)}`} trend={totalUnrealized >= 0 ? "up" : "down"} />
        <KpiCard label="Resolved Wins" value={String(wins)} trend="up" />
        <KpiCard label="Resolved Losses" value={String(losses)} trend="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Paper PnL Over Time</h2>
          <PnlLineChart data={pnlSeries} />
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Win / Loss</h2>
          <WinRateBarChart wins={wins} losses={losses} />
        </div>
      </div>
    </div>
  );
}
