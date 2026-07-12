import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paperTrades } from "@/lib/db/schema";


/** List of simulated ("paper") trades. Query param: status (open|closed|resolved). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let rows;
    if (status === "open" || status === "closed" || status === "resolved") {
      rows = await db.select().from(paperTrades).where(eq(paperTrades.status, status)).orderBy(desc(paperTrades.openedAt));
    } else {
      rows = await db.select().from(paperTrades).orderBy(desc(paperTrades.openedAt));
    }

    return NextResponse.json({
      isDemoData: rows.some((r) => r.isDemoData),
      paperTrades: rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching paper trades" },
      { status: 500 }
    );
  }
}
