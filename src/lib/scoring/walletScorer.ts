/**
 * Wallet scoring: turns a wallet's trade history into a set of normalized
 * 0..1 scores used to decide whether the wallet is worth copy-trading.
 *
 * This module is pure/deterministic (no I/O) so it can be unit tested and
 * re-used both by the CLI scanners and by the self-improvement loop.
 */

export interface WalletTradeRecord {
  /** Realized profit in USD for a resolved trade (0 if unresolved/unknown). */
  pnl: number;
  /** Simulated/observed position size in USD. */
  size: number;
  /** Market category, e.g. "Politics", "Sports", "Crypto". */
  category?: string;
  /** Whether the underlying market has resolved. */
  resolved?: boolean;
  /** Liquidity available in the market at the time of the trade. */
  liquidity?: number;
  /** Bid/ask spread at the time of the trade (0..1). */
  spread?: number;
  /** Absolute price movement between wallet entry and our detection (0..1). */
  entryTimingDelta?: number;
  timestamp?: number;
}

export interface WalletScoringWeights {
  roiWeight: number;
  consistencyWeight: number;
  copyabilityWeight: number;
  categoryEdgeWeight: number;
  liquidityWeight: number;
}

export const DEFAULT_WALLET_WEIGHTS: WalletScoringWeights = {
  roiWeight: 0.3,
  consistencyWeight: 0.3,
  copyabilityWeight: 0.2,
  categoryEdgeWeight: 0.1,
  liquidityWeight: 0.1,
};

export interface CategoryStrength {
  category: string;
  tradeCount: number;
  winRate: number;
  averageReturn: number;
  edgeScore: number;
}

export interface WalletScoreResult {
  globalScore: number;
  roiScore: number;
  consistencyScore: number;
  copyabilityScore: number;
  oneHitWonderPenalty: number;
  liquidityScore: number;
  bestCategory: string | null;
  categoryStrengths: CategoryStrength[];
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

/**
 * Normalize a 30d ROI figure (e.g. 0.12 = +12%) into a 0..1 score.
 * ROI at or above +50% maps to a perfect score; 0% or below maps to 0.
 */
export function scoreRoi(roi30d: number | null | undefined): number {
  if (roi30d == null || Number.isNaN(roi30d)) return 0;
  return clamp01(roi30d / 0.5);
}

/**
 * Consistency: rewards wallets whose per-trade returns (pnl/size) don't
 * swing wildly. Computed as 1 minus the (clamped) coefficient of variation
 * of per-trade returns.
 */
export function scoreConsistency(trades: WalletTradeRecord[]): number {
  const resolved = trades.filter((t) => t.resolved !== false && t.size > 0);
  if (resolved.length < 2) return 0;
  const returns = resolved.map((t) => t.pnl / t.size);
  const spread = stdDev(returns);
  // A stddev of per-trade return >= 1.0 (i.e. swings of +/-100%) is treated
  // as maximally inconsistent.
  return clamp01(1 - spread);
}

/**
 * One-hit-wonder penalty: if a single trade accounts for the majority of a
 * wallet's total profit, its track record isn't reliably repeatable.
 * Returns a penalty in [0, 0.5] to subtract from the global score.
 */
export function scoreOneHitWonderPenalty(trades: WalletTradeRecord[]): number {
  const profits = trades.map((t) => t.pnl).filter((p) => p > 0);
  const totalProfit = profits.reduce((a, b) => a + b, 0);
  if (totalProfit <= 0 || profits.length === 0) return 0;
  const topTrade = Math.max(...profits);
  const share = topTrade / totalProfit;
  if (share <= 0.5) return 0;
  // Linearly scale: share of 0.5 -> penalty 0, share of 1.0 -> penalty 0.5
  return Math.min(0.5, share - 0.5);
}

/**
 * Copyability: how practical it would be to actually copy these trades -
 * based on typical liquidity, spread, and how much price moves between the
 * wallet's entry and when we'd detect/copy the trade.
 */
export function scoreCopyability(trades: WalletTradeRecord[]): number {
  if (trades.length === 0) return 0;
  const liquidityScores = trades.map((t) => clamp01((t.liquidity ?? 0) / 20000));
  const spreadScores = trades.map((t) => clamp01(1 - (t.spread ?? 0.1) / 0.2));
  const timingScores = trades.map((t) => clamp01(1 - (t.entryTimingDelta ?? 0.1) / 0.3));
  return clamp01(
    mean(liquidityScores) * 0.4 + mean(spreadScores) * 0.3 + mean(timingScores) * 0.3
  );
}

/** Average liquidity score alone (used as its own weighted component). */
export function scoreLiquidity(trades: WalletTradeRecord[]): number {
  if (trades.length === 0) return 0;
  return clamp01(mean(trades.map((t) => (t.liquidity ?? 0) / 20000)));
}

/**
 * Break trades down by category and find where this wallet has real edge
 * (a positive win rate and average return), requiring at least 3 trades in
 * a category to be considered.
 */
export function scoreCategoryEdge(trades: WalletTradeRecord[]): {
  categoryStrengths: CategoryStrength[];
  bestCategory: string | null;
  bestScore: number;
} {
  const byCategory = new Map<string, WalletTradeRecord[]>();
  for (const t of trades) {
    const cat = t.category ?? "Uncategorized";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(t);
  }

  const strengths: CategoryStrength[] = [];
  for (const [category, catTrades] of byCategory) {
    const resolved = catTrades.filter((t) => t.resolved !== false);
    const wins = resolved.filter((t) => t.pnl > 0).length;
    const winRate = resolved.length > 0 ? wins / resolved.length : 0;
    const avgReturn = mean(resolved.map((t) => (t.size > 0 ? t.pnl / t.size : 0)));
    const edgeScore = clamp01(winRate * 0.6 + clamp01(avgReturn) * 0.4);
    strengths.push({ category, tradeCount: catTrades.length, winRate, averageReturn: avgReturn, edgeScore });
  }

  strengths.sort((a, b) => b.edgeScore - a.edgeScore);
  const eligible = strengths.filter((s) => s.tradeCount >= 3);
  const best = eligible[0] ?? strengths[0] ?? null;

  return {
    categoryStrengths: strengths,
    bestCategory: best?.category ?? null,
    bestScore: best?.edgeScore ?? 0,
  };
}

/**
 * Combine all component scores into a single global 0..1 score for a
 * wallet, using the supplied (or default) weighting scheme.
 */
export function scoreWallet(
  trades: WalletTradeRecord[],
  profile: { roi30d?: number | null },
  weights: WalletScoringWeights = DEFAULT_WALLET_WEIGHTS
): WalletScoreResult {
  const roiScore = scoreRoi(profile.roi30d);
  const consistencyScore = scoreConsistency(trades);
  const copyabilityScore = scoreCopyability(trades);
  const liquidityScore = scoreLiquidity(trades);
  const oneHitWonderPenalty = scoreOneHitWonderPenalty(trades);
  const { categoryStrengths, bestCategory, bestScore } = scoreCategoryEdge(trades);

  const weighted =
    roiScore * weights.roiWeight +
    consistencyScore * weights.consistencyWeight +
    copyabilityScore * weights.copyabilityWeight +
    bestScore * weights.categoryEdgeWeight +
    liquidityScore * weights.liquidityWeight;

  const globalScore = clamp01(weighted - oneHitWonderPenalty);

  return {
    globalScore,
    roiScore,
    consistencyScore,
    copyabilityScore,
    oneHitWonderPenalty,
    liquidityScore,
    bestCategory,
    categoryStrengths,
  };
}
