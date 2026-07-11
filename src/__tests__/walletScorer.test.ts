import {
  scoreWallet,
  scoreRoi,
  scoreConsistency,
  scoreOneHitWonderPenalty,
  scoreCopyability,
  scoreCategoryEdge,
  type WalletTradeRecord,
} from "@/lib/scoring/walletScorer";

function makeTrade(overrides: Partial<WalletTradeRecord>): WalletTradeRecord {
  return {
    pnl: 10,
    size: 100,
    category: "Politics",
    resolved: true,
    liquidity: 15000,
    spread: 0.02,
    entryTimingDelta: 0.02,
    ...overrides,
  };
}

describe("scoreRoi", () => {
  it("maps 0% ROI to 0", () => {
    expect(scoreRoi(0)).toBe(0);
  });

  it("maps 50% ROI to 1 (capped)", () => {
    expect(scoreRoi(0.5)).toBeCloseTo(1);
    expect(scoreRoi(1.0)).toBeCloseTo(1);
  });

  it("handles null/undefined gracefully", () => {
    expect(scoreRoi(null)).toBe(0);
    expect(scoreRoi(undefined)).toBe(0);
  });

  it("scales linearly between 0 and 50%", () => {
    expect(scoreRoi(0.25)).toBeCloseTo(0.5);
  });
});

describe("scoreConsistency", () => {
  it("returns 0 for fewer than 2 resolved trades", () => {
    expect(scoreConsistency([makeTrade({})])).toBe(0);
  });

  it("rewards stable returns over volatile ones", () => {
    const stable = [
      makeTrade({ pnl: 10, size: 100 }),
      makeTrade({ pnl: 12, size: 100 }),
      makeTrade({ pnl: 9, size: 100 }),
    ];
    const volatile = [
      makeTrade({ pnl: 90, size: 100 }),
      makeTrade({ pnl: -80, size: 100 }),
      makeTrade({ pnl: 5, size: 100 }),
    ];
    expect(scoreConsistency(stable)).toBeGreaterThan(scoreConsistency(volatile));
  });
});

describe("scoreOneHitWonderPenalty", () => {
  it("applies no penalty when profit is spread across trades", () => {
    const trades = [makeTrade({ pnl: 20 }), makeTrade({ pnl: 20 }), makeTrade({ pnl: 20 })];
    expect(scoreOneHitWonderPenalty(trades)).toBe(0);
  });

  it("applies a penalty when one trade is >50% of total profit", () => {
    const trades = [makeTrade({ pnl: 100 }), makeTrade({ pnl: 10 }), makeTrade({ pnl: 10 })];
    const penalty = scoreOneHitWonderPenalty(trades);
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThanOrEqual(0.5);
  });

  it("caps the penalty at 0.5 for an extreme one-hit-wonder", () => {
    const trades = [makeTrade({ pnl: 1000 }), makeTrade({ pnl: -5 })];
    expect(scoreOneHitWonderPenalty(trades)).toBe(0.5);
  });

  it("returns 0 when there is no positive profit at all", () => {
    expect(scoreOneHitWonderPenalty([makeTrade({ pnl: -10 }), makeTrade({ pnl: -5 })])).toBe(0);
  });
});

describe("scoreCopyability", () => {
  it("returns 0 for an empty trade list", () => {
    expect(scoreCopyability([])).toBe(0);
  });

  it("scores high-liquidity, tight-spread, fast-entry trades higher", () => {
    const good = [makeTrade({ liquidity: 20000, spread: 0.01, entryTimingDelta: 0.01 })];
    const bad = [makeTrade({ liquidity: 500, spread: 0.18, entryTimingDelta: 0.3 })];
    expect(scoreCopyability(good)).toBeGreaterThan(scoreCopyability(bad));
  });
});

describe("scoreCategoryEdge", () => {
  it("identifies the best category among several", () => {
    const trades = [
      ...Array.from({ length: 5 }, () => makeTrade({ category: "Politics", pnl: 20, size: 100 })),
      ...Array.from({ length: 5 }, () => makeTrade({ category: "Sports", pnl: -5, size: 100 })),
    ];
    const { bestCategory, categoryStrengths } = scoreCategoryEdge(trades);
    expect(bestCategory).toBe("Politics");
    expect(categoryStrengths.length).toBe(2);
  });
});

describe("scoreWallet (integration)", () => {
  it("produces a globalScore in [0,1] and penalizes one-hit-wonders", () => {
    const consistentTrades = Array.from({ length: 6 }, () => makeTrade({ pnl: 15, size: 100 }));
    const oneHitTrades = [makeTrade({ pnl: 500, size: 100 }), makeTrade({ pnl: 5, size: 100 }), makeTrade({ pnl: 5, size: 100 })];

    const consistentResult = scoreWallet(consistentTrades, { roi30d: 0.3 });
    const oneHitResult = scoreWallet(oneHitTrades, { roi30d: 0.3 });

    expect(consistentResult.globalScore).toBeGreaterThanOrEqual(0);
    expect(consistentResult.globalScore).toBeLessThanOrEqual(1);
    expect(oneHitResult.oneHitWonderPenalty).toBeGreaterThan(0);
    expect(consistentResult.globalScore).toBeGreaterThan(oneHitResult.globalScore);
  });
});
