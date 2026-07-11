import fs from "fs";
import path from "path";

/**
 * Safety tests: assert (via static source inspection) that this codebase
 * never executes real trades and never handles private keys / signing
 * material. These tests intentionally do NOT rely on mocking network
 * calls - they scan the actual source for forbidden patterns, so a future
 * change that introduces real trading or key handling will fail CI.
 */

const SRC_ROOT = path.join(process.cwd(), "src");

function listFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      listFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const SOURCE_FILES = listFiles(SRC_ROOT);

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /private[_-]?key/i, description: "reference to a private key" },
  { pattern: /seed[_-]?phrase/i, description: "reference to a seed phrase" },
  { pattern: /mnemonic/i, description: "reference to a mnemonic" },
  { pattern: /\bwallet\.sign\b/i, description: "wallet signing call" },
  { pattern: /signTransaction/i, description: "transaction signing call" },
  { pattern: /clob-client/i, description: "reference to the Polymarket CLOB order-signing client" },
  { pattern: /placeOrder/i, description: "real order placement call" },
  { pattern: /submitOrder/i, description: "real order submission call" },
  { pattern: /executeOrder/i, description: "real order execution call" },
];

describe("Safety: no real trade execution or private key handling", () => {
  it("scans at least the expected core source files", () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(5);
  });

  for (const { pattern, description } of FORBIDDEN_PATTERNS) {
    it(`never contains ${description}`, () => {
      const offenders = SOURCE_FILES.filter((file) => pattern.test(fs.readFileSync(file, "utf-8")));
      expect(offenders).toEqual([]);
    });
  }

  it("the Polymarket adapter only performs GET requests (read-only)", () => {
    const adapterPath = path.join(SRC_ROOT, "lib", "adapters", "polymarket.ts");
    const content = fs.readFileSync(adapterPath, "utf-8");
    expect(content).not.toMatch(/\.(post|put|patch|delete)\s*\(/i);
    expect(content).toMatch(/\.get\s*</);
  });

  it("PaperTrade status enum never includes a 'live' or 'executed' state", () => {
    const schemaPath = path.join(SRC_ROOT, "lib", "db", "schema.ts");
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).not.toMatch(/["'`]live["'`]/);
    expect(content).not.toMatch(/["'`]executed["'`]/);
  });

  it("logger redacts known secret environment variables", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "super-secret-token-value-123456";
    const { redactSecrets } = await import("@/lib/logger");
    const output = redactSecrets("token=super-secret-token-value-123456");
    expect(output).not.toContain("super-secret-token-value-123456");
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it("Telegram sender no-ops gracefully when not configured (never throws)", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const { sendTelegramMessage, isTelegramConfigured } = await import("@/lib/telegram");
    expect(isTelegramConfigured()).toBe(false);
    await expect(sendTelegramMessage("test")).resolves.toBe(false);
  });
});
