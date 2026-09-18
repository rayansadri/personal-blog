import type { SubscriptionRule, Transaction } from "../types";
import { addDays, daysBetween, median } from "../dates";
import { spendingTransactions } from "./core";

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringPayment {
  merchant: string;
  category: Transaction["category"];
  cadence: Cadence;
  typicalAmount: number;
  monthlyCost: number;
  yearlyCost: number;
  lastPayment: string;
  nextExpected: string;
  occurrences: number;
  /** 0..1 estimate that this is a genuine subscription/recurring bill. */
  confidence: number;
  /** Change vs the previous charge, when the latest amount differs. */
  lastChange: number;
  accounts: string[];
  transactionIds: string[];
  /** User feedback state. "detected" means no rule yet. */
  status: "detected" | "confirmed" | "ignored" | "cancel";
  reminderDays: number;
  manual: boolean;
  note: string | null;
}

/** Step a date forward one cycle. Calendar-aware for monthly and longer (same day next month, clamped). */
export function nextCycle(date: string, cadence: Cadence): string {
  if (cadence === "weekly") return addDays(date, 7);
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const CADENCE_DAYS: Record<Cadence, number> = { weekly: 7, monthly: 30.4, quarterly: 91, yearly: 365 };
export const CADENCE_PER_YEAR: Record<Cadence, number> = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };

const CADENCES: Array<{ cadence: Cadence; days: number; tolerance: number; perYear: number }> = [
  { cadence: "weekly", days: 7, tolerance: 2, perYear: 52 },
  { cadence: "monthly", days: 30.4, tolerance: 6, perYear: 12 },
  { cadence: "quarterly", days: 91, tolerance: 10, perYear: 4 },
  { cadence: "yearly", days: 365, tolerance: 20, perYear: 1 },
];

const VARIABLE_CATEGORIES = new Set<Transaction["category"]>([
  "Groceries", "Dining", "Delivery", "Shopping", "Entertainment", "Transportation", "Travel", "Other",
]);

const SUBSCRIPTION_HINT = /netflix|spotify|hulu|disney|apple|icloud|google|amazon prime|adobe|dropbox|github|notion|openai|gym|fitness|equinox|peloton|insurance|rent|mortgage|xfinity|verizon|at&t|t-mobile|pg&e|electric|internet|nytimes|times|patreon|substack|max\b/i;

/**
 * Find merchants charged at regular intervals with consistent amounts.
 * Groups by merchant (the normalized name), then scores interval regularity,
 * amount stability and occurrence count.
 */
