import fs from "fs";
import path from "path";

/**
 * Tests the RuleSet versioning contract: a new RuleSet is inserted with an
 * incremented version and marked active, the previous RuleSet is
 * deactivated, and a RuleChange audit row links the two with a reason.
 *
 * Uses a dedicated on-disk SQLite test database (created fresh in this
 * project's ./test-data directory, never /tmp) so it doesn't interfere with
 * the app's real polymarket-bot.db.
 */

const TEST_DB_PATH = path.join(process.cwd(), "test-data", "rule-versioning-test.db");

function cleanupDbFiles() {
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    const p = TEST_DB_PATH + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

describe("RuleSet versioning", () => {
  let db: typeof import("@/lib/db").db;
  let schema: typeof import("@/lib/db/schema");

  beforeAll(async () => {
    fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
    cleanupDbFiles();
    process.env.DATABASE_URL = TEST_DB_PATH;

    const dbModule = await import("@/lib/db");
    db = dbModule.db;
    schema = await import("@/lib/db/schema");

    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  });

  afterAll(() => {
    cleanupDbFiles();
  });

  it("starts with no rule sets", async () => {
    const rows = await db.select().from(schema.ruleSets);
    expect(rows.length).toBe(0);
  });

  it("inserts an initial active RuleSet v1", async () => {
    const { DEFAULT_RULE_SET } = await import("@/lib/scoring/tradeScorer");
    await db.insert(schema.ruleSets).values({
      version: 1,
      active: true,
      rulesJson: JSON.stringify(DEFAULT_RULE_SET),
    });

    const rows = await db.select().from(schema.ruleSets);
    expect(rows.length).toBe(1);
    expect(rows[0].version).toBe(1);
    expect(rows[0].active).toBe(true);
  });

  it("versions a new RuleSet, deactivates the old one, and logs a RuleChange", async () => {
    const { eq } = await import("drizzle-orm");

    const before = (await db.select().from(schema.ruleSets).where(eq(schema.ruleSets.active, true)))[0];
    expect(before.version).toBe(1);

    const newRules = { ...JSON.parse(before.rulesJson), maxSpread: 0.07 };

    await db.update(schema.ruleSets).set({ active: false }).where(eq(schema.ruleSets.active, true));

    const [newRuleSet] = await db
      .insert(schema.ruleSets)
      .values({ version: before.version + 1, active: true, rulesJson: JSON.stringify(newRules) })
      .returning();

    await db.insert(schema.ruleChanges).values({
      oldRuleSetId: before.id,
      newRuleSetId: newRuleSet.id,
      changedBy: "test-suite",
      reason: "Losing paper_copy trades had above-threshold spreads; tightening maxSpread.",
      evidenceSummary: "avgSpreadOfLosers=0.09 (previous maxSpread=0.08)",
      beforeJson: before.rulesJson,
      afterJson: JSON.stringify(newRules),
    });

    const allRuleSets = await db.select().from(schema.ruleSets);
    expect(allRuleSets.length).toBe(2);

    const activeRuleSets = allRuleSets.filter((r) => r.active);
    expect(activeRuleSets.length).toBe(1);
    expect(activeRuleSets[0].version).toBe(2);

    const changes = await db.select().from(schema.ruleChanges);
    expect(changes.length).toBe(1);
    expect(changes[0].oldRuleSetId).toBe(before.id);
    expect(changes[0].newRuleSetId).toBe(newRuleSet.id);
    expect(changes[0].reason).toContain("spread");
  });

  it("only ever has a single active RuleSet at a time", async () => {
    const rows = await db.select().from(schema.ruleSets);
    const activeCount = rows.filter((r) => r.active).length;
    expect(activeCount).toBe(1);
  });
});
