/**
 * Drizzle ORM schema for the PolyMarket AI Agent (paper-trading only).
 *
 * All monetary/position values are SIMULATED. Nothing in this schema
 * represents real funds, real orders, or private key material.
 */
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const nowSeconds = sql`(strftime('%s','now'))`;

/** A single run of the leaderboard scanner. */
export const leaderboardScans = sqliteTable("leaderboard_scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  scannedAt: integer("scanned_at").notNull().default(sql`(strftime('%s','now'))`),
  walletCount: integer("wallet_count").notNull().default(0),
  lookbackDays: integer("lookback_days").notNull().default(30),
  rawSummaryJson: text("raw_summary_json"),
});

/** Aggregated profile + scoring for a wallet we are watching/tracking. */
export const walletProfiles = sqliteTable("wallet_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  address: text("address").notNull().unique(),
  label: text("label"),
  sourceRank: integer("source_rank"),
  status: text("status", { enum: ["track", "watch", "ignore"] })
    .notNull()
    .default("watch"),
  roi30d: real("roi_30d"),
  consistencyScore: real("consistency_score"),
  copyabilityScore: real("copyability_score"),
  oneHitWonderPenalty: real("one_hit_wonder_penalty"),
  globalScore: real("global_score"),
  bestCategory: text("best_category"),
  categoryStrengthsJson: text("category_strengths_json"),
  averageTradeSize: real("average_trade_size"),
  tradeCount30d: integer("trade_count_30d"),
  resolvedTradeCount30d: integer("resolved_trade_count_30d"),
  winRate30d: real("win_rate_30d"),
  averageLiquidity: real("average_liquidity"),
  averageSpread: real("average_spread"),
  averageEntryTiming: real("average_entry_timing"),
  copyabilityNotes: text("copyability_notes"),
  riskNotes: text("risk_notes"),
  lastScannedAt: integer("last_scanned_at"),
  createdAt: integer("created_at").notNull().default(nowSeconds),
  updatedAt: integer("updated_at").notNull().default(nowSeconds),
  isDemoData: integer("is_demo_data", { mode: "boolean" }).notNull().default(false),
});

/** A trade we observed a tracked wallet making. */
export const observedTrades = sqliteTable("observed_trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  walletAddress: text("wallet_address").notNull(),
  marketId: text("market_id").notNull(),
  conditionId: text("condition_id"),
  marketQuestion: text("market_question"),
  marketCategory: text("market_category"),
  outcome: text("outcome"),
  side: text("side", { enum: ["YES", "NO"] }).notNull(),
  walletEntryPrice: real("wallet_entry_price").notNull(),
  detectedPrice: real("detected_price"),
  size: real("size").notNull(),
  timestamp: integer("timestamp").notNull(),
  rawTradeJson: text("raw_trade_json"),
  createdAt: integer("created_at").notNull().default(nowSeconds),
  isDemoData: integer("is_demo_data", { mode: "boolean" }).notNull().default(false),
});

/** Point-in-time snapshot of a market's order book / pricing. */
export const marketSnapshots = sqliteTable("market_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  marketId: text("market_id").notNull(),
  conditionId: text("condition_id"),
  question: text("question"),
  category: text("category"),
  yesPrice: real("yes_price"),
  noPrice: real("no_price"),
  bestBid: real("best_bid"),
  bestAsk: real("best_ask"),
  spread: real("spread"),
  liquidity: real("liquidity"),
  volume: real("volume"),
  timeToResolution: integer("time_to_resolution"),
  collectedAt: integer("collected_at").notNull().default(nowSeconds),
  rawMarketJson: text("raw_market_json"),
  isDemoData: integer("is_demo_data", { mode: "boolean" }).notNull().default(false),
});

/** The agent's reasoning + decision for a given observed trade. */
export const decisionJournal = sqliteTable("decision_journal", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  observedTradeId: integer("observed_trade_id").notNull(),
  walletAddress: text("wallet_address").notNull(),
  marketId: text("market_id").notNull(),
  decision: text("decision", { enum: ["paper_copy", "watchlist", "skip"] }).notNull(),
  copyScore: real("copy_score").notNull(),
  confidence: real("confidence").notNull(),
  reasonsJson: text("reasons_json"),
  risksJson: text("risks_json"),
  walletQualityScore: real("wallet_quality_score"),
  roiScore: real("roi_score"),
  consistencyScore: real("consistency_score"),
  copyabilityScore: real("copyability_score"),
  categoryFitScore: real("category_fit_score"),
  entryTimingScore: real("entry_timing_score"),
  spreadScore: real("spread_score"),
  liquidityScore: real("liquidity_score"),
  thesisScore: real("thesis_score"),
  simulatedPositionSize: real("simulated_position_size"),
  createdAt: integer("created_at").notNull().default(nowSeconds),
  isDemoData: integer("is_demo_data", { mode: "boolean" }).notNull().default(false),
});

