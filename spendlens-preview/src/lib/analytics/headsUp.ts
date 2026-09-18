import type { SubscriptionRule, Transaction } from "../types";
import { addDays, daysBetween } from "../dates";
import { detectRecurring, nextCycle, type RecurringPayment } from "./recurring";

export interface HeadsUp {
  id: string;
  merchant: string;
  category: RecurringPayment["category"];
  amount: number;
  cadence: RecurringPayment["cadence"];
  /** Expected charge date (YYYY-MM-DD), relative to real time. */
  expected: string;
  daysUntil: number;
  /** Last day to cancel and skip this charge. */
  cancelBy: string;
  reminderDays: number;
  /** Why this is being surfaced. */
  reason: "reminder" | "big" | "cancel" | "renewal";
  status: RecurringPayment["status"];
  account: string;
}

const BIG = 100;

/**
 * Alerts computed against the wall clock (not the import date): charges due
 * within each subscription's reminder window, big charges within 7 days,
 * anything the user flagged to cancel, and yearly/quarterly renewals within 14 days.
 */
export function buildHeadsUp(txs: Transaction[], rules: SubscriptionRule[] = [], today = new Date().toISOString().slice(0, 10)): HeadsUp[] {
  const recurring = detectRecurring(txs, rules).filter((r) => r.confidence >= 0.6 && r.status !== "ignored");
  const out: HeadsUp[] = [];

  for (const r of recurring) {
    // Walk forward from the last known payment to the first expected date on/after today.
    let expected = r.nextExpected;
    let guard = 0;
    while (expected < today && guard++ < 120) expected = nextCycle(expected, r.cadence);
    const daysUntil = daysBetween(today, expected);

    const isRenewal = r.cadence === "yearly" || r.cadence === "quarterly";
    const reason: HeadsUp["reason"] | null =
      r.status === "cancel" && daysUntil <= Math.max(r.reminderDays, 7)
        ? "cancel"
        : isRenewal && daysUntil <= 14
          ? "renewal"
          : r.typicalAmount >= BIG && daysUntil <= 7
            ? "big"
            : daysUntil <= r.reminderDays
              ? "reminder"
              : null;
    if (!reason) continue;

    out.push({
      id: `headsup:${r.merchant}:${expected}`,
      merchant: r.merchant,
      category: r.category,
      amount: r.typicalAmount,
      cadence: r.cadence,
      expected,
      daysUntil,
      cancelBy: addDays(expected, -1),
      reminderDays: r.reminderDays,
      reason,
      status: r.status,
      account: r.accounts[0] ?? "",
    });
  }
  const weight: Record<HeadsUp["reason"], number> = { cancel: 0, renewal: 1, big: 2, reminder: 3 };
  return out.sort((a, b) => a.daysUntil - b.daysUntil || weight[a.reason] - weight[b.reason] || b.amount - a.amount);
}

export function headsUpTitle(h: HeadsUp): string {
  const when = h.daysUntil === 0 ? "today" : h.daysUntil === 1 ? "tomorrow" : `in ${h.daysUntil} days`;
  const amt = `$${h.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  switch (h.reason) {
    case "cancel":
      return `You planned to cancel ${h.merchant}. It charges ${amt} ${when}.`;
    case "renewal":
      return `${h.merchant} ${h.cadence} renewal: ${amt} ${when}`;
    case "big":
      return `Big one coming: ${h.merchant} ${amt} ${when}`;
    default:
      return `${h.merchant} charges ${amt} ${when}`;
  }
}

export function headsUpBody(h: HeadsUp): string {
  const cancelBy = new Date(`${h.cancelBy}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (h.daysUntil <= 0) return `Charging today${h.account ? ` on ${h.account}` : ""}. Too late to skip this one; decide about the next.`;
  return `Cancel before ${cancelBy} if you don't want it${h.account ? ` · ${h.account}` : ""}.`;
}
