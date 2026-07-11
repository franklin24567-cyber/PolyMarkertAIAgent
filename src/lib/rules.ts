/**
 * Helpers for reading/writing the active RuleSet (the scoring thresholds
 * that drive decisions, and which the self-improvement loop can evolve).
 */
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { ruleSets } from "./db/schema";
import { DEFAULT_RULE_SET, type TradeScorerRuleSet } from "./scoring/tradeScorer";

export async function getActiveRuleSet(): Promise<{ id: number | null; version: number; rules: TradeScorerRuleSet }> {
  const active = await db.select().from(ruleSets).where(eq(ruleSets.active, true)).orderBy(desc(ruleSets.version)).limit(1);
  if (active.length === 0) {
    return { id: null, version: 0, rules: DEFAULT_RULE_SET };
  }
  const row = active[0];
  return { id: row.id, version: row.version, rules: JSON.parse(row.rulesJson) as TradeScorerRuleSet };
}

export async function ensureInitialRuleSet(): Promise<void> {
  const existing = await db.select().from(ruleSets).limit(1);
  if (existing.length > 0) return;
  await db.insert(ruleSets).values({
    version: 1,
    active: true,
    rulesJson: JSON.stringify(DEFAULT_RULE_SET),
  });
}
