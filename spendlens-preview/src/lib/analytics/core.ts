import type { Category, Transaction } from "../types";
import { FIXED_CATEGORIES } from "../types";
import { monthKey } from "../dates";

/** Spending = expenses only. Amount is returned as a positive number. */
export function isSpending(t: Transaction): boolean {
  return t.transactionType === "expense" && !t.flags.includes("duplicate");
}

/** What this transaction cost *you*: the full amount minus anyone else's share of a split. */
export function spend(t: Transaction): number {
  return Math.max(0, Math.abs(t.amount) - (t.splitOthers ?? 0));
}

export function spendingTransactions(txs: Transaction[]): Transaction[] {
  return txs.filter(isSpending);
}

export function inMonth(txs: Transaction[], month: string): Transaction[] {
  return txs.filter((t) => monthKey(t.date) === month);
}

export function inRange(txs: Transaction[], from: string, to: string): Transaction[] {
  return txs.filter((t) => t.date >= from && t.date <= to);
}

export function sum(txs: Transaction[]): number {
  return txs.reduce((acc, t) => acc + spend(t), 0);
}

export function sumBy<K extends string>(txs: Transaction[], key: (t: Transaction) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const t of txs) m.set(key(t), (m.get(key(t)) ?? 0) + spend(t));
  return m;
}

export function countBy<K extends string>(txs: Transaction[], key: (t: Transaction) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const t of txs) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
  return m;
}

export function isFixed(t: Transaction): boolean {
  return t.recurring || FIXED_CATEGORIES.includes(t.category);
}

/** Sorted list of months (YYYY-MM) that have any transaction. */
export function availableMonths(txs: Transaction[]): string[] {
  return [...new Set(txs.map((t) => monthKey(t.date)))].sort();
}

export function latestMonth(txs: Transaction[]): string | null {
  const months = availableMonths(txs);
  return months[months.length - 1] ?? null;
}

export function topEntries<K extends string>(m: Map<K, number>, n: number): Array<{ key: K; value: number }> {
  return [...m.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export type CategoryTotals = Partial<Record<Category, number>>;
