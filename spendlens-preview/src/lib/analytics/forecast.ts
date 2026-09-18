import type { Category, SubscriptionRule, Transaction } from "../types";
import { addDays, addMonths, daysBetween, monthLabel, monthRange } from "../dates";
import { inMonth, isFixed, spendingTransactions, sum } from "./core";
import { detectRecurring, nextCycle, type Cadence, type RecurringPayment } from "./recurring";

export { nextCycle };

export interface UpcomingCharge {
  id: string;
  merchant: string;
  category: Category;
  account: string;
  amount: number;
  cadence: Cadence;
  confidence: number;
  /** Expected date, YYYY-MM-DD */
  expected: string;
  /** Days from `asOf`. Negative = already expected, not seen yet. */
  daysUntil: number;
  status: "upcoming" | "overdue";
  /** For yearly/quarterly items, a heads-up that this one is big and rare. */
  isRenewal: boolean;
}

export interface LandedPrediction {
  merchant: string;
  category: Category;
  amount: number;
  expected: string;
  paidOn: string | null;
  actualAmount: number | null;
  status: "landed" | "missed";
}

export interface MonthForecast {
  month: string;
  label: string;
  /** True when the month in the data is finished, so we forecast the next one. */
  isNextMonth: boolean;
  daysElapsed: number;
  daysInMonth: number;
  spentSoFar: number;
  committedRemaining: number;
  variableDaily: number;
  projected: number;
  low: number;
  high: number;
  lastMonth: number;
  recurringMonthly: number;
}

export interface UpcomingReport {
  asOf: string;
  horizonDays: number;
  items: UpcomingCharge[];
  total: number;
  /** Predictions whose date already passed in the last 30 days, and whether they hit. */
  landed: LandedPrediction[];
  accuracy: { predicted: number; landed: number };
  forecast: MonthForecast;
}

const MATCH_WINDOW = 4; // days either side of an expected date to count as "landed"

/**
 * What is about to hit your accounts. `asOf` defaults to the latest date in
 * the data so the report is stable for a given import, not for wall-clock time.
 */
export function buildUpcoming(txs: Transaction[], horizonDays = 30, asOfOverride?: string, rules: SubscriptionRule[] = []): UpcomingReport {
  const dates = txs.map((t) => t.date).sort();
  const asOf = asOfOverride ?? dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
  const horizonEnd = addDays(asOf, horizonDays);
  const lookbackStart = addDays(asOf, -30);

  const recurring = detectRecurring(txs, rules).filter((r) => r.confidence >= 0.6);
  const items: UpcomingCharge[] = [];
  const landed: LandedPrediction[] = [];

  for (const r of recurring) {
    const isRenewal = r.cadence === "yearly" || r.cadence === "quarterly";
    const mine = txs.filter((t) => t.merchant === r.merchant && t.transactionType === "expense");

    // Walk expected dates from the last payment forward.
    let expected = nextCycle(r.lastPayment, r.cadence);
    let guard = 0;
    while (expected <= horizonEnd && guard++ < 60) {
      const daysUntil = daysBetween(asOf, expected);
      if (daysUntil < -MATCH_WINDOW) {
        // Expected in the past and never seen (the last payment is older). Report once, then stop chasing.
        if (expected >= lookbackStart) {
          landed.push({ merchant: r.merchant, category: r.category, amount: r.typicalAmount, expected, paidOn: null, actualAmount: null, status: "missed" });
        }
        items.push(toCharge(r, expected, daysUntil, "overdue", isRenewal));
        break;
      }
      items.push(toCharge(r, expected, daysUntil, "upcoming", isRenewal));
      expected = nextCycle(expected, r.cadence);
    }

    // Did the most recent expected charge land? Look at the payment before the last one to
    // derive what we would have predicted, and check the last payment against it.
    const sorted = [...mine].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2];
      const last = sorted[sorted.length - 1];
      const predicted = nextCycle(prev.date, r.cadence);
      if (predicted >= lookbackStart && predicted <= asOf) {
        const hit = Math.abs(daysBetween(predicted, last.date)) <= MATCH_WINDOW;
        landed.push({
          merchant: r.merchant,
          category: r.category,
          amount: Math.abs(prev.amount),
          expected: predicted,
          paidOn: hit ? last.date : null,
          actualAmount: hit ? Math.abs(last.amount) : null,
          status: hit ? "landed" : "missed",
        });
      }
    }
  }

  items.sort((a, b) => a.expected.localeCompare(b.expected) || b.amount - a.amount);
  landed.sort((a, b) => b.expected.localeCompare(a.expected));
  const upcoming = items.filter((i) => i.status === "upcoming");

  return {
    asOf,
    horizonDays,
    items,
    total: upcoming.reduce((a, i) => a + i.amount, 0),
    landed,
    accuracy: { predicted: landed.length, landed: landed.filter((l) => l.status === "landed").length },
    forecast: buildMonthForecast(txs, asOf, recurring, items),
  };
}

