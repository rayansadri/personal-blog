import type { Account, Category, SubscriptionRule, Transaction } from "../types";
import { addMonths, monthLabel } from "../dates";
import { inMonth, spendingTransactions, sum, sumBy, topEntries } from "./core";
import { detectRecurring, type RecurringPayment } from "./recurring";

export interface CardProfile {
  account: Account;
  month: string;
  monthLabel: string;
  monthSpending: number;
  previousSpending: number;
  changeRatio: number | null;
  averageMonthly: number;
  transactionCount: number;
  totalTransactions: number;
  firstUsed: string | null;
  lastUsed: string | null;
  /** Share of all spending across every account this month. */
  shareOfSpending: number;
  trend: Array<{ month: string; label: string; total: number }>;
  byCategory: Array<{ category: Category; amount: number; share: number; count: number }>;
  topMerchants: Array<{ merchant: string; amount: number; count: number; category: Category }>;
  recurring: RecurringPayment[];
  recurringMonthly: number;
  recent: Transaction[];
  /** One-line description of what this card is mostly used for. */
  purpose: string;
}

/** Build a profile for every account in one pass so the UI can switch instantly. */
export function buildCardProfiles(txs: Transaction[], accounts: Account[], month: string, rules: SubscriptionRule[] = []): CardProfile[] {
  const spending = spendingTransactions(txs);
  const allThisMonth = sum(inMonth(spending, month));
  const recurringAll = detectRecurring(txs, rules).filter((r) => r.confidence >= 0.6);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, -(5 - i)));

  return accounts.map((account) => {
    const mine = txs.filter((t) => t.account === account.name);
    const mySpend = spending.filter((t) => t.account === account.name);
    const thisMonth = inMonth(mySpend, month);
    const prev = inMonth(mySpend, addMonths(month, -1));
    const monthSpending = sum(thisMonth);
    const previousSpending = sum(prev);

    const activeMonths = new Set(mySpend.map((t) => t.date.slice(0, 7)));
    const averageMonthly = activeMonths.size ? sum(mySpend) / activeMonths.size : 0;

    const catMap = sumBy(thisMonth.length ? thisMonth : mySpend, (t) => t.category);
    const base = thisMonth.length ? thisMonth : mySpend;
    const baseTotal = sum(base);
    const catCount = new Map<Category, number>();
    for (const t of base) catCount.set(t.category, (catCount.get(t.category) ?? 0) + 1);
    const byCategory = [...catMap.entries()]
      .map(([category, amount]) => ({ category, amount, share: baseTotal ? amount / baseTotal : 0, count: catCount.get(category) ?? 0 }))
      .sort((a, b) => b.amount - a.amount);

    const merchCount = new Map<string, number>();
    const merchCat = new Map<string, Category>();
    for (const t of base) {
      merchCount.set(t.merchant, (merchCount.get(t.merchant) ?? 0) + 1);
      merchCat.set(t.merchant, t.category);
    }
    const topMerchants = topEntries(sumBy(base, (t) => t.merchant), 6).map(({ key, value }) => ({
      merchant: key,
      amount: value,
      count: merchCount.get(key) ?? 0,
      category: merchCat.get(key) ?? "Other",
    }));

    const recurring = recurringAll.filter((r) => r.accounts.includes(account.name));
    const dates = mine.map((t) => t.date).sort();

    return {
      account,
      month,
      monthLabel: monthLabel(month),
      monthSpending,
      previousSpending,
      changeRatio: previousSpending > 0 ? (monthSpending - previousSpending) / previousSpending : null,
      averageMonthly,
      transactionCount: thisMonth.length,
      totalTransactions: mine.length,
      firstUsed: dates[0] ?? null,
      lastUsed: dates[dates.length - 1] ?? null,
      shareOfSpending: allThisMonth ? monthSpending / allThisMonth : 0,
      trend: months.map((m) => ({ month: m, label: monthLabel(m, "short"), total: sum(inMonth(mySpend, m)) })),
      byCategory,
      topMerchants,
      recurring,
      recurringMonthly: recurring.reduce((a, r) => a + r.monthlyCost, 0),
      recent: [...mine].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
      purpose: describePurpose(byCategory, recurring.length, mySpend.length),
    };
  });
}

function describePurpose(cats: CardProfile["byCategory"], recurringCount: number, n: number): string {
  if (!n) return "No spending on this card yet.";
  const top = cats.slice(0, 2).filter((c) => c.share >= 0.15);
  const parts: string[] = [];
  if (top.length === 1) parts.push(`Mostly ${top[0].category.toLowerCase()} (${Math.round(top[0].share * 100)}%)`);
  else if (top.length === 2) parts.push(`Mostly ${top[0].category.toLowerCase()} and ${top[1].category.toLowerCase()}`);
  else parts.push("Spread across many categories");
  if (recurringCount) parts.push(`${recurringCount} recurring ${recurringCount === 1 ? "payment" : "payments"}`);
  return parts.join(" · ");
}
