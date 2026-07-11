/**
 * Paper trade PnL math. All values are SIMULATED - no real funds move.
 */

export interface PnlInputs {
  side: "YES" | "NO";
  entryPrice: number;
  currentPrice: number;
  simulatedPositionSize: number;
}

/**
 * Compute unrealized PnL for a simulated position.
 *
 * YES side: pnl = (currentPrice - entryPrice) * (size / entryPrice)
 * NO side:  pnl = (entryPrice - currentPrice) * (size / (1 - entryPrice))
 */
export function computePaperPnl({ side, entryPrice, currentPrice, simulatedPositionSize }: PnlInputs): number {
  if (entryPrice <= 0 || entryPrice >= 1) {
    throw new Error(`computePaperPnl: entryPrice must be between 0 and 1 (exclusive), got ${entryPrice}`);
  }
  if (currentPrice < 0 || currentPrice > 1) {
    throw new Error(`computePaperPnl: currentPrice must be between 0 and 1 (inclusive), got ${currentPrice}`);
  }
  if (side === "YES") {
    return (currentPrice - entryPrice) * (simulatedPositionSize / entryPrice);
  }
  return (entryPrice - currentPrice) * (simulatedPositionSize / (1 - entryPrice));
}
