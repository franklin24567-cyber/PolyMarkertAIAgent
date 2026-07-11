import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyReports } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Daily/weekly reports. Query param: limit (defaults to 30 days). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(90, Math.max(1, Number(searchParams.get("limit") ?? "30")));

    const rows = await db.select().from(dailyReports).orderBy(desc(dailyReports.date)).limit(limit);

    return NextResponse.json({
      isDemoData: rows.some((r) => r.isDemoData),
      reports: rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching reports" },
      { status: 500 }
    );
  }
}
