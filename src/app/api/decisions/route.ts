import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { decisionJournal } from "@/lib/db/schema";


/** The full decision journal (reasoning behind every paper_copy/watchlist/skip). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

    const rows = await db.select().from(decisionJournal).orderBy(desc(decisionJournal.createdAt)).limit(limit);

    return NextResponse.json({
      isDemoData: rows.some((r) => r.isDemoData),
      decisions: rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching decision journal" },
      { status: 500 }
    );
  }
}
