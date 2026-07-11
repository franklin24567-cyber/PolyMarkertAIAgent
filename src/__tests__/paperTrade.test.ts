import { computePaperPnl } from "@/lib/pnl";

describe("computePaperPnl", () => {
  it("computes positive PnL for a winning YES position", () => {
    const pnl = computePaperPnl({ side: "YES", entryPrice: 0.5, currentPrice: 0.6, simulatedPositionSize: 10 });
    // (0.6 - 0.5) * (10 / 0.5) = 0.1 * 20 = 2
    expect(pnl).toBeCloseTo(2);
  });

  it("computes negative PnL for a losing YES position", () => {
    const pnl = computePaperPnl({ side: "YES", entryPrice: 0.5, currentPrice: 0.4, simulatedPositionSize: 10 });
    expect(pnl).toBeCloseTo(-2);
  });

  it("computes positive PnL for a winning NO position", () => {
    // NO side profits when price falls
    const pnl = computePaperPnl({ side: "NO", entryPrice: 0.4, currentPrice: 0.3, simulatedPositionSize: 10 });
    // (0.4 - 0.3) * (10 / (1-0.4)) = 0.1 * 16.667 = 1.667
    expect(pnl).toBeCloseTo(1.6667, 3);
  });

  it("computes negative PnL for a losing NO position", () => {
    const pnl = computePaperPnl({ side: "NO", entryPrice: 0.4, currentPrice: 0.5, simulatedPositionSize: 10 });
    expect(pnl).toBeCloseTo(-1.6667, 3);
  });

  it("returns 0 PnL when price hasn't moved", () => {
    expect(computePaperPnl({ side: "YES", entryPrice: 0.5, currentPrice: 0.5, simulatedPositionSize: 10 })).toBeCloseTo(0);
    expect(computePaperPnl({ side: "NO", entryPrice: 0.5, currentPrice: 0.5, simulatedPositionSize: 10 })).toBeCloseTo(0);
  });

  it("throws for an invalid entry price (0 or 1)", () => {
    expect(() => computePaperPnl({ side: "YES", entryPrice: 0, currentPrice: 0.5, simulatedPositionSize: 10 })).toThrow();
    expect(() => computePaperPnl({ side: "YES", entryPrice: 1, currentPrice: 0.5, simulatedPositionSize: 10 })).toThrow();
  });

  it("scales PnL proportionally with position size", () => {
    const small = computePaperPnl({ side: "YES", entryPrice: 0.5, currentPrice: 0.6, simulatedPositionSize: 10 });
    const large = computePaperPnl({ side: "YES", entryPrice: 0.5, currentPrice: 0.6, simulatedPositionSize: 20 });
    expect(large).toBeCloseTo(small * 2);
  });
});
