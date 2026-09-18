import type { Category, SubscriptionRule, Transaction } from "../types";
import { addDays, addMonths, daysBetween, isWeekend, monthKey, monthRange, parseISO } from "../dates";
import { FIXED_CATEGORIES } from "../types";
import { detectRecurring } from "./recurring";

/**
 * EPIC 2: deterministic analytics engine.
 *
 * Every function here is pure, typed, works over an arbitrary period and never
 * calls a model. `comparison` is filled in when a previous period is derivable.
 */

export interface Period {
  start: string;
  end: string;
}

export interface Comparison<T = number> {
  previousPeriodValue: T;
  /** Percent change vs the previous period; null when the previous value is 0. */
  changePct: number | null;
  previousPeriod: Period;
}

export interface Metric<T = number> {
  metric: string;
  value: T;
  period: Period;
  comparison?: Comparison<T>;
  /** Human-readable note when a metric is unavailable or degraded. */
  note?: string;
}

export interface MonthPoint {
  month: string;
  value: number;
}

export interface Breakdown {
  key: string;
  total: number;
  share: number;
  count: number;
}

// ---------- helpers ----------

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What a transaction cost you. Excludes transfers, payments, income, refunds and duplicates. */
export function spendAmount(t: Transaction): number {
  if (t.transactionType !== "expense" || t.flags.includes("duplicate")) return 0;
  return Math.max(0, Math.abs(t.amount) - (t.splitOthers ?? 0));
}

export function inPeriod(txs: Transaction[], p: Period): Transaction[] {
  return txs.filter((t) => t.date >= p.start && t.date <= p.end);
}

export function spendTxs(txs: Transaction[], p: Period): Transaction[] {
  return inPeriod(txs, p).filter((t) => spendAmount(t) > 0);
}

export function periodDays(p: Period): number {
  return daysBetween(p.start, p.end) + 1;
}

/** The period of equal length immediately before `p`. */
export function previousPeriod(p: Period): Period {
  const len = periodDays(p);
  const end = addDays(p.start, -1);
  return { start: addDays(end, -(len - 1)), end };
}

export function monthsIn(p: Period): string[] {
  const out: string[] = [];
  let m = monthKey(p.start);
  const last = monthKey(p.end);
  let guard = 0;
  while (m <= last && guard++ < 600) {
    out.push(m);
    m = addMonths(m, 1);
  }
  return out;
}

export function periodForMonth(month: string): Period {
  const r = monthRange(month);
  return { start: r.from, end: r.to };
}

