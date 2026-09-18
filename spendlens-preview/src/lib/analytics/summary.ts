import type { Category, SubscriptionRule, Transaction } from "../types";
import { addMonths, isWeekend, monthKey, monthLabel, weekStart } from "../dates";
import { availableMonths, inMonth, isFixed, spend, spendingTransactions, sum, sumBy, topEntries } from "./core";
import { detectRecurring } from "./recurring";

export interface MonthPoint {
  month: string;
  label: string;
  total: number;
  fixed: number;
  variable: number;
  count: number;
}

export interface DashboardSummary {
  month: string;
  monthLabel: string;
  availableMonths: string[];
  totalSpending: number;
  previousSpending: number;
  changeAmount: number;
  changeRatio: number | null;
  fixedSpending: number;
  variableSpending: number;
  recurringMonthly: number;
  recurringCount: number;
  transactionCount: number;
  income: number;
  refunds: number;
  trend: MonthPoint[];
  byCategory: Array<{ category: Category; amount: number; count: number; share: number }>;
  byMerchant: Array<{ merchant: string; amount: number; count: number; category: Category }>;
  weekly: Array<{ weekStart: string; amount: number }>;
  weekendRatio: number | null;
}

export function monthlyTrend(txs: Transaction[], months: string[]): MonthPoint[] {
  const spending = spendingTransactions(txs);
  return months.map((m) => {
    const inM = inMonth(spending, m);
    const fixed = sum(inM.filter(isFixed));
    const total = sum(inM);
    return { month: m, label: monthLabel(m, "short"), total, fixed, variable: total - fixed, count: inM.length };
  });
}

export function buildDashboard(txs: Transaction[], month: string, rules: SubscriptionRule[] = []): DashboardSummary {
  const months = availableMonths(txs);
  const spending = spendingTransactions(txs);
  const thisMonth = inMonth(spending, month);
  const prevMonth = inMonth(spending, addMonths(month, -1));

  const totalSpending = sum(thisMonth);
  const previousSpending = sum(prevMonth);
  const changeAmount = totalSpending - previousSpending;
  const changeRatio = previousSpending > 0 ? changeAmount / previousSpending : null;

  const fixedSpending = sum(thisMonth.filter(isFixed));

  const recurring = detectRecurring(txs, rules);
  const recurringMonthly = recurring
    .filter((r) => r.confidence >= 0.6)
    .reduce((acc, r) => acc + r.monthlyCost, 0);

  const catMap = sumBy(thisMonth, (t) => t.category);
  const catCount = new Map<Category, number>();
  for (const t of thisMonth) catCount.set(t.category, (catCount.get(t.category) ?? 0) + 1);
  const byCategory = [...catMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      count: catCount.get(category) ?? 0,
      share: totalSpending > 0 ? amount / totalSpending : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const merchMap = sumBy(thisMonth, (t) => t.merchant);
  const merchCount = new Map<string, number>();
  const merchCat = new Map<string, Category>();
  for (const t of thisMonth) {
    merchCount.set(t.merchant, (merchCount.get(t.merchant) ?? 0) + 1);
    merchCat.set(t.merchant, t.category);
  }
  const byMerchant = topEntries(merchMap, 8).map(({ key, value }) => ({
    merchant: key,
    amount: value,
    count: merchCount.get(key) ?? 0,
    category: merchCat.get(key) ?? "Other",
  }));

  // Weekly totals across the trailing 12 weeks ending at the end of the month.
  const weekMap = new Map<string, number>();
  const recentSpend = spending.filter((t) => monthKey(t.date) <= month);
  for (const t of recentSpend) weekMap.set(weekStart(t.date), (weekMap.get(weekStart(t.date)) ?? 0) + spend(t));
  const weekly = [...weekMap.entries()]
    .map(([weekStart, amount]) => ({ weekStart, amount }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-12);

  // Weekend bias is about discretionary spending: rent and bills land on arbitrary weekdays.
  const discretionary = thisMonth.filter((t) => !isFixed(t));
  const weekendSpend = sum(discretionary.filter((t) => isWeekend(t.date)));
  const weekdaySpend = sum(discretionary) - weekendSpend;
  // Normalize per day: 2 weekend days vs 5 weekdays.
  const weekendRatio = weekdaySpend > 0 ? weekendSpend / 2 / (weekdaySpend / 5) : null;

  const trendMonths = months.filter((m) => m <= month).slice(-12);

  return {
    month,
    monthLabel: monthLabel(month),
    availableMonths: months,
    totalSpending,
    previousSpending,
    changeAmount,
    changeRatio,
    fixedSpending,
    variableSpending: totalSpending - fixedSpending,
    recurringMonthly,
    recurringCount: recurring.filter((r) => r.confidence >= 0.6).length,
    transactionCount: thisMonth.length,
    income: inMonth(txs, month)
      .filter((t) => t.transactionType === "income")
      .reduce((a, t) => a + t.amount, 0),
    refunds: inMonth(txs, month)
      .filter((t) => t.transactionType === "refund")
      .reduce((a, t) => a + t.amount, 0),
    trend: monthlyTrend(txs, trendMonths),
    byCategory,
    byMerchant,
    weekly,
    weekendRatio,
  };
}
