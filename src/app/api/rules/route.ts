import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { ruleSets, ruleChanges } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Rule set versions and the audit trail of changes between them. */
export async function GET() {
  try {
    const sets = await db.select().from(ruleSets).orderBy(desc(ruleSets.version));
    const changes = await db.select().from(ruleChanges).orderBy(desc(ruleChanges.createdAt));

    return NextResponse.json({
      isDemoData: false,
      ruleSets: sets.map((s) => ({ ...s, rules: JSON.parse(s.rulesJson) })),
      ruleChanges: changes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching rules" },
      { status: 500 }
    );
  }
}
