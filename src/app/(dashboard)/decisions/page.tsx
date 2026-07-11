import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { decisionJournal } from "@/lib/db/schema";
import { StatusBadge, DemoDataBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const decisions = await db.select().from(decisionJournal).orderBy(desc(decisionJournal.createdAt)).limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Decision Journal</h1>
        <DemoDataBadge isDemoData={decisions.some((d) => d.isDemoData)} />
      </div>

      <div className="space-y-3">
        {decisions.map((d) => {
          const reasons: string[] = d.reasonsJson ? JSON.parse(d.reasonsJson) : [];
          const risks: string[] = d.risksJson ? JSON.parse(d.risksJson) : [];
          return (
            <div key={d.id} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-200 font-medium">{d.marketId}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">score {d.copyScore.toFixed(2)}</span>
                  <span className="text-xs text-gray-500">confidence {d.confidence.toFixed(2)}</span>
                  <StatusBadge status={d.decision} />
                </div>
              </div>
              <p className="text-xs text-gray-500 font-mono mb-2">{d.walletAddress}</p>
              {reasons.length > 0 && (
                <div className="text-xs text-emerald-400 mb-1">
                  {reasons.map((r, i) => (
                    <div key={i}>✓ {r}</div>
                  ))}
                </div>
              )}
              {risks.length > 0 && (
                <div className="text-xs text-rose-400">
                  {risks.map((r, i) => (
                    <div key={i}>⚠ {r}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {decisions.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-8 text-center text-gray-500 text-sm">
            No decisions recorded yet. Run `npm run score:trades` or `npm run seed`.
          </div>
        )}
      </div>
    </div>
  );
}
