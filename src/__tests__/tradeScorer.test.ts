import { scoreTrade, DEFAULT_RULE_SET, type WalletProfileInput, type ObservedTradeInput, type MarketSnapshotInput } from "@/lib/scoring/tradeScorer";

function goodWallet(): WalletProfileInput {
  return {
    roi30d: 0.3,
    consistencyScore: 0.8,
    copyabilityScore: 0.8,
    globalScore: 0.75,
    oneHitWonderPenalty: 0.05,
    bestCategory: "Politics",
    categoryStrengths: [{ category: "Politics", edgeScore: 0.8 }],
  };
}

function goodTrade(): ObservedTradeInput {
  return { marketCategory: "Politics", walletEntryPrice: 0.5, detectedPrice: 0.51, side: "YES" };
}

function goodMarket(): MarketSnapshotInput {
  return { spread: 0.02, liquidity: 20000, timeToResolution: 5 * 86400 };
}

describe("scoreTrade", () => {
  it("recommends paper_copy for a strong wallet + healthy market", () => {
    const result = scoreTrade(goodWallet(), goodTrade(), goodMarket());
    expect(result.decision).toBe("paper_copy");
    expect(result.score).toBeGreaterThan(0.6);
    expect(result.simulatedPositionSize).toBeGreaterThanOrEqual(DEFAULT_RULE_SET.minSimulatedPosition);
    expect(result.simulatedPositionSize).toBeLessThanOrEqual(DEFAULT_RULE_SET.maxSimulatedPosition);
  });

  it("skips when liquidity is below the minimum threshold", () => {
    const result = scoreTrade(goodWallet(), goodTrade(), { ...goodMarket(), liquidity: 100 });
    expect(result.decision).toBe("skip");
    expect(result.risks.some((r) => r.toLowerCase().includes("liquidity"))).toBe(true);
    expect(result.simulatedPositionSize).toBe(0);
  });

  it("skips when spread exceeds the maximum threshold", () => {
    const result = scoreTrade(goodWallet(), goodTrade(), { ...goodMarket(), spread: 0.5 });
    expect(result.decision).toBe("skip");
    expect(result.risks.some((r) => r.toLowerCase().includes("spread"))).toBe(true);
  });

  it("skips when price has moved too much since wallet entry", () => {
    const result = scoreTrade(goodWallet(), { ...goodTrade(), detectedPrice: 0.9 }, goodMarket());
    expect(result.decision).toBe("skip");
    expect(result.risks.some((r) => r.toLowerCase().includes("price moved"))).toBe(true);
  });

  it("skips when the market resolves too soon", () => {
    const result = scoreTrade(goodWallet(), goodTrade(), { ...goodMarket(), timeToResolution: 60 });
    expect(result.decision).toBe("skip");
  });

  it("skips low-quality wallets even in a good market", () => {
    const weakWallet: WalletProfileInput = {
      roi30d: 0.01,
      consistencyScore: 0.1,
      copyabilityScore: 0.2,
      globalScore: 0.1,
      oneHitWonderPenalty: 0.4,
      bestCategory: null,
    };
    const result = scoreTrade(weakWallet, goodTrade(), goodMarket());
    expect(result.decision).toBe("skip");
  });

  it("always returns reasons and risks arrays (never empty reasons)", () => {
    const result = scoreTrade(goodWallet(), goodTrade(), goodMarket());
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(Array.isArray(result.risks)).toBe(true);
  });

  it("never recommends paper_copy when hard risk gates are triggered, regardless of score", () => {
    const result = scoreTrade(goodWallet(), goodTrade(), { spread: 0.9, liquidity: 0, timeToResolution: 0 });
    expect(result.decision).toBe("skip");
    expect(result.risks.length).toBeGreaterThan(0);
  });
});
