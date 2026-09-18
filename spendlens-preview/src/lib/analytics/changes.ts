import type { Category, Transaction } from "../types";
import { addMonths, monthLabel } from "../dates";
import { inMonth, spendingTransactions, sum, sumBy } from "./core";

export interface Contribution<K extends string = string> {
  key: K;
  current: number;
  previous: number;
  delta: number;
  /** Share of the total absolute change explained by this item. */
  share: number;
  isNew: boolean;
  disappeared: boolean;
}

export interface ChangeAnalysis {
  month: string;
  previousMonth: string;
  monthLabel: string;
  previousLabel: string;
  currentTotal: number;
  previousTotal: number;
  delta: number;
  ratio: number | null;
  categories: Contribution<Category>[];
  merchants: Contribution[];
  /** Plain-English summary lines, ready to render. */
  narrative: string[];
}

function contributions<K extends string>(
  cur: Map<K, number>,
  prev: Map<K, number>,
  totalDelta: number,
): Contribution<K>[] {
  const keys = new Set<K>([...cur.keys(), ...prev.keys()]);
  const denom = Math.abs(totalDelta) || 1;
  const out: Contribution<K>[] = [];
  for (const k of keys) {
    const c = cur.get(k) ?? 0;
    const p = prev.get(k) ?? 0;
    const delta = c - p;
    if (Math.abs(delta) < 1) continue;
    out.push({ key: k, current: c, previous: p, delta, share: delta / denom, isNew: p === 0, disappeared: c === 0 });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function analyzeChanges(txs: Transaction[], month: string): ChangeAnalysis {
  const previousMonth = addMonths(month, -1);
  const spending = spendingTransactions(txs);
  const cur = inMonth(spending, month);
  const prev = inMonth(spending, previousMonth);
  const currentTotal = sum(cur);
  const previousTotal = sum(prev);
  const delta = currentTotal - previousTotal;

  const categories = contributions(sumBy(cur, (t) => t.category), sumBy(prev, (t) => t.category), delta);
  const merchants = contributions(sumBy(cur, (t) => t.merchant), sumBy(prev, (t) => t.merchant), delta);

  return {
    month,
    previousMonth,
    monthLabel: monthLabel(month),
    previousLabel: monthLabel(previousMonth),
    currentTotal,
    previousTotal,
    delta,
    ratio: previousTotal > 0 ? delta / previousTotal : null,
    categories,
    merchants: merchants.slice(0, 12),
    narrative: buildNarrative(month, delta, previousTotal, categories),
  };
}

function buildNarrative(month: string, delta: number, previousTotal: number, cats: Contribution<Category>[]): string[] {
  const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  const name = monthLabel(month).split(" ")[0];
  const lines: string[] = [];
  if (previousTotal === 0) {
    lines.push(`${name} is the first month with spending data, so there is nothing to compare yet.`);
    return lines;
  }
  if (Math.abs(delta) < 1) lines.push(`${name} spending was flat compared to the previous month.`);
  else lines.push(`${name} spending ${delta > 0 ? "increased" : "decreased"} by ${fmt(delta)}.`);

  const movers = cats.filter((c) => Math.abs(c.delta) >= 20).slice(0, 4);
  for (const c of movers) {
    if (c.isNew) lines.push(`${c.key} appeared for the first time at ${fmt(c.current)}.`);
    else if (c.disappeared) lines.push(`${c.key} dropped to zero from ${fmt(c.previous)}.`);
    else lines.push(`${c.key} ${c.delta > 0 ? "contributed +" : "decreased by "}${fmt(c.delta)}.`);
  }
  return lines;
}
