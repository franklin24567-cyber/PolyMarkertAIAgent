import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { observedTrades } from "@/lib/db/schema";
import { DemoDataBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const trades = await db.select().from(observedTrades).orderBy(desc(observedTrades.timestamp)).limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Trade Signals</h1>
        <DemoDataBadge isDemoData={trades.some((t) => t.isDemoData)} />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-800">
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Entry Price</th>
              <th className="px-4 py-3 font-medium">Detected Price</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-300">{t.marketQuestion ?? t.marketId}</td>
                <td className="px-4 py-3 text-gray-500">{t.marketCategory ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {t.walletAddress.slice(0, 8)}...{t.walletAddress.slice(-4)}
                </td>
                <td className="px-4 py-3">
                  <span className={t.side === "YES" ? "text-emerald-400" : "text-rose-400"}>{t.side}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">{t.walletEntryPrice.toFixed(3)}</td>
                <td className="px-4 py-3 text-gray-400">{t.detectedPrice?.toFixed(3) ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400">${t.size.toFixed(0)}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(t.timestamp * 1000).toLocaleString()}</td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No trades observed yet. Run `npm run monitor:trades` or `npm run seed`.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