function toCharge(r: RecurringPayment, expected: string, daysUntil: number, status: UpcomingCharge["status"], isRenewal: boolean): UpcomingCharge {
  return {
    id: `${r.merchant}:${expected}`,
    merchant: r.merchant,
    category: r.category,
    account: r.accounts[0] ?? "",
    amount: r.typicalAmount,
    cadence: r.cadence,
    confidence: r.confidence,
    expected,
    daysUntil,
    status,
    isRenewal,
  };
}

/**
 * Where the current month will land. If the data's latest month is already
 * complete, forecast the following month from commitments + typical variable spend.
 */
export function buildMonthForecast(txs: Transaction[], asOf: string, recurring: RecurringPayment[], items: UpcomingCharge[]): MonthForecast {
  const spending = spendingTransactions(txs);
  const month = asOf.slice(0, 7);
  const { to } = monthRange(month);
  const daysInMonth = Number(to.slice(8, 10));
  const daysElapsed = Number(asOf.slice(8, 10));
  const isComplete = daysElapsed >= daysInMonth;
  const target = isComplete ? addMonths(month, 1) : month;
  const targetRange = monthRange(target);
  const targetDays = Number(targetRange.to.slice(8, 10));

  // Typical variable spend per day over the trailing three complete months.
  const trailing = [1, 2, 3].map((i) => addMonths(month, isComplete ? -(i - 1) : -i));
  const variableTotals = trailing.map((m) => sum(inMonth(spending, m).filter((t) => !isFixed(t))));
  const variableDays = trailing.reduce((a, m) => a + Number(monthRange(m).to.slice(8, 10)), 0);
  const variableDaily = variableDays ? variableTotals.reduce((a, b) => a + b, 0) / variableDays : 0;

  const recurringMonthly = recurring.reduce((a, r) => a + r.monthlyCost, 0);

  let spentSoFar = 0;
  let committedRemaining = 0;
  let projected = 0;
  if (isComplete) {
    committedRemaining = recurringMonthly;
    projected = recurringMonthly + variableDaily * targetDays;
  } else {
    spentSoFar = sum(inMonth(spending, month));
    committedRemaining = items
      .filter((i) => i.status === "upcoming" && i.expected > asOf && i.expected <= to)
      .reduce((a, i) => a + i.amount, 0);
    projected = spentSoFar + committedRemaining + variableDaily * (daysInMonth - daysElapsed);
  }
  const lastMonth = sum(inMonth(spending, addMonths(target, -1)));

  return {
    month: target,
    label: monthLabel(target),
    isNextMonth: isComplete,
    daysElapsed: isComplete ? 0 : daysElapsed,
    daysInMonth: targetDays,
    spentSoFar,
    committedRemaining,
    variableDaily,
    projected,
    low: projected * 0.9,
    high: projected * 1.12,
    lastMonth,
    recurringMonthly,
  };
}
