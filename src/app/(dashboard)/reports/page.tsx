import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyReports } from "@/lib/db/schema";
import { DemoDataBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await db.select().from(dailyReports).orderBy(desc(dailyReports.date)).limit(30);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Daily / Weekly Reports</h1>
        <DemoDataBadge isDemoData={reports.some((r) => r.isDemoData)} />
      </div>

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-200">{r.date}</div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className={r.paperPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>${r.paperPnl.toFixed(2)}</span>
                <span>{r.winRate != null ? `${(r.winRate * 100).toFixed(0)}% win rate` : "n/a win rate"}</span>
                <span>{r.openPositions} open</span>
                {r.sentToTelegram && <span className="text-sky-400">✓ sent to Telegram</span>}
              </div>
            </div>
            <p className="text-xs text-gray-400">{r.summary}</p>
            <div className="flex gap-4 mt-2 text-[11px] text-gray-500">
              <span>New: {r.newSignals}</span>
              <span>Copied: {r.copiedSignals}</span>
              <span>Watched: {r.watchedSignals}</span>
              <span>Skipped: {r.skippedSignals}</span>
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-8 text-center text-gray-500 text-sm">
            No reports yet. Run `npm run report:daily` or `npm run seed`.
          </div>
        )}
      </div>
    </div>
  );
}
