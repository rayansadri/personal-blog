import type { Category, SubscriptionRule, Transaction } from "../types";
import { addMonths, isWeekend, monthName } from "../dates";
import { analyzeChanges } from "./changes";
import { countBy, inMonth, isFixed, spend, spendingTransactions, sum, sumBy } from "./core";
import { detectRecurring } from "./recurring";
import { quipFor } from "./quips";

export type InsightKind =
  | "total-change"
  | "vs-average"
  | "category-change"
  | "merchant-change"
  | "frequency"
  | "subscriptions"
  | "weekend"
  | "bill-increase"
  | "double-charge"
  | "new-merchant"
  | "large-transaction"
  | "refunds";

/** Small chart attached to an insight. */
export type InsightVisual =
  | { type: "compare"; previous: number; current: number; previousLabel: string; currentLabel: string }
  | { type: "count"; value: number; label: string }
  | { type: "share"; ratio: number; label: string };

export interface Insight {
  id: string;
  /** Playful one-liner. Filled in by the quip engine. */
  quip?: string;
  visual?: InsightVisual;
  kind: InsightKind;
  title: string;
  detail: string;
  /** Estimated dollar impact used for ranking (absolute). */
  impact: number;
  /** Visual tone: "up" = spending increased / attention, "down" = decreased / good, "neutral" = informational. */
  tone: "up" | "down" | "neutral";
  merchant?: string;
  category?: Category;
  transactionIds?: string[];
}

const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (r: number) => `${Math.round(Math.abs(r) * 100)}%`;

/**
 * Deterministic insight generators. Each looks at one pattern and emits zero
 * or more insights; the results are ranked by estimated financial impact.
 */
