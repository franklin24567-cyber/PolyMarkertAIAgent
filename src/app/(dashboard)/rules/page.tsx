import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { ruleSets, ruleChanges } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const sets = await db.select().from(ruleSets).orderBy(desc(ruleSets.version));
  const changes = await db.select().from(ruleChanges).orderBy(desc(ruleChanges.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-100">Rules &amp; Self-Improvement</h1>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Rule Set Versions</h2>
        <div className="space-y-3">
          {sets.map((s) => {
            const rules = JSON.parse(s.rulesJson);
            return (
              <details key={s.id} className="rounded-lg border border-gray-800 p-3" open={s.active}>
                <summary className="cursor-pointer text-sm text-gray-200 flex items-center gap-2">
                  Version {s.version}
                  {s.active && (
                    <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px]">
                      ACTIVE
                    </span>
                  )}
                </summary>
                <pre className="text-xs text-gray-500 mt-2 overflow-x-auto">{JSON.stringify(rules, null, 2)}</pre>
              </details>
            );
          })}
          {sets.length === 0 && <p className="text-xs text-gray-500">No rule sets yet. Run `npm run seed`.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Rule Change History</h2>
        <div className="space-y-2">
          {changes.map((c) => (
            <div key={c.id} className="text-xs text-gray-400 border-l-2 border-sky-500/40 pl-3 py-1">
              <div className="text-gray-200">
                v{c.oldRuleSetId ?? "—"} → v{c.newRuleSetId} · by {c.changedBy}
              </div>
              <div>{c.reason}</div>
              {c.evidenceSummary && <div className="text-gray-600">Evidence: {c.evidenceSummary}</div>}
            </div>
          ))}
          {changes.length === 0 && (
            <p className="text-xs text-gray-500">No rule changes yet. Run `npm run update:rules` after some outcome reviews accumulate.</p>
          )}
        </div>
      </div>
    </div>
  );
}
