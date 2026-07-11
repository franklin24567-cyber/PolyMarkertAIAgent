import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { walletProfiles } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * List wallet profiles with basic pagination and status filtering.
 * Query params: page (1-based), pageSize, status (track|watch|ignore)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));
    const status = searchParams.get("status");

    let rows;
    if (status === "track" || status === "watch" || status === "ignore") {
      rows = await db
        .select()
        .from(walletProfiles)
        .where(eq(walletProfiles.status, status))
        .orderBy(desc(walletProfiles.globalScore))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    } else {
      rows = await db
        .select()
        .from(walletProfiles)
        .orderBy(desc(walletProfiles.globalScore))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    }

    return NextResponse.json({
      isDemoData: rows.some((r) => r.isDemoData),
      page,
      pageSize,
      wallets: rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching wallets" },
      { status: 500 }
    );
  }
}
