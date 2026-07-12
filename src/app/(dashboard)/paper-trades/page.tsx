import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { paperTrades } from "@/lib/db/schema";
import { StatusBadge, DemoDataBadge } from "@/components/StatusBadge";


export default async function PaperTradesPage() {
  const trades = await db.select().from(paperTrades).orderBy(desc(paperTrades.openedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Paper Trades</h1>
        <DemoDataBadge isDemoData={trades.some((t) => t.isDemoData)} />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-800">
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Entry</th>
              <th className="px-4 py-3 font-medium">Current</th>
              <th className="px-4 py-3 font-medium">Size (sim.)</th>
              <th className="px-4 py-3 font-medium">Unrealized PnL</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Opened</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-300">{t.marketId}</td>
                <td className="px-4 py-3">
                  <span className={t.side === "YES" ? "text-emerald-400" : "text-rose-400"}>{t.side}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">{t.entryPrice.toFixed(3)}</td>
                <td className="px-4 py-3 text-gray-400">{t.currentPrice?.toFixed(3) ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400">${t.simulatedPositionSize.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={(t.unrealizedPnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    ${(t.unrealizedPnl ?? 0).toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(t.openedAt * 1000).toLocaleString()}</td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No paper trades yet. Run `npm run score:trades` or `npm run seed`.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
