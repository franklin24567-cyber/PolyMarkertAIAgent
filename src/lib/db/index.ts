/**
 * SQLite database connection (via better-sqlite3 + Drizzle ORM).
 *
 * Local/dev and standard Vercel deployments will use a file-based SQLite
 * database. NOTE: on Vercel, the filesystem is ephemeral/read-only between
 * deployments (see README "Production Notes") - for a persistent production
 * deployment, point DATABASE_URL at a hosted SQLite-compatible service such
 * as Turso, or swap this module for a Postgres driver (e.g. Neon) pointed at
 * an equivalent Drizzle schema.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const rawUrl = process.env.DATABASE_URL ?? "./polymarket-bot.db";
const dbFile = rawUrl.replace(/^file:/, "");
const resolvedPath = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);

// Ensure the parent directory exists (useful for nested DATABASE_URL paths).
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(resolvedPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { schema };
export const sqliteConnection = sqlite;
