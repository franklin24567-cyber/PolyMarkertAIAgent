import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { observedTrades } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Feed of observed trades from tracked/watched wallets. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

    const rows = await db.select().from(observedTrades).orderBy(desc(observedTrades.timestamp)).limit(limit);

    return NextResponse.json({
      isDemoData: rows.some((r) => r.isDemoData),
      trades: rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching trades" },
      { status: 500 }
    );
  }
}