/** A simulated ("paper") position opened as a result of a decision. */
export const paperTrades = sqliteTable("paper_trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  decisionJournalId: integer("decision_journal_id").notNull(),
  walletAddress: text("wallet_address").notNull(),
  marketId: text("market_id").notNull(),
  outcome: text("outcome"),
  side: text("side", { enum: ["YES", "NO"] }).notNull(),
  entryPrice: real("entry_price").notNull(),
  currentPrice: real("current_price"),
  simulatedPositionSize: real("simulated_position_size").notNull(),
  unrealizedPnl: real("unrealized_pnl").default(0),
  realizedPnl: real("realized_pnl"),
  status: text("status", { enum: ["open", "closed", "resolved"] })
    .notNull()
    .default("open"),
  openedAt: integer("opened_at").notNull().default(nowSeconds),
  closedAt: integer("closed_at"),
  resolvedAt: integer("resolved_at"),
  isDemoData: integer("is_demo_data", { mode: "boolean" }).notNull().default(false),
});

/** Time series of PnL for a paper trade, used to draw charts. */
export const pnlSnapshots = sqliteTable("pnl_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  paperTradeId: integer("paper_trade_id").notNull(),
  price: real("price").notNull(),
  pnl: real("pnl").notNull(),
  collectedAt: integer("collected_at").notNull().default(nowSeconds),
});

/** Post-hoc review of how a decision played out, feeding self-improvement. */
export const outcomeReviews = sqliteTable("outcome_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  decisionJournalId: integer("decision_journal_id").notNull(),
  paperTradeId: integer("paper_trade_id"),
  reviewTime: integer("review_time").notNull().default(nowSeconds),
  priceAfter1h: real("price_after_1h"),
  priceAfter6h: real("price_after_6h"),
  priceAfter24h: real("price_after_24h"),
  finalOutcome: text("final_outcome"),
  simulatedPnl: real("simulated_pnl"),
  wasDecisionGood: integer("was_decision_good", { mode: "boolean" }),
  lessonsJson: text("lessons_json"),
  createdAt: integer("created_at").notNull().default(nowSeconds),
});

/** A versioned set of scoring/decision thresholds ("the brain's config"). */
export const ruleSets = sqliteTable("rule_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  version: integer("version").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  rulesJson: text("rules_json").notNull(),
  createdAt: integer("created_at").notNull().default(nowSeconds),
  updatedAt: integer("updated_at").notNull().default(nowSeconds),
});

/** An audit trail entry recording why/how rules changed over time. */
export const ruleChanges = sqliteTable("rule_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  oldRuleSetId: integer("old_rule_set_id"),
  newRuleSetId: integer("new_rule_set_id").notNull(),
  changedBy: text("changed_by").notNull().default("hermes-self-improvement"),
  reason: text("reason").notNull(),
  evidenceSummary: text("evidence_summary"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: integer("created_at").notNull().default(nowSeconds),
});

/** A rolled-up daily summary of the bot's (paper) performance. */
export const dailyReports = sqliteTable("daily_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  paperPnl: real("paper_pnl").notNull().default(0),
  winRate: real("win_rate"),
  openPositions: integer("open_positions").notNull().default(0),
  newSignals: integer("new_signals").notNull().default(0),
  copiedSignals: integer("copied_signals").notNull().default(0),
  watchedSignals: integer("watched_signals").notNull().default(0),
  skippedSignals: integer("skipped_signals").notNull().default(0),
  bestWalletsJson: text("best_wallets_json"),
  worstWalletsJson: text("worst_wallets_json"),
  ruleChangesJson: text("rule_changes_json"),
  summary: text("summary"),
  sentToTelegram: integer("sent_to_telegram", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(nowSeconds),
  isDemoData: integer("is_demo_data", { mode: "boolean" }).notNull().default(false),
});

export type LeaderboardScan = typeof leaderboardScans.$inferSelect;
export type NewLeaderboardScan = typeof leaderboardScans.$inferInsert;
export type WalletProfile = typeof walletProfiles.$inferSelect;
export type NewWalletProfile = typeof walletProfiles.$inferInsert;
export type ObservedTrade = typeof observedTrades.$inferSelect;
export type NewObservedTrade = typeof observedTrades.$inferInsert;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
export type NewMarketSnapshot = typeof marketSnapshots.$inferInsert;
export type DecisionJournalEntry = typeof decisionJournal.$inferSelect;
export type NewDecisionJournalEntry = typeof decisionJournal.$inferInsert;
export type PaperTrade = typeof paperTrades.$inferSelect;
export type NewPaperTrade = typeof paperTrades.$inferInsert;
export type PnlSnapshot = typeof pnlSnapshots.$inferSelect;
export type NewPnlSnapshot = typeof pnlSnapshots.$inferInsert;
export type OutcomeReview = typeof outcomeReviews.$inferSelect;
export type NewOutcomeReview = typeof outcomeReviews.$inferInsert;
export type RuleSet = typeof ruleSets.$inferSelect;
export type NewRuleSet = typeof ruleSets.$inferInsert;
export type RuleChange = typeof ruleChanges.$inferSelect;
export type NewRuleChange = typeof ruleChanges.$inferInsert;
export type DailyReport = typeof dailyReports.$inferSelect;
export type NewDailyReport = typeof dailyReports.$inferInsert;
