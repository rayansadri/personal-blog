import { createHash } from "node:crypto";
import type { SubscriptionRule, Transaction } from "@/lib/types";
import { analyzeChanges } from "@/lib/analytics/changes";
import { getCachedInterpretation, putCachedInterpretation } from "@/lib/db/settings";
import { numbersSupported } from "@/services/ai/schema";
import { buildToolContext, numbersFrom, runTool } from "./tools";
import { DEFAULT_CHAT_MODEL, getOpenAI } from "./openai";

/**
 * One-paragraph AI summaries for the Overview and What Changed pages.
 * Facts come from get_month_explanation; the model only phrases them, and
 * every number is verified. Cached by input hash so a month is summarized once.
 */

export interface MonthSummary {
  month: string;
  text: string;
  source: "ai" | "deterministic";
  /** The three drivers that mattered most, deterministic. */
  drivers: Array<{ label: string; delta: number; kind: "appeared" | "disappeared" | "up" | "down" }>;
  /** Prefilled question for "Ask about this →". */
  askQuestion: string;
}

export async function summarizeMonth(txs: Transaction[], rules: SubscriptionRule[], month: string): Promise<MonthSummary | null> {
  const ctx = buildToolContext(txs, rules);
  if (!ctx) return null;
  const result = runTool("get_month_explanation", { month }, ctx);
  const data = result.data as { total: number; previousMonthTotal: number; change: number; categoryDrivers: Array<{ category: string; delta: number; isNew: boolean; disappeared: boolean }>; merchantDrivers: Array<{ merchant: string; delta: number; isNew: boolean; disappeared: boolean }>; transactions: number; previousMonthTransactions: number };
  const c = analyzeChanges(txs, month);

  const drivers = [...data.categoryDrivers.map((d) => ({ label: d.category, delta: d.delta, kind: d.isNew ? ("appeared" as const) : d.disappeared ? ("disappeared" as const) : d.delta > 0 ? ("up" as const) : ("down" as const) })), ...data.merchantDrivers.filter((m) => m.isNew || m.disappeared).map((m) => ({ label: m.merchant, delta: m.delta, kind: m.isNew ? ("appeared" as const) : ("disappeared" as const) }))]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  const deterministic = c.narrative.join(" ");
  const askQuestion = `Why did I spend ${data.change >= 0 ? "more" : "less"} in ${c.monthLabel}?`;
  const client = getOpenAI();
  if (!client || data.previousMonthTotal === 0) return { month, text: deterministic, source: "deterministic", drivers, askQuestion };

  const hash = createHash("sha256").update("month-summary:" + DEFAULT_CHAT_MODEL).update(JSON.stringify(data)).digest("hex");
  const cached = getCachedInterpretation(hash);
  if (cached) return { month, text: cached.output, source: "ai", drivers, askQuestion };

  try {
    const res = await client.responses.create({
      model: DEFAULT_CHAT_MODEL,
      instructions: "You write one short paragraph (two or three sentences, under 60 words) summarizing a month of personal spending for the person who spent it. Lead with the main reason the month was higher or lower than the month before, name the two or three drivers with their amounts, and say whether day-to-day spending stayed stable. Use only the numbers provided. Plain, calm, direct. No advice, no greeting, no bullet points.",
      input: [{ role: "user", content: JSON.stringify({ month: c.monthLabel, previousMonth: c.previousLabel, ...data }) }],
      store: false,
    });
    const text = res.output_text.trim();
    if (text && numbersSupported(text, numbersFrom(data))) {
      putCachedInterpretation(hash, text, DEFAULT_CHAT_MODEL);
      return { month, text, source: "ai", drivers, askQuestion };
    }
  } catch {
    /* fall through */
  }
  return { month, text: deterministic, source: "deterministic", drivers, askQuestion };
}
