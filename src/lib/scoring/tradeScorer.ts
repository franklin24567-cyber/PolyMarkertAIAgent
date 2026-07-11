/**
 * Trade scoring: given a wallet's profile, a specific observed trade, and a
 * snapshot of the market it was placed in, decide whether we should
 * "paper_copy" it, put it on the "watchlist", or "skip" it entirely.
 *
 * Pure/deterministic (no I/O, no timers) so it can be unit tested directly
 * and re-used by the self-improvement loop when replaying history.
 */
import { scoreRoi } from "./walletScorer";

export interface TradeScorerRuleSet {
  minRoi30d: number;
  minConsistencyScore: number;
  minCopyabilityScore: number;
  maxOneHitWonderPenalty: number;
  minGlobalScore: number;
  minLiquidity: number;
  maxSpread: number;
  maxPriceMovementSinceEntry: number;
  minTimeToResolution: number;
  minSimulatedPosition: number;
  maxSimulatedPosition: number;
  consistencyWeight: number;
  roiWeight: number;
  copyabilityWeight: number;
  categoryEdgeWeight: number;
  liquidityWeight: number;
}

export const DEFAULT_RULE_SET: TradeScorerRuleSet = {
  minRoi30d: 0.05,
  minConsistencyScore: 0.4,
  minCopyabilityScore: 0.5,
  maxOneHitWonderPenalty: 0.3,
  minGlobalScore: 0.5,
  minLiquidity: 5000,
  maxSpread: 0.08,
  maxPriceMovementSinceEntry: 0.15,
  minTimeToResolution: 86400,
  minSimulatedPosition: 5,
  maxSimulatedPosition: 20,
  consistencyWeight: 0.3,
  roiWeight: 0.3,
  copyabilityWeight: 0.2,
  categoryEdgeWeight: 0.1,
  liquidityWeight: 0.1,
};

export interface WalletProfileInput {
  roi30d: number | null;
  consistencyScore: number | null;
  copyabilityScore: number | null;
  globalScore: number | null;
  oneHitWonderPenalty: number | null;
  bestCategory: string | null;
  categoryStrengths?: Array<{ category: string; edgeScore: number }>;
}

export interface ObservedTradeInput {
  marketCategory?: string | null;
  walletEntryPrice: number;
  detectedPrice: number;
  side: "YES" | "NO";
}

export interface MarketSnapshotInput {
  spread: number | null;
  liquidity: number | null;
  timeToResolution: number | null;
}

export type TradeDecision = "paper_copy" | "watchlist" | "skip";

export interface TradeScoreBreakdown {
  walletQualityScore: number;
  roiScore: number;
  consistencyScore: number;
  copyabilityScore: number;
  categoryFitScore: number;
  entryTimingScore: number;
  spreadScore: number;
  liquidityScore: number;
  thesisScore: number;
}