export function generateInsights(txs: Transaction[], month: string, rules: SubscriptionRule[] = []): Insight[] {
  const spending = spendingTransactions(txs);
  const cur = inMonth(spending, month);
  const prev = inMonth(spending, addMonths(month, -1));
  const name = monthName(month);
  const insights: Insight[] = [];

  const curTotal = sum(cur);
  const prevTotal = sum(prev);

  // 1. Total change vs previous month
  if (prevTotal > 0 && Math.abs(curTotal - prevTotal) >= 25) {
    const delta = curTotal - prevTotal;
    insights.push({
      id: "total-change",
      kind: "total-change",
      title: `You spent ${pct(delta / prevTotal)} ${delta > 0 ? "more" : "less"} than last month`,
      detail: `${fmt(curTotal)} in ${name} vs ${fmt(prevTotal)} the month before, a ${delta > 0 ? "rise" : "drop"} of ${fmt(delta)}.`,
      impact: Math.abs(delta),
      tone: delta > 0 ? "up" : "down",
      visual: { type: "compare", previous: prevTotal, current: curTotal, previousLabel: monthName(addMonths(month, -1)).slice(0, 3), currentLabel: name.slice(0, 3) },
    });
  }

  // 2. vs trailing 3-month average
  const trailing = [1, 2, 3].map((i) => sum(inMonth(spending, addMonths(month, -i)))).filter((n) => n > 0);
  if (trailing.length >= 2) {
    const avg = trailing.reduce((a, b) => a + b, 0) / trailing.length;
    const ratio = (curTotal - avg) / avg;
    if (Math.abs(ratio) >= 0.1) {
      insights.push({
        id: "vs-average",
        kind: "vs-average",
        title: `You spent ${pct(ratio)} ${ratio > 0 ? "more" : "less"} than your ${trailing.length}-month average`,
        detail: `Your average over the previous ${trailing.length} months was ${fmt(avg)}. ${name} came in at ${fmt(curTotal)}.`,
        impact: Math.abs(curTotal - avg) * 0.8,
        tone: ratio > 0 ? "up" : "down",
        visual: { type: "compare", previous: avg, current: curTotal, previousLabel: "Avg", currentLabel: name.slice(0, 3) },
      });
    }
  }

  // 3. Category & 4. merchant changes
  const changes = analyzeChanges(txs, month);
  for (const c of changes.categories.slice(0, 3)) {
    if (Math.abs(c.delta) < 75 || c.previous === 0) continue;
    const ratio = c.delta / c.previous;
    insights.push({
      id: `cat-${c.key}`,
      kind: "category-change",
      title: `${c.key} spending ${c.delta > 0 ? "increased" : "decreased"} ${pct(ratio)} this month`,
      detail: `${fmt(c.current)} in ${name} compared to ${fmt(c.previous)} the month before.`,
      impact: Math.abs(c.delta),
      tone: c.delta > 0 ? "up" : "down",
      category: c.key,
      visual: { type: "compare", previous: c.previous, current: c.current, previousLabel: "Last", currentLabel: name.slice(0, 3) },
    });
  }
  for (const m of changes.merchants.slice(0, 5)) {
    if (Math.abs(m.delta) < 50) continue;
    if (m.isNew) {
      const ids = cur.filter((t) => t.merchant === m.key).map((t) => t.id);
      insights.push({
        id: `new-${m.key}`,
        kind: "new-merchant",
        title: `${m.key} is new this month at ${fmt(m.current)}`,
        detail: `You had no charges from ${m.key} in the previous month; ${ids.length} ${ids.length === 1 ? "charge" : "charges"} in ${name}.`,
        impact: m.current * 0.9,
        tone: "up",
        merchant: m.key,
        transactionIds: ids,
        visual: { type: "count", value: ids.length, label: ids.length === 1 ? "charge" : "charges" },
      });
      continue;
    }
    if (m.previous === 0) continue;
    const ratio = m.delta / m.previous;
    insights.push({
      id: `merchant-${m.key}`,
      kind: "merchant-change",
      title:
        Math.abs(ratio) >= 0.3
          ? `${m.key} spending ${m.delta > 0 ? "increased" : "decreased"} ${pct(ratio)} this month`
          : `${m.key} spending ${m.delta > 0 ? "increased" : "decreased"} ${fmt(m.delta)}`,
      detail: `${fmt(m.current)} in ${name} vs ${fmt(m.previous)} last month.`,
      impact: Math.abs(m.delta),
      tone: m.delta > 0 ? "up" : "down",
      merchant: m.key,
      visual: { type: "compare", previous: m.previous, current: m.current, previousLabel: "Last", currentLabel: name.slice(0, 3) },
    });
  }

  // 5. Frequency: how often you ordered food / coffee
  const foodCats: Category[] = ["Delivery", "Dining"];
  const foodCount = cur.filter((t) => foodCats.includes(t.category)).length;
  if (foodCount >= 8) {
    const foodTotal = sum(cur.filter((t) => foodCats.includes(t.category)));
    const deliveryCount = cur.filter((t) => t.category === "Delivery").length;
    insights.push({
      id: "food-frequency",
      kind: "frequency",
      title: `You ate out or ordered food ${foodCount} times in ${name}`,
      detail: `${fmt(foodTotal)} across dining and delivery${deliveryCount ? `, including ${deliveryCount} delivery orders` : ""}. That is about ${fmt(foodTotal / foodCount)} per order.`,
      impact: foodTotal * 0.35,
      tone: "neutral",
      category: deliveryCount > foodCount / 2 ? "Delivery" : "Dining",
      visual: { type: "count", value: foodCount, label: "orders" },
    });
  }
  const merchantCounts = countBy(cur, (t) => t.merchant);
  for (const [merchant, n] of merchantCounts) {
    if (n >= 10) {
      const total = sum(cur.filter((t) => t.merchant === merchant));
      insights.push({
        id: `freq-${merchant}`,
        kind: "frequency",
        title: `${n} visits to ${merchant} this month`,
        detail: `That adds up to ${fmt(total)}, about ${fmt(total / n)} each time.`,
        impact: total * 0.3,
        tone: "neutral",
        merchant,
        visual: { type: "count", value: n, label: "visits" },
      });
    }
  }

  // 6. Subscriptions
  const recurring = detectRecurring(txs, rules).filter((r) => r.confidence >= 0.6);
  if (recurring.length) {
    const monthly = recurring.reduce((a, r) => a + r.monthlyCost, 0);
    insights.push({
      id: "subscriptions",
      kind: "subscriptions",
      title: `You have ${recurring.length} recurring ${recurring.length === 1 ? "payment" : "payments"} costing ${fmt(monthly)}/month`,
      detail: `That is ${fmt(monthly * 12)} a year. The largest is ${recurring[0].merchant} at ${fmt(recurring[0].monthlyCost)}/month.`,
      impact: monthly * 0.5,
      tone: "neutral",
      category: "Subscriptions",
      visual: { type: "count", value: recurring.length, label: "recurring" },
    });
    // 8. Bill increases
    for (const r of recurring) {
      if (r.lastChange >= 3 && r.lastChange / (r.typicalAmount || 1) >= 0.05) {
        const inThisMonth = cur.some((t) => t.merchant === r.merchant);
        if (!inThisMonth) continue;
        insights.push({
          id: `bill-${r.merchant}`,
          kind: "bill-increase",
          title: `Your ${r.merchant} bill increased by ${fmt(r.lastChange)}`,
          detail: `The latest charge was ${fmt(r.typicalAmount + r.lastChange)}, up from ${fmt(r.typicalAmount)}. Over a year that is ${fmt(r.lastChange * 12)} more.`,
          impact: r.lastChange * 12,
          tone: "up",
          merchant: r.merchant,
          visual: { type: "compare", previous: r.typicalAmount, current: r.typicalAmount + r.lastChange, previousLabel: "Was", currentLabel: "Now" },
        });
      }
    }
  }

  // 7. Weekend vs weekday (discretionary only; rent and bills fall on arbitrary weekdays)
  const discretionary = cur.filter((t) => !isFixed(t));
  const weekend = sum(discretionary.filter((t) => isWeekend(t.date)));
  const weekday = sum(discretionary) - weekend;
  if (weekday > 0 && weekend > 0 && cur.length >= 15) {
    const ratio = weekend / 2 / (weekday / 5);
    if (ratio >= 1.5 || ratio <= 0.5) {
      insights.push({
        id: "weekend",
        kind: "weekend",
        title:
          ratio >= 1
            ? `Weekend days cost ${ratio.toFixed(1)}x more than weekdays`
            : `Weekdays cost ${(1 / ratio).toFixed(1)}x more than weekend days`,
        detail: `Per day, you spent ${fmt(weekend / 2 / 4.3)} on weekend days and ${fmt(weekday / 5 / 4.3)} on weekdays in ${name}.`,
        impact: Math.abs(weekend - (sum(discretionary) * 2) / 7) * 0.5,
        tone: "neutral",
        visual: { type: "compare", previous: weekday / 5 / 4.3, current: weekend / 2 / 4.3, previousLabel: "Weekday", currentLabel: "Weekend" },
      });
    }
  }

  // 9. Possible double charges
  const doubles = inMonth(txs, month).filter((t) => t.flags.includes("possible_double_charge"));
  const doubleGroups = new Map<string, Transaction[]>();
  for (const t of doubles) {
    const key = `${t.merchant}|${Math.abs(t.amount).toFixed(2)}`;
    doubleGroups.set(key, [...(doubleGroups.get(key) ?? []), t]);
  }
  for (const [, group] of doubleGroups) {
    const t = group[0];
    insights.push({
      id: `double-${t.merchant}-${t.amount}`,
      kind: "double-charge",
      title: `${t.merchant} appears to have charged you twice`,
      detail: `${group.length} charges of ${fmt(t.amount)} within two days of each other. Worth checking your statement.`,
      impact: Math.abs(t.amount) * 1.5,
      tone: "up",
      merchant: t.merchant,
      transactionIds: group.map((g) => g.id),
      visual: { type: "count", value: group.length, label: `× ${fmt(t.amount)}` },
    });
  }

  // 11. Largest single purchase
  const largest = [...cur].sort((a, b) => spend(b) - spend(a))[0];
  if (largest && curTotal > 0 && spend(largest) / curTotal >= 0.12 && !["Housing"].includes(largest.category)) {
    insights.push({
      id: "largest",
      kind: "large-transaction",
      title: `Your biggest purchase was ${fmt(largest.amount)} at ${largest.merchant}`,
      detail: `That single ${largest.category.toLowerCase()} charge was ${pct(spend(largest) / curTotal)} of everything you spent in ${name}.`,
      impact: spend(largest) * 0.4,
      tone: "neutral",
      merchant: largest.merchant,
      category: largest.category,
      transactionIds: [largest.id],
      visual: { type: "share", ratio: spend(largest) / curTotal, label: "of the month" },
    });
  }

  // 12. Refunds
  const refunds = inMonth(txs, month).filter((t) => t.transactionType === "refund");
  if (refunds.length) {
    const total = refunds.reduce((a, t) => a + t.amount, 0);
    insights.push({
      id: "refunds",
      kind: "refunds",
      title: `You received ${fmt(total)} in refunds`,
      detail: `${refunds.length} ${refunds.length === 1 ? "refund" : "refunds"} in ${name}, the largest from ${
        [...refunds].sort((a, b) => b.amount - a.amount)[0].merchant
      }.`,
      impact: total * 0.3,
      tone: "down",
      transactionIds: refunds.map((r) => r.id),
      visual: { type: "count", value: refunds.length, label: refunds.length === 1 ? "refund" : "refunds" },
    });
  }

  // Top category share (informational, low impact)
  const cats = sumBy(cur, (t) => t.category);
  const topCat = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCat && curTotal > 0 && topCat[0] !== "Housing") {
    insights.push({
      id: "top-category",
      kind: "category-change",
      title: `${topCat[0]} was your largest category at ${pct(topCat[1] / curTotal)} of spending`,
      detail: `${fmt(topCat[1])} of ${fmt(curTotal)} in ${name}.`,
      impact: topCat[1] * 0.15,
      tone: "neutral",
      category: topCat[0],
      visual: { type: "share", ratio: topCat[1] / curTotal, label: "of spending" },
    });
  }

  return dedupe(insights)
    .sort((a, b) => b.impact - a.impact)
    .map((i) => ({ ...i, quip: quipFor(i) }));
}

function dedupe(list: Insight[]): Insight[] {
  const seen = new Set<string>();
  return list.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
