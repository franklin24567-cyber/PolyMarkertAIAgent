import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { walletProfiles, observedTrades, decisionJournal } from "@/lib/db/schema";
import { StatusBadge, DemoDataBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";

export async function generateStaticParams() {
  return [{ address: "placeholder" }];
}

export default async function WalletDetailPage({ params }: { params: { address: string } }) {
  const address = decodeURIComponent(params.address);
  const rows = await db.select().from(walletProfiles).where(eq(walletProfiles.address, address)).limit(1);
  const wallet = rows[0];

  if (!wallet) {
    notFound();
  }

  const trades = await db
    .select()
    .from(observedTrades)
    .where(eq(observedTrades.walletAddress, address))
    .orderBy(desc(observedTrades.timestamp))
    .limit(25);

  const decisions = await db
    .select()
    .from(decisionJournal)
    .where(eq(decisionJournal.walletAddress, address))
    .orderBy(desc(decisionJournal.createdAt))
    .limit(25);

  const categoryStrengths = wallet.categoryStrengthsJson ? JSON.parse(wallet.categoryStrengthsJson) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">{wallet.label ?? wallet.address}</h1>
          <p className="text-xs text-gray-500 font-mono mt-1">{wallet.address}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={wallet.status} />
          <DemoDataBadge isDemoData={wallet.isDemoData} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Global Score" value={wallet.globalScore?.toFixed(2) ?? "—"} />
        <KpiCard label="ROI 30d" value={wallet.roi30d != null ? `${(wallet.roi30d * 100).toFixed(1)}%` : "—"} />
        <KpiCard label="Consistency" value={wallet.consistencyScore?.toFixed(2) ?? "—"} />
        <KpiCard label="Copyability" value={wallet.copyabilityScore?.toFixed(2) ?? "—"} />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Category Strengths</h2>
        {categoryStrengths.length === 0 ? (
          <p className="text-xs text-gray-500">No category data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categoryStrengths.map((c: { category: string; edgeScore: number }) => (
              <span key={c.category} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                {c.category}: {c.edgeScore.toFixed(2)}
              </span>
            ))}
          </div>
        )}
        {wallet.riskNotes && <p className="text-xs text-amber-400 mt-3">⚠ {wallet.riskNotes}</p>}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Recent Decisions</h2>
        <div className="space-y-2">
          {decisions.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs border-b border-gray-800/60 pb-2">
              <span className="text-gray-400">{d.marketId}</span>
              <span className="text-gray-500">score {d.copyScore.toFixed(2)}</span>
              <StatusBadge status={d.decision} />
            </div>
          ))}
          {decisions.length === 0 && <p className="text-xs text-gray-500">No decisions recorded yet.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Recent Observed Trades</h2>
        <div className="space-y-2">
          {trades.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs border-b border-gray-800/60 pb-2">
              <span className="text-gray-400">{t.marketQuestion ?? t.marketId}</span>
              <span className="text-gray-500">{t.side}</span>
              <span className="text-gray-500">${t.size.toFixed(0)}</span>
            </div>
          ))}
          {trades.length === 0 && <p className="text-xs text-gray-500">No observed trades yet.</p>}
        </div>
      </div>
    </div>
  );
}