export interface TradeScoreResult {
  score: number;
  confidence: number;
  decision: TradeDecision;
  reasons: string[];
  risks: string[];
  breakdown: TradeScoreBreakdown;
  simulatedPositionSize: number;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

function categoryFit(
  observedCategory: string | null | undefined,
  bestCategory: string | null,
  categoryStrengths?: Array<{ category: string; edgeScore: number }>
): number {
  if (!observedCategory) return 0.3;
  if (bestCategory && observedCategory === bestCategory) return 1;
  const match = categoryStrengths?.find((c) => c.category === observedCategory);
  return match ? clamp01(match.edgeScore) : 0.3;
}

export function scoreTrade(
  walletProfile: WalletProfileInput,
  observedTrade: ObservedTradeInput,
  marketSnapshot: MarketSnapshotInput,
  ruleSet: TradeScorerRuleSet = DEFAULT_RULE_SET
): TradeScoreResult {
  const reasons: string[] = [];
  const risks: string[] = [];

  const walletQualityScore = clamp01(walletProfile.globalScore ?? 0);
  const roiScore = scoreRoi(walletProfile.roi30d);
  const consistencyScore = clamp01(walletProfile.consistencyScore ?? 0);
  const copyabilityScore = clamp01(walletProfile.copyabilityScore ?? 0);
  const categoryFitScore = categoryFit(
    observedTrade.marketCategory,
    walletProfile.bestCategory,
    walletProfile.categoryStrengths
  );

  const priceMovement = Math.abs(observedTrade.detectedPrice - observedTrade.walletEntryPrice);
  const entryTimingScore = clamp01(1 - priceMovement / ruleSet.maxPriceMovementSinceEntry);

  const spread = marketSnapshot.spread ?? ruleSet.maxSpread * 2;
  const spreadScore = clamp01(1 - spread / ruleSet.maxSpread);

  const liquidity = marketSnapshot.liquidity ?? 0;
  const liquidityScore = clamp01(liquidity / (ruleSet.minLiquidity * 2));

  const thesisScore = clamp01((consistencyScore + copyabilityScore) / 2);

  const breakdown: TradeScoreBreakdown = {
    walletQualityScore,
    roiScore,
    consistencyScore,
    copyabilityScore,
    categoryFitScore,
    entryTimingScore,
    spreadScore,
    liquidityScore,
    thesisScore,
  };

  const weightSum =
    0.25 + // fixed weight on wallet quality
    ruleSet.roiWeight +
    ruleSet.categoryEdgeWeight +
    0.15 + // fixed weight on entry timing
    0.1 + // fixed weight on spread
    ruleSet.liquidityWeight +
    (ruleSet.consistencyWeight + ruleSet.copyabilityWeight) / 2;

  const rawScore =
    walletQualityScore * 0.25 +
    roiScore * ruleSet.roiWeight +
    categoryFitScore * ruleSet.categoryEdgeWeight +
    entryTimingScore * 0.15 +
    spreadScore * 0.1 +
    liquidityScore * ruleSet.liquidityWeight +
    thesisScore * ((ruleSet.consistencyWeight + ruleSet.copyabilityWeight) / 2);

  const score = clamp01(rawScore / weightSum);
  const confidence = clamp01((walletQualityScore + categoryFitScore + thesisScore) / 3);

  // --- Hard "must skip" risk gates ---
  let hardSkip = false;

  if ((walletProfile.globalScore ?? 0) < ruleSet.minGlobalScore) {
    hardSkip = true;
    risks.push(
      `Wallet global score ${(walletProfile.globalScore ?? 0).toFixed(2)} is below minimum ${ruleSet.minGlobalScore}`
    );
  }
  if ((walletProfile.oneHitWonderPenalty ?? 0) > ruleSet.maxOneHitWonderPenalty) {
    hardSkip = true;
    risks.push(
      `One-hit-wonder penalty ${(walletProfile.oneHitWonderPenalty ?? 0).toFixed(2)} exceeds max ${ruleSet.maxOneHitWonderPenalty}`
    );
  }
  if (liquidity < ruleSet.minLiquidity) {
    hardSkip = true;
    risks.push(`Market liquidity $${liquidity.toFixed(0)} is below minimum $${ruleSet.minLiquidity}`);
  }
  if (spread > ruleSet.maxSpread) {
    hardSkip = true;
    risks.push(`Spread ${spread.toFixed(3)} exceeds max allowed ${ruleSet.maxSpread}`);
  }
  if (priceMovement > ruleSet.maxPriceMovementSinceEntry) {
    hardSkip = true;
    risks.push(
      `Price moved ${(priceMovement * 100).toFixed(1)}% since wallet entry, exceeding max ${(ruleSet.maxPriceMovementSinceEntry * 100).toFixed(1)}%`
    );
  }
  if ((marketSnapshot.timeToResolution ?? 0) < ruleSet.minTimeToResolution) {
    hardSkip = true;
    risks.push(`Market resolves too soon (< ${ruleSet.minTimeToResolution / 3600}h remaining)`);
  }

  if ((walletProfile.roi30d ?? 0) < ruleSet.minRoi30d) {
    risks.push(`Wallet 30d ROI ${(walletProfile.roi30d ?? 0).toFixed(2)} is below minimum ${ruleSet.minRoi30d}`);
  }
  if (consistencyScore < ruleSet.minConsistencyScore) {
    risks.push(`Consistency score ${consistencyScore.toFixed(2)} is below minimum ${ruleSet.minConsistencyScore}`);
  }
  if (copyabilityScore < ruleSet.minCopyabilityScore) {
    risks.push(`Copyability score ${copyabilityScore.toFixed(2)} is below minimum ${ruleSet.minCopyabilityScore}`);
  }

  if (walletQualityScore >= ruleSet.minGlobalScore) {
    reasons.push(`Wallet global score ${walletQualityScore.toFixed(2)} meets bar`);
  }
  if (categoryFitScore >= 0.7) {
    reasons.push(`Strong category fit (${observedTrade.marketCategory ?? "unknown"})`);
  }
  if (entryTimingScore >= 0.7) {
    reasons.push("Detected trade close to wallet's original entry price");
  }
  if (liquidityScore >= 0.7) {
    reasons.push("Healthy market liquidity");
  }
  if (spreadScore >= 0.7) {
    reasons.push("Tight bid/ask spread");
  }

  let decision: TradeDecision;
  if (hardSkip) {
    decision = "skip";
  } else if (score >= 0.65 && confidence >= 0.6) {
    decision = "paper_copy";
  } else if (score >= 0.45) {
    decision = "watchlist";
  } else {
    decision = "skip";
    risks.push(`Overall score ${score.toFixed(2)} too low to act on`);
  }

  const simulatedPositionSize = hardSkip
    ? 0
    : Math.round(
        ruleSet.minSimulatedPosition + (ruleSet.maxSimulatedPosition - ruleSet.minSimulatedPosition) * score
      );

  if (reasons.length === 0) {
    reasons.push("No strong positive signals identified");
  }

  return {
    score,
    confidence,
    decision,
    reasons,
    risks,
    breakdown,
    simulatedPositionSize,
  };
}
