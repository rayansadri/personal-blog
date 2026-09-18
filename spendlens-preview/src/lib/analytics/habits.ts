import type { Category, Transaction } from "../types";
import { daysBetween, monthLabel, parseISO } from "../dates";
import { availableMonths, inMonth, isFixed, spend, spendingTransactions, sum, sumBy } from "./core";
import { detectRecurring } from "./recurring";
import type { SubscriptionRule } from "../types";

/**
 * Whole-history analysis: who you are with money, from the first transaction
 * to the last. Everything is deterministic and explainable.
 */

export type Trend = "rising" | "falling" | "steady";

export interface MerchantHabit {
  merchant: string;
  category: Category;
  total: number;
  count: number;
  avgPerVisit: number;
  perMonth: number;
  /** Visits per week over the active span. */
  perWeek: number;
  yearlyRunRate: number;
  firstSeen: string;
  lastSeen: string;
  /** Share of all spending in the span. */
  share: number;
  /** Which days this happens: "weekdays", "weekends", or a specific day name. */
  when: string;
  trend: Trend;
  /** Month-over-month slope as a share of the average month (+0.12 = growing 12%/mo). */
  slope: number;
  monthly: Array<{ month: string; total: number; count: number }>;
  /** What halving this would save per year. */
  halfSaves: number;
}

export interface CategoryHabit {
  category: Category;
  total: number;
  count: number;
  perMonth: number;
  share: number;
  trend: Trend;
  slope: number;
  weekendShare: number;
  monthly: Array<{ month: string; total: number }>;
}

export interface Personality {
  id: string;
  title: string;
  evidence: string;
  tone: "neutral" | "up" | "down";
}

