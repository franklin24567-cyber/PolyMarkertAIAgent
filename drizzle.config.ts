import type { Config } from "drizzle-kit";
import "dotenv/config";

const dbFile = (process.env.DATABASE_URL ?? "./polymarket-bot.db").replace(/^file:/, "");

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbFile,
  },
  verbose: true,
  strict: true,
} satisfies Config;
