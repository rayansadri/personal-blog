import OpenAI from "openai";

/**
 * Server-only OpenAI access. The key is read from process.env (Next.js loads
 * .env.local on the server) and never reaches the browser.
 */
export const DEFAULT_CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";

export function hasOpenAICredentials(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
