/**
 * Logging helpers that redact secrets before anything hits stdout/UI.
 */

const SECRET_ENV_KEYS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "DATABASE_URL"];

/** Redacts any known secret values that appear verbatim in a string. */
export function redactSecrets(input: string): string {
  let output = input;
  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.length >= 8) {
      output = output.split(value).join(`[REDACTED_${key}]`);
    }
  }
  return output;
}

export function logInfo(message: string, ...rest: unknown[]): void {
  console.log(redactSecrets(message), ...rest.map((r) => (typeof r === "string" ? redactSecrets(r) : r)));
}

export function logError(message: string, ...rest: unknown[]): void {
  console.error(redactSecrets(message), ...rest.map((r) => (typeof r === "string" ? redactSecrets(r) : r)));
}
