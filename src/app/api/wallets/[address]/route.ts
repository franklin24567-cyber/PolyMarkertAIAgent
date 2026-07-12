import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { walletProfiles, observedTrades, decisionJournal } from "@/lib/db/schema";

export async function generateStaticParams() {
  return [{ address: "placeholder" }];
}

/** Wallet profile detail, including recent observed trades and decisions. */
export async function GET(_request: Request, { params }: { params: { address: string } }) {
  try {
    const address = decodeURIComponent(params.address);
    const rows = await db.select().from(walletProfiles).where(eq(walletProfiles.address, address)).limit(1);
    const wallet = rows[0];

    if (!wallet) {
      return NextResponse.json({ error: `No wallet profile found for address ${address}` }, { status: 404 });
    }

    const trades = await db
      .select()
      .from(observedTrades)
      .where(eq(observedTrades.walletAddress, address))
      .orderBy(desc(observedTrades.timestamp))
      .limit(50);

    const decisions = await db
      .select()
      .from(decisionJournal)
      .where(eq(decisionJournal.walletAddress, address))
      .orderBy(desc(decisionJournal.createdAt))
      .limit(50);

    return NextResponse.json({
      isDemoData: wallet.isDemoData,
      wallet,
      recentTrades: trades,
      recentDecisions: decisions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error fetching wallet detail" },
      { status: 500 }
    );
  }
}
