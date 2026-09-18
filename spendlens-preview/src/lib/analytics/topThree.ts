import type { Category, SubscriptionRule, Transaction } from "../types";
import { analyzeChanges } from "./changes";
import { buildBehaviorReport } from "../behavior";
import { buildHeadsUp } from "./headsUp";
import { generateInsights } from "./insights";

/**
 * The three things that matter this month, ranked from the existing engines:
 * the biggest change, the habit getting stronger, and something to watch.
 * Pure selection over existing outputs; no new analytics.
 */
export interface ThingThatMatters {
  slot: "change" | "habit" | "watch";
  kicker: string;
  title: string;
  value: string;
  tone: "up" | "down" | "neutral";
  category?: Category;
  merchant?: string;
  href: string;
  askQuestion: string;
}

const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function buildTopThree(txs: Transaction[], rules: SubscriptionRule[], month: string, today = new Date().toISOString().slice(0, 10)): ThingThatMatters[] {
  const out: ThingThatMatters[] = [];
  const c = analyzeChanges(txs, month);

  // 1. Biggest change: the category or merchant with the largest delta.
  const cat = c.categories[0];
  const mer = c.merchants[0];
  const pick = cat && (!mer || Math.abs(cat.delta) >= Math.abs(mer.delta) * 0.8) ? { name: cat.key as string, d: cat, category: cat.key as Category } : mer ? { name: mer.key, d: mer, category: undefined } : null;
  if (pick && Math.abs(pick.d.delta) >= 20) {
    const verb = pick.d.isNew ? "appeared" : pick.d.disappeared ? "disappeared" : pick.d.delta > 0 ? "rose" : "dropped";
    out.push({ slot: "change", kicker: "Biggest change", title: `${pick.name} ${verb}`, value: `${pick.d.delta > 0 ? "+" : "−"}${fmt(pick.d.delta)}`, tone: pick.d.delta > 0 ? "up" : "down", category: pick.category, merchant: pick.category ? undefined : pick.name, href: pick.category ? `/transactions?category=${encodeURIComponent(pick.name)}&month=${month}` : `/transactions?merchant=${encodeURIComponent(pick.name)}&month=${month}`, askQuestion: `Why did ${pick.name} ${verb} this month?` });
  }

  // 2. Habit getting stronger: strongest behavior feature with a direction, else weekend bias, else top insight.
  const report = buildBehaviorReport(txs, rules);
  const feature = report?.features.find((f) => f.direction === "up") ?? report?.features.find((f) => f.type === "weekend_spending_bias") ?? report?.features[0];
  if (feature) {
    const val = feature.unit === "x" ? `${Number(feature.value).toFixed(1)}× weekday spend` : feature.unit === "%" ? `${Number(feature.value) > 0 ? "+" : ""}${Math.round(Number(feature.value))}%` : feature.unit === "share" ? `${Math.round(Number(feature.value) * 100)}% of spend` : String(feature.value);
    const catFromType: Partial<Record<string, Category>> = { dining_delivery_growth: "Dining", convenience_spend_growth: "Delivery", subscription_creep: "Subscriptions", recurring_cost_growth: "Subscriptions", travel_spend_pattern: "Travel", fixed_cost_growth: "Housing" };
    out.push({ slot: "habit", kicker: feature.direction === "up" ? "Habit getting stronger" : "Your strongest habit", title: feature.label, value: val, tone: feature.direction === "up" ? "up" : feature.direction === "down" ? "down" : "neutral", category: catFromType[feature.type] ?? (feature.type === "category_concentration" ? (feature.evidence.find((e) => e.metric === "category")?.value as Category | undefined) : undefined), href: "/money-dna", askQuestion: "What habit is costing me the most?" });
  }

  // 3. Something to watch: a cancel-flagged or big upcoming charge, else a double charge, new merchant or big purchase.
  const heads = buildHeadsUp(txs, rules, today);
  const urgent = heads.find((h) => h.reason === "cancel") ?? heads.find((h) => h.reason === "big" || h.reason === "renewal");
  if (urgent) {
    out.push({ slot: "watch", kicker: "Something to watch", title: `${urgent.merchant} charges ${urgent.daysUntil === 0 ? "today" : urgent.daysUntil === 1 ? "tomorrow" : `in ${urgent.daysUntil} days`}`, value: fmt(urgent.amount), tone: "neutral", category: urgent.category, merchant: urgent.merchant, href: `/recurring?focus=${encodeURIComponent(urgent.merchant)}`, askQuestion: `Should I keep paying for ${urgent.merchant}?` });
  } else {
    const ins = generateInsights(txs, month, rules).find((i) => ["double-charge", "new-merchant", "large-transaction", "bill-increase"].includes(i.kind));
    if (ins) {
      const amt = ins.title.match(/\$[\d,]+/)?.[0] ?? "";
      out.push({ slot: "watch", kicker: "Something to watch", title: ins.kind === "double-charge" ? `${ins.merchant} may have charged twice` : ins.kind === "new-merchant" ? `${ins.merchant} is new` : ins.kind === "bill-increase" ? `${ins.merchant} bill went up` : `Big purchase at ${ins.merchant}`, value: amt, tone: "up", category: ins.category, merchant: ins.merchant, href: ins.merchant ? `/transactions?merchant=${encodeURIComponent(ins.merchant)}` : "/insights", askQuestion: ins.kind === "double-charge" ? `Did ${ins.merchant} charge me twice?` : `Tell me about ${ins.merchant} this month.` });
    }
  }

  // Fill to three with top insights if a slot was empty.
  if (out.length < 3) {
    for (const i of generateInsights(txs, month, rules)) {
      if (out.length >= 3) break;
      if (out.some((o) => o.title === i.title || (i.merchant && o.merchant === i.merchant))) continue;
      out.push({ slot: out.some((o) => o.slot === "watch") ? "habit" : "watch", kicker: i.tone === "up" ? "Worth a look" : i.tone === "down" ? "Good news" : "Worth knowing", title: i.title, value: i.title.match(/\$[\d,]+|\d+%|\d+(\.\d)?x/)?.[0] ?? "", tone: i.tone, category: i.category, merchant: i.merchant, href: i.merchant ? `/transactions?merchant=${encodeURIComponent(i.merchant)}` : "/insights", askQuestion: `Tell me more: ${i.title.toLowerCase()}` });
    }
  }
  return out.slice(0, 3);
}
