import { desc, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { paperTrades, walletProfiles, decisionJournal, dailyReports, ruleChanges, pnlSnapshots } from "@/lib/db/schema";
import { KpiCard } from "@/components/KpiCard";
import { DemoDataBadge } from "@/components/StatusBadge";
import { PnlLineChart } from "@/components/charts/PnlLineChart";


async function getOverviewData() {
  const openTrades = await db.select().from(paperTrades).where(eq(paperTrades.status, "open"));
  const closedTrades = await db.select().from(paperTrades).where(eq(paperTrades.status, "resolved"));

  const totalPaperPnl =
    openTrades.reduce((sum, t) => sum + (t.unrealizedPnl ?? 0), 0) +
    closedTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);

  const wins = closedTrades.filter((t) => (t.realizedPnl ?? 0) >= 0).length;
  const winRate = closedTrades.length > 0 ? wins / closedTrades.length : null;

  const trackedWallets = await db.select().from(walletProfiles).where(eq(walletProfiles.status, "track"));

  const todayStart = Math.floor(new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime() / 1000);
  const decisions = await db.select().from(decisionJournal);
  const copyCandidatesToday = decisions.filter((d) => d.decision === "paper_copy" && d.createdAt >= todayStart).length;

  const latestReport = (await db.select().from(dailyReports).orderBy(desc(dailyReports.date)).limit(1))[0] ?? null;
  const latestRuleChanges = await db.select().from(ruleChanges).orderBy(desc(ruleChanges.createdAt)).limit(5);

  const snapshots = await db.select().from(pnlSnapshots).orderBy(asc(pnlSnapshots.collectedAt));
  const byDay = new Map<string, number>();
  for (const s of snapshots) {
    const day = new Date(s.collectedAt * 1000).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + s.pnl);
  }
  const pnlSeries = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date, pnl }));

  const isDemoData = openTrades.some((t) => t.isDemoData) || closedTrades.some((t) => t.isDemoData);

  return {
    totalPaperPnl,
    winRate,
    openPositionsCount: openTrades.length,
    trackedWalletCount: trackedWallets.length,
    copyCandidatesToday,
    latestReport,
    latestRuleChanges,
    pnlSeries,
    isDemoData,
  };
}

export default async function OverviewPage() {
  const data = await getOverviewData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Overview</h1>
        <DemoDataBadge isDemoData={data.isDemoData} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Paper PnL"
          value={`$${data.totalPaperPnl.toFixed(2)}`}
          trend={data.totalPaperPnl >= 0 ? "up" : "down"}
          hint="Simulated, not real funds"
        />
        <KpiCard
          label="Win Rate"
          value={data.winRate != null ? `${(data.winRate * 100).toFixed(0)}%` : "n/a"}
          hint="Resolved paper trades"
        />
        <KpiCard label="Open Positions" value={String(data.openPositionsCount)} />
        <KpiCard label="Tracked Wallets" value={String(data.trackedWalletCount)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Paper PnL Over Time</h2>
          <PnlLineChart data={data.pnlSeries} />
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Copy Candidates Today</h2>
            <div className="text-3xl font-semibold text-emerald-400">{data.copyCandidatesToday}</div>
            <p className="text-xs text-gray-500 mt-1">Trades scored &ldquo;paper_copy&rdquo; today</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <h2 className="text-sm font-medium text-gray-300 mb-3">End-of-Day Report</h2>
            {data.latestReport ? (
              <div className="text-sm text-gray-400 space-y-1">
                <div className="text-gray-200 font-medium">{data.latestReport.date}</div>
                <p className="text-xs leading-relaxed">{data.latestReport.summary}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">No reports generated yet. Run `npm run report:daily`.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Latest Rule Changes</h2>
        {data.latestRuleChanges.length === 0 ? (
          <p className="text-xs text-gray-500">No self-improvement rule changes yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.latestRuleChanges.map((change) => (
              <li key={change.id} className="text-xs text-gray-400 border-l-2 border-emerald-500/40 pl-3">
                <span className="text-gray-200">v{change.newRuleSetId}</span> — {change.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
