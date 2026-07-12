/**
 * Date/time utilities shared across API routes and scripts.
 */

/** Convert a Unix timestamp (seconds) to an ISO date string (YYYY-MM-DD). */
export function timestampToDateString(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Get the Unix timestamp (seconds) for the start of the current UTC day. */
export function startOfTodayUnix(): number {
  const today = new Date().toISOString().slice(0, 10);
  return Math.floor(new Date(`${today}T00:00:00Z`).getTime() / 1000);
}