export function periodFromTransactions(txs: Transaction[]): Period | null {
  if (!txs.length) return null;
  const dates = txs.map((t) => t.date).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

export function pct(current: number, previous: number): number | null {
  if (!previous) return null;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

function withComparison(metric: string, p: Period, value: number, compute: (p: Period) => number, compare: boolean): Metric {
  const m: Metric = { metric, value: round2(value), period: p };
  if (compare) {
    const prev = previousPeriod(p);
    const prevValue = round2(compute(prev));
    m.comparison = { previousPeriodValue: prevValue, changePct: pct(m.value, prevValue), previousPeriod: prev };
  }
  return m;
}

function total(txs: Transaction[]): number {
  return txs.reduce((a, t) => a + spendAmount(t), 0);
}

function monthlyTotals(txs: Transaction[], p: Period, pick: (t: Transaction) => number): MonthPoint[] {
  const map = new Map<string, number>();
  for (const m of monthsIn(p)) map.set(m, 0);
  for (const t of inPeriod(txs, p)) {
    const k = monthKey(t.date);
    map.set(k, (map.get(k) ?? 0) + pick(t));
  }
  return [...map.entries()].map(([month, value]) => ({ month, value: round2(value) }));
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Only months that are fully inside the period count toward monthly averages. */
function completeMonths(p: Period): string[] {
  return monthsIn(p).filter((m) => {
    const r = monthRange(m);
    return r.from >= p.start && r.to <= p.end;
  });
}

// ---------- metrics ----------

export function getMonthlySpend(txs: Transaction[], p: Period): Metric<MonthPoint[]> {
  return { metric: "monthly_spend", value: monthlyTotals(txs, p, spendAmount), period: p };
}

export function getMonthlyIncome(txs: Transaction[], p: Period): Metric<MonthPoint[]> {
  return { metric: "monthly_income", value: monthlyTotals(txs, p, (t) => (t.transactionType === "income" ? t.amount : 0)), period: p };
}

export function getTotalSpend(txs: Transaction[], p: Period, compare = true): Metric {
  return withComparison("total_spend", p, total(inPeriod(txs, p)), (pp) => total(inPeriod(txs, pp)), compare);
}

export function getTotalIncome(txs: Transaction[], p: Period, compare = true): Metric {
  const inc = (pp: Period) => inPeriod(txs, pp).reduce((a, t) => a + (t.transactionType === "income" ? t.amount : 0), 0);
  return withComparison("total_income", p, inc(p), inc, compare);
}

function breakdown(txs: Transaction[], p: Period, key: (t: Transaction) => string): Breakdown[] {
  const rows = spendTxs(txs, p);
  const sum = total(rows) || 1;
  const map = new Map<string, { total: number; count: number }>();
  for (const t of rows) {
    const k = key(t);
    const cur = map.get(k) ?? { total: 0, count: 0 };
    map.set(k, { total: cur.total + spendAmount(t), count: cur.count + 1 });
  }
  return [...map.entries()]
    .map(([k, v]) => ({ key: k, total: round2(v.total), share: round2(v.total / sum), count: v.count }))
    .sort((a, b) => b.total - a.total);
}

export function getSpendByCategory(txs: Transaction[], p: Period): Metric<Breakdown[]> {
  return { metric: "spend_by_category", value: breakdown(txs, p, (t) => t.category), period: p };
}

export function getSpendByMerchant(txs: Transaction[], p: Period, limit = 25): Metric<Breakdown[]> {
  return { metric: "spend_by_merchant", value: breakdown(txs, p, (t) => t.merchant).slice(0, limit), period: p };
}

export function getAverageTransactionValue(txs: Transaction[], p: Period, compare = true): Metric {
  const avg = (pp: Period) => {
    const rows = spendTxs(txs, pp);
    return rows.length ? total(rows) / rows.length : 0;
  };
  return withComparison("average_transaction_value", p, avg(p), avg, compare);
}

/** Spend transactions per 30 days. */
export function getTransactionFrequency(txs: Transaction[], p: Period, compare = true): Metric {
  const freq = (pp: Period) => (spendTxs(txs, pp).length / periodDays(pp)) * 30;
  return withComparison("transaction_frequency_per_30d", p, freq(p), freq, compare);
}

/**
 * Per-day weekend discretionary spend divided by per-day weekday discretionary
 * spend. Fixed costs (rent, bills, subscriptions) are excluded: their date is
 * arbitrary and would swing the ratio depending on which weekday the 1st falls on.
 */
export function getWeekendWeekdayRatio(txs: Transaction[], p: Period, compare = true): Metric {
  const ratio = (pp: Period) => {
    const rows = spendTxs(txs, pp).filter((t) => !isFixedTx(t));
    let we = 0;
    let wd = 0;
    let weDays = 0;
    let wdDays = 0;
    for (let d = pp.start; d <= pp.end; d = addDays(d, 1)) {
      if (isWeekend(d)) weDays++;
      else wdDays++;
    }
    for (const t of rows) {
      if (isWeekend(t.date)) we += spendAmount(t);
      else wd += spendAmount(t);
    }
    const wePer = weDays ? we / weDays : 0;
    const wdPer = wdDays ? wd / wdDays : 0;
    return wdPer ? wePer / wdPer : 0;
  };
  return withComparison("weekend_weekday_ratio", p, ratio(p), ratio, compare);
}

/**
 * Bank CSVs almost never carry a time of day. When no transaction has one,
 * this is reported as unavailable rather than guessed.
 */
export function getTimeOfDayDistribution(txs: Transaction[], p: Period): Metric<{ available: boolean; buckets: Array<{ bucket: string; share: number }> }> {
  const rows = spendTxs(txs, p);
  const withTime = rows.filter((t) => /\b\d{1,2}:\d{2}\b/.test(t.description));
  if (withTime.length < Math.max(10, rows.length * 0.5)) {
    return { metric: "time_of_day_distribution", value: { available: false, buckets: [] }, period: p, note: "Transactions do not carry a time of day." };
  }
  const buckets = { morning: 0, afternoon: 0, evening: 0, late: 0 };
  for (const t of withTime) {
    const m = t.description.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/i)!;
    let h = Number(m[1]) % 12;
    if (m[3]?.toLowerCase() === "pm") h += 12;
    const amt = spendAmount(t);
    if (h < 12) buckets.morning += amt;
    else if (h < 17) buckets.afternoon += amt;
    else if (h < 21) buckets.evening += amt;
    else buckets.late += amt;
  }
  const sum = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  return { metric: "time_of_day_distribution", value: { available: true, buckets: Object.entries(buckets).map(([bucket, v]) => ({ bucket, share: round2(v / sum) })) }, period: p };
}

/** Monthly cost of recurring merchants active in the period, excluding housing (rent dominates and hides everything else). */
export function getRecurringSpend(txs: Transaction[], p: Period, rules: SubscriptionRule[] = [], compare = true): Metric {
  const rec = (pp: Period) =>
    detectRecurring(inPeriod(txs, pp), rules)
      .filter((r) => r.confidence >= 0.6 && r.status !== "ignored" && r.category !== "Housing")
      .reduce((a, r) => a + r.monthlyCost, 0);
  return withComparison("recurring_monthly_spend", p, rec(p), rec, compare);
}

export function getSubscriptionCount(txs: Transaction[], p: Period, rules: SubscriptionRule[] = [], compare = true): Metric {
  const count = (pp: Period) => detectRecurring(inPeriod(txs, pp), rules).filter((r) => r.confidence >= 0.6 && r.status !== "ignored" && r.category !== "Housing").length;
  return withComparison("subscription_count", p, count(p), count, compare);
}

/** Coefficient of variation of complete-month totals (0 = perfectly steady). */
export function getSpendVolatility(txs: Transaction[], p: Period, compare = true): Metric {
  const vol = (pp: Period) => {
    const months = completeMonths(pp);
    if (months.length < 2) return 0;
    const totals = monthlyTotals(txs, pp, spendAmount).filter((m) => months.includes(m.month)).map((m) => m.value);
    const mu = mean(totals);
    return mu ? stdev(totals) / mu : 0;
  };
  return withComparison("spend_volatility_cv", p, vol(p), vol, compare);
}

function growthOf(txs: Transaction[], p: Period, filter: (t: Transaction) => boolean, metric: string): Metric {
  const cur = total(spendTxs(txs, p).filter(filter));
  const prev = previousPeriod(p);
  const prevTotal = total(spendTxs(txs, prev).filter(filter));
  return { metric, value: round2(cur), period: p, comparison: { previousPeriodValue: round2(prevTotal), changePct: pct(cur, prevTotal), previousPeriod: prev } };
}

export function getCategoryGrowth(txs: Transaction[], p: Period, category: Category): Metric {
  return growthOf(txs, p, (t) => t.category === category, `category_growth:${category}`);
}

export function getMerchantGrowth(txs: Transaction[], p: Period, merchant: string): Metric {
  return growthOf(txs, p, (t) => t.merchant === merchant, `merchant_growth:${merchant}`);
}

export function isFixedTx(t: Transaction): boolean {
  return t.recurring || FIXED_CATEGORIES.includes(t.category);
}

export function getFixedVsVariableSpend(txs: Transaction[], p: Period): Metric<{ fixed: number; variable: number; fixedShare: number }> {
  const rows = spendTxs(txs, p);
  const fixed = total(rows.filter(isFixedTx));
  const all = total(rows);
  return { metric: "fixed_vs_variable", value: { fixed: round2(fixed), variable: round2(all - fixed), fixedShare: all ? round2(fixed / all) : 0 }, period: p };
}

/** Median complete-month variable (non-fixed) spend: the "normal" discretionary level. */
export function getDiscretionaryBaseline(txs: Transaction[], p: Period, compare = true): Metric {
  const base = (pp: Period) => {
    const months = completeMonths(pp);
    const totals = monthlyTotals(txs, pp, (t) => (isFixedTx(t) ? 0 : spendAmount(t))).filter((m) => months.includes(m.month)).map((m) => m.value);
    return median(totals);
  };
  return withComparison("discretionary_baseline_monthly", p, base(p), base, compare);
}

/** How concentrated spending is: top-3 merchant share and a Herfindahl index over merchants. */
export function getSpendConcentration(txs: Transaction[], p: Period, compare = true): Metric<{ top3Share: number; hhi: number; topMerchants: string[] }> {
  const conc = (pp: Period) => {
    const rows = breakdown(txs, pp, (t) => t.merchant);
    const top3 = rows.slice(0, 3);
    return { top3Share: round2(top3.reduce((a, r) => a + r.share, 0)), hhi: round2(rows.reduce((a, r) => a + r.share ** 2, 0)), topMerchants: top3.map((r) => r.key) };
  };
  const value = conc(p);
  const m: Metric<{ top3Share: number; hhi: number; topMerchants: string[] }> = { metric: "spend_concentration", value, period: p };
  if (compare) {
    const prev = previousPeriod(p);
    const pv = conc(prev);
    m.comparison = { previousPeriodValue: pv, changePct: pct(value.top3Share, pv.top3Share), previousPeriod: prev };
  }
  return m;
}

export function getOutlierTransactions(txs: Transaction[], p: Period): Metric<{ threshold: number; count: number; total: number; ids: string[] }> {
  const rows = spendTxs(txs, p).filter((t) => !isFixedTx(t));
  const amounts = rows.map(spendAmount);
  const med = median(amounts);
  const threshold = Math.max(med * 3, mean(amounts) + 2 * stdev(amounts));
  const outliers = rows.filter((t) => spendAmount(t) > threshold);
  return { metric: "outlier_transactions", value: { threshold: round2(threshold), count: outliers.length, total: round2(total(outliers)), ids: outliers.map((t) => t.id) }, period: p };
}

function rollingAverage(txs: Transaction[], asOfMonth: string, n: number): number {
  const months = Array.from({ length: n }, (_, i) => addMonths(asOfMonth, -(i + 1)));
  const totals = months.map((m) => total(spendTxs(txs, periodForMonth(m))));
  const nonEmpty = totals.filter((t) => t > 0);
  return nonEmpty.length ? mean(nonEmpty) : 0;
}

/** Average of the 3 complete months before the period's month. */
export function getRolling3MonthAverage(txs: Transaction[], asOfMonth: string): Metric {
  return { metric: "rolling_3m_average", value: round2(rollingAverage(txs, asOfMonth, 3)), period: { start: monthRange(addMonths(asOfMonth, -3)).from, end: monthRange(addMonths(asOfMonth, -1)).to } };
}

export function getRolling12MonthAverage(txs: Transaction[], asOfMonth: string): Metric {
  return { metric: "rolling_12m_average", value: round2(rollingAverage(txs, asOfMonth, 12)), period: { start: monthRange(addMonths(asOfMonth, -12)).from, end: monthRange(addMonths(asOfMonth, -1)).to } };
}

export function getMonthOverMonthChange(txs: Transaction[], month: string): Metric {
  const cur = total(spendTxs(txs, periodForMonth(month)));
  const prevM = addMonths(month, -1);
  const prev = total(spendTxs(txs, periodForMonth(prevM)));
  return { metric: "month_over_month_change", value: round2(cur), period: periodForMonth(month), comparison: { previousPeriodValue: round2(prev), changePct: pct(cur, prev), previousPeriod: periodForMonth(prevM) } };
}

export function getYearOverYearChange(txs: Transaction[], month: string): Metric {
  const cur = total(spendTxs(txs, periodForMonth(month)));
  const prevM = addMonths(month, -12);
  const prev = total(spendTxs(txs, periodForMonth(prevM)));
  const m: Metric = { metric: "year_over_year_change", value: round2(cur), period: periodForMonth(month), comparison: { previousPeriodValue: round2(prev), changePct: pct(cur, prev), previousPeriod: periodForMonth(prevM) } };
  if (!prev) m.note = "No data for the same month last year.";
  return m;
}

export function getIncomeToSpendRatio(txs: Transaction[], p: Period, compare = true): Metric {
  const ratio = (pp: Period) => {
    const rows = inPeriod(txs, pp);
    const income = rows.reduce((a, t) => a + (t.transactionType === "income" ? t.amount : 0), 0);
    const spend = total(rows);
    return spend ? income / spend : 0;
  };
  return withComparison("income_to_spend_ratio", p, ratio(p), ratio, compare);
}

/** (income − spend) / income, or null when there is no income in the period. */
export function getSavingsRateIfIncomeExists(txs: Transaction[], p: Period, compare = true): Metric<number | null> {
  const rate = (pp: Period): number | null => {
    const rows = inPeriod(txs, pp);
    const income = rows.reduce((a, t) => a + (t.transactionType === "income" ? t.amount : 0), 0);
    if (income <= 0) return null;
    return round2((income - total(rows)) / income);
  };
  const value = rate(p);
  const m: Metric<number | null> = { metric: "savings_rate", value, period: p };
  if (value === null) m.note = "No income transactions in the period.";
  if (compare) {
    const prev = previousPeriod(p);
    const pv = rate(prev);
    m.comparison = { previousPeriodValue: pv, changePct: value != null && pv ? pct(value, pv) : null, previousPeriod: prev };
  }
  return m;
}

/** Day-of-week profile (Mon..Sun) as per-day averages. */
export function getWeekdayProfile(txs: Transaction[], p: Period): Metric<Array<{ day: string; perDay: number }>> {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = days.map(() => 0);
  const counts = days.map(() => 0);
  for (let d = p.start; d <= p.end; d = addDays(d, 1)) counts[(parseISO(d).getUTCDay() + 6) % 7]++;
  for (const t of spendTxs(txs, p)) totals[(parseISO(t.date).getUTCDay() + 6) % 7] += spendAmount(t);
  return { metric: "weekday_profile", value: days.map((day, i) => ({ day, perDay: round2(counts[i] ? totals[i] / counts[i] : 0) })), period: p };
}
