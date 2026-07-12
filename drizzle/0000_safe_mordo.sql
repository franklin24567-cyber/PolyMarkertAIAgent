CREATE TABLE `daily_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`paper_pnl` real DEFAULT 0 NOT NULL,
	`win_rate` real,
	`open_positions` integer DEFAULT 0 NOT NULL,
	`new_signals` integer DEFAULT 0 NOT NULL,
	`copied_signals` integer DEFAULT 0 NOT NULL,
	`watched_signals` integer DEFAULT 0 NOT NULL,
	`skipped_signals` integer DEFAULT 0 NOT NULL,
	`best_wallets_json` text,
	`worst_wallets_json` text,
	`rule_changes_json` text,
	`summary` text,
	`sent_to_telegram` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`is_demo_data` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_reports_date_unique` ON `daily_reports` (`date`);--> statement-breakpoint
CREATE TABLE `decision_journal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`observed_trade_id` integer NOT NULL,
	`wallet_address` text NOT NULL,
	`market_id` text NOT NULL,
	`decision` text NOT NULL,
	`copy_score` real NOT NULL,
	`confidence` real NOT NULL,
	`reasons_json` text,
	`risks_json` text,
	`wallet_quality_score` real,
	`roi_score` real,
	`consistency_score` real,
	`copyability_score` real,
	`category_fit_score` real,
	`entry_timing_score` real,
	`spread_score` real,
	`liquidity_score` real,
	`thesis_score` real,
	`simulated_position_size` real,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`is_demo_data` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leaderboard_scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`scanned_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`wallet_count` integer DEFAULT 0 NOT NULL,
	`lookback_days` integer DEFAULT 30 NOT NULL,
	`raw_summary_json` text
);
--> statement-breakpoint
CREATE TABLE `market_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`market_id` text NOT NULL,
	`condition_id` text,
	`question` text,
	`category` text,
	`yes_price` real,
	`no_price` real,
	`best_bid` real,
	`best_ask` real,
	`spread` real,
	`liquidity` real,
	`volume` real,
	`time_to_resolution` integer,
	`collected_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`raw_market_json` text,
	`is_demo_data` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `observed_trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wallet_address` text NOT NULL,
	`market_id` text NOT NULL,
	`condition_id` text,
	`market_question` text,
	`market_category` text,
	`outcome` text,
	`side` text NOT NULL,
	`wallet_entry_price` real NOT NULL,
	`detected_price` real,
	`size` real NOT NULL,
	`timestamp` integer NOT NULL,
	`raw_trade_json` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`is_demo_data` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outcome_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`decision_journal_id` integer NOT NULL,
	`paper_trade_id` integer,
	`review_time` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`price_after_1h` real,
	`price_after_6h` real,
	`price_after_24h` real,
	`final_outcome` text,
	`simulated_pnl` real,
	`was_decision_good` integer,
	`lessons_json` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`decision_journal_id` integer NOT NULL,
	`wallet_address` text NOT NULL,
	`market_id` text NOT NULL,
	`outcome` text,
	`side` text NOT NULL,
	`entry_price` real NOT NULL,
	`current_price` real,
	`simulated_position_size` real NOT NULL,
	`unrealized_pnl` real DEFAULT 0,
	`realized_pnl` real,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`closed_at` integer,
	`resolved_at` integer,
	`is_demo_data` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pnl_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paper_trade_id` integer NOT NULL,
	`price` real NOT NULL,
	`pnl` real NOT NULL,
	`collected_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rule_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`old_rule_set_id` integer,
	`new_rule_set_id` integer NOT NULL,
	`changed_by` text DEFAULT 'hermes-self-improvement' NOT NULL,
	`reason` text NOT NULL,
	`evidence_summary` text,
	`before_json` text,
	`after_json` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rule_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version` integer NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`rules_json` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wallet_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`address` text NOT NULL,
	`label` text,
	`source_rank` integer,
	`status` text DEFAULT 'watch' NOT NULL,
	`roi_30d` real,
	`consistency_score` real,
	`copyability_score` real,
	`one_hit_wonder_penalty` real,
	`global_score` real,
	`best_category` text,
	`category_strengths_json` text,
	`average_trade_size` real,
	`trade_count_30d` integer,
	`resolved_trade_count_30d` integer,
	`win_rate_30d` real,
	`average_liquidity` real,
	`average_spread` real,
	`average_entry_timing` real,
	`copyability_notes` text,
	`risk_notes` text,
	`last_scanned_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`is_demo_data` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_profiles_address_unique` ON `wallet_profiles` (`address`);