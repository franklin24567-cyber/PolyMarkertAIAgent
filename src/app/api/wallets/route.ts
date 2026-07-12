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

    const rawPage = searchParams.get("page") ?? "1";
    const rawPageSize = searchParams.get("pageSize") ?? "25";
    const page = Number(rawPage);
    const pageSize = Number(rawPageSize);
    const status = searchParams.get("status");

    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: "pageSize must be an integer between 1 and 100" }, { status: 400 });
    }
    if (status !== null && status !== "track" && status !== "watch" && status !== "ignore") {
      return NextResponse.json({ error: "status must be one of: track, watch, ignore" }, { status: 400 });
    }

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
