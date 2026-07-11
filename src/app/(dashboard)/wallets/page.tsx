import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { walletProfiles } from "@/lib/db/schema";
import { StatusBadge, DemoDataBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function WalletsPage() {
  const wallets = await db.select().from(walletProfiles).orderBy(desc(walletProfiles.globalScore));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Wallet Rankings</h1>
        <DemoDataBadge isDemoData={wallets.some((w) => w.isDemoData)} />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-800">
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">ROI 30d</th>
              <th className="px-4 py-3 font-medium">Consistency</th>
              <th className="px-4 py-3 font-medium">Copyability</th>
              <th className="px-4 py-3 font-medium">1-Hit Penalty</th>
              <th className="px-4 py-3 font-medium">Best Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.id} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <Link href={`/wallets/${encodeURIComponent(w.address)}`} className="text-sky-400 hover:underline">
                    {w.label ?? `${w.address.slice(0, 8)}...${w.address.slice(-4)}`}
                  </Link>
                  {w.isDemoData && <span className="ml-2 text-[10px] text-fuchsia-400">DEMO</span>}
                </td>
                <td className="px-4 py-3 text-gray-400">{w.sourceRank ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={w.roi30d != null && w.roi30d >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {w.roi30d != null ? `${(w.roi30d * 100).toFixed(1)}%` : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{w.consistencyScore?.toFixed(2) ?? "—"}</td>
                <td className="px-4 py-3 text-gray-300">{w.copyabilityScore?.toFixed(2) ?? "—"}</td>
                <td className="px-4 py-3 text-gray-300">{w.oneHitWonderPenalty?.toFixed(2) ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400">{w.bestCategory ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={w.status} />
                </td>
              </tr>
            ))}
            {wallets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No wallets yet. Run `npm run scan:leaderboard` or `npm run seed`.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
