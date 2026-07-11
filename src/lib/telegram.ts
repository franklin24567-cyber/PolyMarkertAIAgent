/**
 * Optional Telegram alerting. Gracefully no-ops if TELEGRAM_BOT_TOKEN /
 * TELEGRAM_CHAT_ID are not configured - never throws for missing config.
 */
import axios from "axios";
import { logInfo, logError } from "./logger";

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logInfo("[telegram] Skipping notification: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured.");
    return false;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    });
    return true;
  } catch (err) {
    logError("[telegram] Failed to send message:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