export function detectRecurring(txs: Transaction[], rules: SubscriptionRule[] = []): RecurringPayment[] {
  const ruleMap = new Map(rules.map((r) => [r.merchant, r]));
  const byMerchant = new Map<string, Transaction[]>();
  for (const t of spendingTransactions(txs)) {
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  const results: RecurringPayment[] = [];
  for (const [merchant, list] of byMerchant) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));

    // Collapse same-day charges (e.g. a double charge) into one occurrence for interval purposes.
    const byDay = new Map<string, Transaction>();
    for (const t of sorted) if (!byDay.has(t.date)) byDay.set(t.date, t);
    const occ = [...byDay.values()];
    if (occ.length < 2) continue;

    const intervals: number[] = [];
    for (let i = 1; i < occ.length; i++) intervals.push(daysBetween(occ[i - 1].date, occ[i].date));
    const medInterval = median(intervals);

    const match = CADENCES.find((c) => Math.abs(medInterval - c.days) <= c.tolerance);
    const rule = ruleMap.get(merchant);
    if (rule?.status === "ignored") continue;
    const forced = rule ?? null;
    const cadenceMatch = match ?? (forced?.cadence ? CADENCES.find((c) => c.cadence === forced.cadence) : undefined);
    if (!cadenceMatch) continue;
    if (!forced) {
      if (cadenceMatch.cadence === "weekly" && occ.length < 4) continue;
      if (cadenceMatch.cadence === "monthly" && occ.length < 2) continue;
      if (cadenceMatch.cadence === "quarterly" && occ.length < 2) continue;
    }

    const amounts = occ.map((t) => Math.abs(t.amount));
    // Typical amount follows the most recent charges so price changes show up quickly.
    const typical = median(amounts.slice(-3));
    const amountSpread = amounts.reduce((a, n) => a + Math.abs(n - typical), 0) / amounts.length / (typical || 1);
    const intervalSpread =
      intervals.reduce((a, n) => a + Math.abs(n - cadenceMatch.days), 0) / intervals.length / cadenceMatch.days;

    // Score components
    const regularity = clamp(1 - intervalSpread * 2.5); // 0 at 40% jitter
    const stability = clamp(1 - amountSpread * 3); // 0 at 33% variation
    const countScore = clamp((occ.length - 1) / 4); // 3 occurrences -> 0.5, 5 -> 1
    const hint = SUBSCRIPTION_HINT.test(merchant) ? 0.15 : 0;
    let confidence = clamp(regularity * 0.4 + stability * 0.35 + countScore * 0.25 + hint);
    // Groceries, dining, shopping etc. happen regularly but are not subscriptions
    // unless the amount is also consistent (e.g. a fixed weekly meal plan).
    if (VARIABLE_CATEGORIES.has(occ[0].category) && amountSpread > 0.08) confidence *= 0.6;
    // Two occurrences of a non-hinted merchant is weak evidence.
    if (occ.length === 2 && hint === 0) confidence = Math.min(confidence, 0.45);
    // User feedback wins: confirmed / plan-to-cancel are certain.
    if (forced) confidence = Math.max(confidence, 0.97);
    if (confidence < 0.35) continue;

    const last = occ[occ.length - 1];
    const prevAmount = occ.length > 1 ? Math.abs(occ[occ.length - 2].amount) : typical;
    const amount = forced?.amount ?? typical;
    const monthlyCost = (amount * cadenceMatch.perYear) / 12;

    results.push({
      merchant,
      category: forced?.category ?? last.category,
      cadence: cadenceMatch.cadence,
      typicalAmount: amount,
      monthlyCost,
      yearlyCost: amount * cadenceMatch.perYear,
      lastPayment: last.date,
      nextExpected: forced?.nextDate && forced.nextDate > last.date ? forced.nextDate : nextCycle(last.date, cadenceMatch.cadence),
      occurrences: occ.length,
      confidence: Math.round(confidence * 100) / 100,
      lastChange: Math.abs(last.amount) - prevAmount,
      accounts: [...new Set(list.map((t) => t.account))],
      transactionIds: list.map((t) => t.id),
      status: rule ? rule.status : "detected",
      reminderDays: rule?.reminderDays ?? 3,
      manual: false,
      note: rule?.note ?? null,
    });
  }

  // Manual subscriptions with no (or too few) transactions behind them.
  const seen = new Set(results.map((r) => r.merchant));
  for (const r of rules) {
    if (r.status === "ignored" || seen.has(r.merchant) || !r.amount || !r.cadence) continue;
    const perYear = CADENCE_PER_YEAR[r.cadence];
    const next = r.nextDate ?? addDays(new Date().toISOString().slice(0, 10), 30);
    const mine = txs.filter((t) => t.merchant === r.merchant && t.transactionType === "expense").sort((a, b) => a.date.localeCompare(b.date));
    results.push({
      merchant: r.merchant,
      category: r.category ?? mine[mine.length - 1]?.category ?? "Subscriptions",
      cadence: r.cadence,
      typicalAmount: r.amount,
      monthlyCost: (r.amount * perYear) / 12,
      yearlyCost: r.amount * perYear,
      lastPayment: mine[mine.length - 1]?.date ?? addDays(next, -Math.round(CADENCE_DAYS[r.cadence])),
      nextExpected: next,
      occurrences: mine.length,
      confidence: 1,
      lastChange: 0,
      accounts: [...new Set(mine.map((t) => t.account))],
      transactionIds: mine.map((t) => t.id),
      status: r.status,
      reminderDays: r.reminderDays,
      manual: true,
      note: r.note,
    });
  }
  return results.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