export interface HabitsReport {
  from: string;
  to: string;
  months: string[];
  monthsCount: number;
  totalSpent: number;
  totalIncome: number;
  savingsRate: number | null;
  avgMonthly: number;
  transactionCount: number;
  fixedShare: number;
  merchants: MerchantHabit[];
  categories: CategoryHabit[];
  /** Spending by weekday, Monday first. */
  weekdays: Array<{ day: string; total: number; count: number; perDay: number }>;
  weekendVsWeekdayPerDay: { weekend: number; weekday: number };
  /** Which third of the month you spend in. */
  monthThirds: { early: number; mid: number; late: number };
  /** Purchases above 3× your median purchase. */
  impulse: { count: number; total: number; median: number; largest: Transaction | null };
  subscriptionsLifetime: number;
  subscriptionsMonthly: number;
  streaks: { longestWithoutDelivery: number; longestDeliveryRun: number; currentWithoutDelivery: number };
  personality: Personality[];
  /** Stacked monthly totals for the top categories (others folded into "Other"). */
  stacked: Array<Record<string, number | string>>;
  stackedKeys: Category[];
  headline: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function buildHabits(txs: Transaction[], rules: SubscriptionRule[] = [], range?: { from: string; to: string }): HabitsReport | null {
  let all = txs;
  if (range) all = all.filter((t) => t.date >= range.from && t.date <= range.to);
  const spending = spendingTransactions(all);
  if (!spending.length) return null;

  const dates = all.map((t) => t.date).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const months = availableMonths(spending);
  const spanDays = Math.max(1, daysBetween(from, to) + 1);
  const spanMonths = Math.max(1, spanDays / 30.44);
  const totalSpent = sum(spending);
  const totalIncome = all.filter((t) => t.transactionType === "income").reduce((a, t) => a + t.amount, 0);

  // ---- merchants ----
  const byMerchant = new Map<string, Transaction[]>();
  for (const t of spending) byMerchant.set(t.merchant, [...(byMerchant.get(t.merchant) ?? []), t]);
  const merchants: MerchantHabit[] = [...byMerchant.entries()]
    .map(([merchant, list]) => {
      const total = sum(list);
      const monthly = months.map((m) => {
        const inM = inMonth(list, m);
        return { month: m, total: sum(inM), count: inM.length };
      });
      const { trend, slope } = trendOf(monthly.map((x) => x.total));
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      return {
        merchant,
        category: list[list.length - 1].category,
        total,
        count: list.length,
        avgPerVisit: total / list.length,
        perMonth: total / spanMonths,
        perWeek: list.length / (spanDays / 7),
        yearlyRunRate: (total / spanMonths) * 12,
        firstSeen: sorted[0].date,
        lastSeen: sorted[sorted.length - 1].date,
        share: total / totalSpent,
        when: whenLabel(list),
        trend,
        slope,
        monthly,
        halfSaves: ((total / spanMonths) * 12) / 2,
      };
    })
    .sort((a, b) => b.total - a.total);

  // ---- categories ----
  const catMap = sumBy(spending, (t) => t.category);
  const categories: CategoryHabit[] = [...catMap.entries()]
    .map(([category, total]) => {
      const list = spending.filter((t) => t.category === category);
      const monthly = months.map((m) => ({ month: m, total: sum(inMonth(list, m)) }));
      const { trend, slope } = trendOf(monthly.map((x) => x.total));
      const weekend = sum(list.filter((t) => isWeekendDate(t.date)));
      return { category, total, count: list.length, perMonth: total / spanMonths, share: total / totalSpent, trend, slope, weekendShare: total ? weekend / total : 0, monthly };
    })
    .sort((a, b) => b.total - a.total);

  // ---- weekday profile (discretionary only; fixed bills land on arbitrary weekdays) ----
  const dayTotals = DAYS.map(() => ({ total: 0, count: 0 }));
  const discretionary = spending.filter((t) => !isFixed(t));
  for (const t of discretionary) {
    const d = (parseISO(t.date).getUTCDay() + 6) % 7;
    dayTotals[d].total += spend(t);
    dayTotals[d].count++;
  }
  const weeks = Math.max(1, spanDays / 7);
  const weekdays = DAYS.map((day, i) => ({ day, total: dayTotals[i].total, count: dayTotals[i].count, perDay: dayTotals[i].total / weeks }));
  const weekendTotal = dayTotals[5].total + dayTotals[6].total;
  const weekdayTotal = sum(discretionary) - weekendTotal;
  const weekendVsWeekdayPerDay = { weekend: weekendTotal / (weeks * 2), weekday: weekdayTotal / (weeks * 5) };

  // ---- thirds of the month ----
  const thirds = { early: 0, mid: 0, late: 0 };
  for (const t of spending) {
    const d = Number(t.date.slice(8, 10));
    if (d <= 10) thirds.early += spend(t);
    else if (d <= 20) thirds.mid += spend(t);
    else thirds.late += spend(t);
  }

  // ---- impulse purchases ----
  const amounts = spending.map(spend).sort((a, b) => a - b);
  const median = amounts[Math.floor(amounts.length / 2)] ?? 0;
  const impulseList = spending.filter((t) => spend(t) > median * 3 && !isFixed(t) && t.category !== "Housing" && t.category !== "Travel");
  const impulse = {
    count: impulseList.length,
    total: sum(impulseList),
    median,
    largest: [...impulseList].sort((a, b) => spend(b) - spend(a))[0] ?? null,
  };

  // ---- subscriptions over the span ----
  const recurring = detectRecurring(all, rules).filter((r) => r.confidence >= 0.6 && r.status !== "ignored");
  const recurringMerchants = new Set(recurring.map((r) => r.merchant));
  const subscriptionsLifetime = sum(spending.filter((t) => t.category === "Subscriptions" || recurringMerchants.has(t.merchant)).filter((t) => t.category !== "Housing"));
  const subscriptionsMonthly = recurring.filter((r) => r.category !== "Housing").reduce((a, r) => a + r.monthlyCost, 0);

  // ---- delivery streaks (days) ----
  const deliveryDays = [...new Set(spending.filter((t) => t.category === "Delivery").map((t) => t.date))].sort();
  const streaks = deliveryStreaks(deliveryDays, from, to);

  const fixedShare = totalSpent ? sum(spending.filter(isFixed)) / totalSpent : 0;

  // ---- stacked monthly chart data ----
  const topCats = categories.slice(0, 6).map((c) => c.category);
  const stackedKeys: Category[] = [...topCats, ...(categories.length > 6 ? (["Other"] as Category[]) : [])].filter((c, i, arr) => arr.indexOf(c) === i);
  const stacked = months.map((m) => {
    const inM = inMonth(spending, m);
    const row: Record<string, number | string> = { month: m, label: monthLabel(m, "short") };
    for (const k of stackedKeys) row[k] = 0;
    for (const t of inM) {
      const key = topCats.includes(t.category) ? t.category : "Other";
      row[key] = ((row[key] as number) ?? 0) + spend(t);
    }
    return row;
  });

  const report: HabitsReport = {
    from,
    to,
    months,
    monthsCount: months.length,
    totalSpent,
    totalIncome,
    savingsRate: totalIncome > 0 ? (totalIncome - totalSpent) / totalIncome : null,
    avgMonthly: totalSpent / spanMonths,
    transactionCount: spending.length,
    fixedShare,
    merchants,
    categories,
    weekdays,
    weekendVsWeekdayPerDay,
    monthThirds: thirds,
    impulse,
    subscriptionsLifetime,
    subscriptionsMonthly,
    streaks,
    personality: [],
    stacked,
    stackedKeys,
    headline: "",
  };
  report.personality = personalityOf(report);
  report.headline = headlineOf(report);
  return report;
}

function isWeekendDate(iso: string): boolean {
  const d = parseISO(iso).getUTCDay();
  return d === 0 || d === 6;
}

/** Where in the week a merchant shows up. */
function whenLabel(list: Transaction[]): string {
  if (list.length < 3) return "occasionally";
  const counts = DAYS.map(() => 0);
  for (const t of list) counts[(parseISO(t.date).getUTCDay() + 6) % 7]++;
  const weekend = counts[5] + counts[6];
  const n = list.length;
  const top = counts.indexOf(Math.max(...counts));
  if (counts[top] / n >= 0.45) return `mostly ${DAYS[top]}s`;
  if (weekend / n >= 0.6) return "mostly weekends";
  if (weekend / n <= 0.15) return "weekdays";
  return "all week";
}

/** Least-squares slope over the months, normalized by the mean. Ignores a single-month history. */
function trendOf(values: number[]): { trend: Trend; slope: number } {
  const v = values.filter((_, i) => i < values.length); // keep order
  const n = v.length;
  if (n < 3) return { trend: "steady", slope: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  if (mean <= 0) return { trend: "steady", slope: 0 };
  const xs = v.map((_, i) => i - (n - 1) / 2);
  const slopeAbs = xs.reduce((a, x, i) => a + x * (v[i] - mean), 0) / xs.reduce((a, x) => a + x * x, 0);
  const slope = slopeAbs / mean;
  return { trend: slope > 0.08 ? "rising" : slope < -0.08 ? "falling" : "steady", slope };
}

function deliveryStreaks(days: string[], from: string, to: string) {
  if (!days.length) return { longestWithoutDelivery: daysBetween(from, to) + 1, longestDeliveryRun: 0, currentWithoutDelivery: daysBetween(from, to) + 1 };
  let longestGap = daysBetween(from, days[0]);
  let longestRun = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = daysBetween(days[i - 1], days[i]);
    longestGap = Math.max(longestGap, gap - 1);
    if (gap <= 1) run++;
    else run = 1;
    longestRun = Math.max(longestRun, run);
  }
  const current = daysBetween(days[days.length - 1], to);
  return { longestWithoutDelivery: Math.max(longestGap, current), longestDeliveryRun: longestRun, currentWithoutDelivery: current };
}

/** Deterministic "money personality" labels with evidence. */
function personalityOf(r: HabitsReport): Personality[] {
  const out: Personality[] = [];
  const cat = (c: Category) => r.categories.find((x) => x.category === c);
  const delivery = cat("Delivery");
  const dining = cat("Dining");
  const shopping = cat("Shopping");
  const eatingOut = (delivery?.total ?? 0) + (dining?.total ?? 0);
  const deliveryMerchant = r.merchants.find((m) => m.category === "Delivery");

  if (delivery && delivery.count / r.monthsCount >= 6) {
    out.push({ id: "delivery-regular", title: "The Delivery Regular", evidence: `${delivery.count} delivery orders in ${r.monthsCount} months, ${fmt(delivery.total)} total${deliveryMerchant ? `, mostly ${deliveryMerchant.merchant}` : ""}. That's ${fmt(delivery.perMonth * 12)} a year.`, tone: "up" });
  }
  if (eatingOut / r.totalSpent >= 0.2) {
    out.push({ id: "foodie", title: "Eats Out More Than In", evidence: `${Math.round((eatingOut / r.totalSpent) * 100)}% of everything went to restaurants and delivery: ${fmt(eatingOut)} over ${r.monthsCount} months.`, tone: "neutral" });
  }
  if (r.weekendVsWeekdayPerDay.weekday > 0 && r.weekendVsWeekdayPerDay.weekend / r.weekendVsWeekdayPerDay.weekday >= 1.6) {
    out.push({ id: "weekend", title: "Weekend Spender", evidence: `A weekend day costs ${(r.weekendVsWeekdayPerDay.weekend / r.weekendVsWeekdayPerDay.weekday).toFixed(1)}× a weekday. Saturday you has a different budget.`, tone: "neutral" });
  } else if (r.weekendVsWeekdayPerDay.weekend > 0 && r.weekendVsWeekdayPerDay.weekday / r.weekendVsWeekdayPerDay.weekend >= 1.6) {
    out.push({ id: "weekday", title: "Weekday Spender", evidence: `You spend ${(r.weekendVsWeekdayPerDay.weekday / r.weekendVsWeekdayPerDay.weekend).toFixed(1)}× more per day on weekdays than weekends. Work life is expensive.`, tone: "neutral" });
  }
  const subCount = r.merchants.filter((m) => m.category === "Subscriptions").length;
  if (subCount >= 5) {
    out.push({ id: "collector", title: "Subscription Collector", evidence: `${subCount} subscriptions running, ${fmt(r.subscriptionsMonthly)}/month, ${fmt(r.subscriptionsLifetime)} so far.`, tone: "neutral" });
  }
  const loyal = r.merchants.filter((m) => m.count >= r.monthsCount * 3 && m.category !== "Subscriptions" && m.category !== "Housing")[0];
  if (loyal) {
    out.push({ id: "loyal", title: `${loyal.merchant} Loyalist`, evidence: `${loyal.count} visits (${loyal.perWeek.toFixed(1)}×/week, ${loyal.when}), ${fmt(loyal.total)} total, ${fmt(loyal.avgPerVisit)} a visit.`, tone: "neutral" });
  }
  if (r.impulse.count >= 3 && r.impulse.total / r.totalSpent >= 0.1) {
    out.push({ id: "impulse", title: "Big-Swing Buyer", evidence: `${r.impulse.count} purchases over 3× your usual ${fmt(r.impulse.median)}, adding up to ${fmt(r.impulse.total)}${r.impulse.largest ? `. Biggest: ${fmt(r.impulse.largest.amount)} at ${r.impulse.largest.merchant}` : ""}.`, tone: "up" });
  }
  if (shopping && shopping.trend === "rising") {
    out.push({ id: "shopping-up", title: "Shopping Is Creeping Up", evidence: `Shopping grows about ${Math.round(shopping.slope * 100)}% a month. ${fmt(shopping.perMonth)}/month now.`, tone: "up" });
  }
  if (r.fixedShare >= 0.6) {
    out.push({ id: "committed", title: "Mostly Committed Costs", evidence: `${Math.round(r.fixedShare * 100)}% of your spending is rent, bills and subscriptions. The variable part is small; the fixed part is the lever.`, tone: "neutral" });
  } else if (r.fixedShare <= 0.35) {
    out.push({ id: "free-spirit", title: "Low Fixed Costs", evidence: `Only ${Math.round(r.fixedShare * 100)}% of spending is committed. The rest is choices, which is good news for changing habits.`, tone: "down" });
  }
  if (r.savingsRate != null && r.savingsRate >= 0.25) {
    out.push({ id: "saver", title: "Quiet Saver", evidence: `You kept ${Math.round(r.savingsRate * 100)}% of your income over the period. Respect.`, tone: "down" });
  } else if (r.savingsRate != null && r.savingsRate < 0) {
    out.push({ id: "overspend", title: "Spending Past Income", evidence: `Spending exceeded income by ${fmt(r.totalSpent - r.totalIncome)} over the period. Worth a look at the big ones below.`, tone: "up" });
  }
  const falling = r.categories.filter((c) => c.trend === "falling" && c.total / r.totalSpent >= 0.05)[0];
  if (falling) out.push({ id: "improving", title: `${falling.category} Is Shrinking`, evidence: `Down about ${Math.round(-falling.slope * 100)}% a month. Whatever you're doing there, keep doing it.`, tone: "down" });
  return out.slice(0, 6);
}

function headlineOf(r: HabitsReport): string {
  const top = r.merchants[0];
  const span = r.monthsCount === 1 ? "this month" : `${r.monthsCount} months`;
  if (!top) return `You spent ${fmt(r.totalSpent)} over ${span}.`;
  return `${fmt(r.totalSpent)} over ${span}. ${top.merchant} alone took ${fmt(top.total)} in ${top.count} ${top.count === 1 ? "charge" : "charges"}.`;
}
