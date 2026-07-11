/**
 * Adapter for the public Polymarket HTTP APIs (data-api + CLOB).
 *
 * IMPORTANT: This adapter is READ-ONLY. It never signs, submits, or
 * broadcasts orders, and never touches a private key. It only fetches
 * public market/wallet data for analysis and paper trading simulation.
 *
 * Every function throws a real, descriptive error on failure. Callers
 * must NOT swallow these errors or substitute fake/demo data in their
 * place - only the seed script is allowed to insert clearly labeled
 * demo data.
 */
import axios, { type AxiosInstance } from "axios";

const DATA_API_BASE = process.env.POLYMARKET_API_BASE ?? "https://data-api.polymarket.com";
const CLOB_API_BASE = process.env.CLOB_API_BASE ?? "https://clob.polymarket.com";

function makeClient(baseURL: string): AxiosInstance {
  return axios.create({ baseURL, timeout: 15_000 });
}

const dataApi = makeClient(DATA_API_BASE);
const clobApi = makeClient(CLOB_API_BASE);

/** One row of the Polymarket leaderboard. */
export interface LeaderboardEntry {
  proxyWallet: string;
  name?: string;
  amount?: number;
  profit?: number;
  rank?: number;
  [key: string]: unknown;
}

/** A single trade/activity event for a wallet. */
export interface WalletActivity {
  proxyWallet: string;
  conditionId?: string;
  market?: string;
  outcome?: string;
  side?: string;
  price?: number;
  size?: number;
  timestamp?: number;
  [key: string]: unknown;
}

/** Market metadata as returned by the CLOB API. */
export interface ClobMarket {
  condition_id: string;
  question?: string;
  category?: string;
  tokens?: Array<{ token_id: string; outcome: string; price?: number }>;
  minimum_order_size?: string;
  [key: string]: unknown;
}

/** Midpoint price response from the CLOB API. */
export interface MidpointResponse {
  mid: string;
  [key: string]: unknown;
}

function describeAxiosError(context: string, err: unknown): Error {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const statusText = err.response?.statusText;
    const body = err.response?.data ? JSON.stringify(err.response.data).slice(0, 500) : undefined;
    return new Error(
      `${context} failed: ${err.message}${status ? ` (HTTP ${status} ${statusText ?? ""})` : ""}${
        body ? ` — response: ${body}` : ""
      }`
    );
  }
  return new Error(`${context} failed: ${err instanceof Error ? err.message : String(err)}`);
}

/**
 * Fetch the Polymarket leaderboard (top wallets by profit) over a window.
 * Throws on any network/HTTP failure - never returns fabricated data.
 */
export async function fetchLeaderboard(
  window: "1d" | "7d" | "30d" | "all" = "30d",
  limit = 500
): Promise<LeaderboardEntry[]> {
  try {
    const res = await dataApi.get<LeaderboardEntry[]>("/leaderboard", {
      params: { window, limit },
    });
    if (!Array.isArray(res.data)) {
      throw new Error(`unexpected response shape (expected array), got: ${typeof res.data}`);
    }
    return res.data;
  } catch (err) {
    throw describeAxiosError(`fetchLeaderboard(window=${window}, limit=${limit})`, err);
  }
}

/**
 * Fetch recent on-chain activity/trades for a wallet address.
 */
export async function fetchWalletTrades(
  address: string,
  lookbackDays = 30,
  limit = 500
): Promise<WalletActivity[]> {
  if (!address) {
    throw new Error("fetchWalletTrades requires a non-empty wallet address");
  }
  try {
    const res = await dataApi.get<WalletActivity[]>("/activity", {
      params: { user: address, limit },
    });
    if (!Array.isArray(res.data)) {
      throw new Error(`unexpected response shape (expected array), got: ${typeof res.data}`);
    }
    const cutoffSeconds = Math.floor(Date.now() / 1000) - lookbackDays * 86400;
    return res.data.filter((t) => (t.timestamp ?? 0) >= cutoffSeconds);
  } catch (err) {
    throw describeAxiosError(`fetchWalletTrades(address=${address}, lookbackDays=${lookbackDays})`, err);
  }
}

/**
 * Fetch market metadata (question, category, tokens) for a condition ID.
 */
export async function fetchMarket(conditionId: string): Promise<ClobMarket> {
  if (!conditionId) {
    throw new Error("fetchMarket requires a non-empty conditionId");
  }
  try {
    const res = await clobApi.get<ClobMarket>(`/markets/${conditionId}`);
    if (!res.data || typeof res.data !== "object") {
      throw new Error(`unexpected response shape (expected object), got: ${typeof res.data}`);
    }
    return res.data;
  } catch (err) {
    throw describeAxiosError(`fetchMarket(conditionId=${conditionId})`, err);
  }
}

/**
 * Fetch the current midpoint price for a given outcome token.
 */
export async function fetchMarketPrice(tokenId: string): Promise<number> {
  if (!tokenId) {
    throw new Error("fetchMarketPrice requires a non-empty tokenId");
  }
  try {
    const res = await clobApi.get<MidpointResponse>("/midpoint", {
      params: { token_id: tokenId },
    });
    const mid = Number(res.data?.mid);
    if (Number.isNaN(mid)) {
      throw new Error(`unexpected response shape, could not parse "mid" from: ${JSON.stringify(res.data)}`);
    }
    return mid;
  } catch (err) {
    throw describeAxiosError(`fetchMarketPrice(tokenId=${tokenId})`, err);
  }
}
