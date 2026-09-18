import type { Category, SubscriptionRule, Transaction } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { addMonths, monthKey } from "@/lib/dates";
import * as M from "@/lib/analytics/metrics";
import { analyzeChanges } from "@/lib/analytics/changes";
import { detectRecurring } from "@/lib/analytics/recurring";
import { availableMonths, latestMonth as latestMonthOf } from "@/lib/analytics/core";
import { extractFeatures } from "@/lib/behavior/features";
import { buildTimeline } from "@/lib/behavior/timeline";
import { buildBehaviorReport } from "@/lib/behavior";
import { buildHabits } from "@/lib/analytics/habits";
import { DATE_RANGE_SCHEMA, resolveRange, type DateRangeInput, type ResolvedRange } from "./ranges";

/**
 * The controlled tool surface the model can call. Every tool runs SpendLens
 * analytics and returns compact, privacy-safe JSON: merchant names, categories,
 * months and amounts. Never account names, descriptions, ids or file names.
 *
 * Code calculates facts. The model interprets them.
 */

export type CardSpec =
  | { type: "metric"; label: string; value: number; unit?: "usd" | "pct" | "x" | "count"; delta?: { value: number; label: string } }
  | { type: "comparison"; title: string; a: { label: string; value: number }; b: { label: string; value: number }; rows: Array<{ label: string; a: number; b: number; delta: number }> }
  | { type: "breakdown"; title: string; kind: "category" | "merchant"; rows: Array<{ label: string; value: number; share?: number; count?: number; category?: string }> }
  | { type: "trend"; title: string; series: Array<{ label: string; value: number }>; highlight?: string }
  | { type: "transactions"; title: string; rows: Array<{ date: string; merchant: string; category: string; amount: number }> };

export interface EvidenceItem {
  tool: string;
  label: string;
  range: { start: string; end: string; label: string } | null;
  values: Array<{ metric: string; value: number | string }>;
}

export interface ToolResult {
  /** Friendly status shown while running, e.g. "Comparing the last 12 months…" */
  status: string;
  /** What the model gets. */
  data: unknown;
  cards: CardSpec[];
  evidence: EvidenceItem;
}

export interface ToolContext {
  txs: Transaction[];
  rules: SubscriptionRule[];
  latestMonth: string;
  firstMonth: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type Args = Record<string, unknown>;

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  status: (args: Args) => string;
  run: (args: Args, ctx: ToolContext) => Omit<ToolResult, "status">;
}

function range(args: Args, ctx: ToolContext, key = "dateRange"): ResolvedRange {
  return resolveRange(args[key] as DateRangeInput | undefined, ctx.latestMonth, ctx.firstMonth);
}
const ev = (tool: string, label: string, r: ResolvedRange | null, values: Array<{ metric: string; value: number | string }>): EvidenceItem => ({ tool, label, range: r ? { start: r.start, end: r.end, label: r.label } : null, values });
const monthlySeries = (txs: Transaction[], r: ResolvedRange) => M.getMonthlySpend(txs, r).value.map((m) => ({ label: m.month, value: m.value }));

function resolveMerchant(name: string, txs: Transaction[]): string | null {
  const merchants = [...new Set(txs.map((t) => t.merchant))];
  const q = name.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return merchants.find((m) => m.toLowerCase() === name.toLowerCase()) ?? merchants.find((m) => m.toLowerCase().replace(/[^a-z0-9 ]/g, "").includes(q)) ?? merchants.find((m) => q.includes(m.toLowerCase().replace(/[^a-z0-9 ]/g, ""))) ?? null;
}
function resolveCategory(name: string): Category | null {
  const q = name.toLowerCase();
  return CATEGORIES.find((c) => c.toLowerCase() === q) ?? CATEGORIES.find((c) => c.toLowerCase().startsWith(q.slice(0, 4))) ?? null;
}

const rangeParams = (extra: Record<string, unknown> = {}, required: string[] = []) => ({ type: "object", properties: { dateRange: DATE_RANGE_SCHEMA, ...extra }, required, additionalProperties: false });

export const TOOLS: ToolDef[] = [
  {
    name: "get_data_coverage",
    description: "How much history exists: first and last month, number of months, and whether long-term claims are supportable. Call this first when a question depends on how much history there is.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    status: () => "Checking how much history you have…",
    run: (_a, ctx) => {
      const months = availableMonths(ctx.txs);
      const data = { firstMonth: ctx.firstMonth, latestMonth: ctx.latestMonth, monthsWithData: months.length, spendTransactions: ctx.txs.filter((t) => M.spendAmount(t) > 0).length, hasIncome: ctx.txs.some((t) => t.transactionType === "income"), sufficientForTrends: months.length >= 6, sufficientForYearOverYear: months.length >= 13 };
      return { data, cards: [], evidence: ev("get_data_coverage", "Data coverage", null, [{ metric: "months_with_data", value: months.length }]) };
    },
  },
  {
    name: "get_spending_summary",
    description: "Total spending, income, fixed vs variable, transaction count and average purchase for a range, with top categories and merchants and a comparison to the previous period of equal length.",
    parameters: rangeParams(),
    status: () => "Checking your spending…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const total = M.getTotalSpend(ctx.txs, r);
      const income = M.getTotalIncome(ctx.txs, r);
      const fv = M.getFixedVsVariableSpend(ctx.txs, r).value;
      const avg = M.getAverageTransactionValue(ctx.txs, r);
      const freq = M.getTransactionFrequency(ctx.txs, r);
      const cats = M.getSpendByCategory(ctx.txs, r).value.slice(0, 6);
      const merchants = M.getSpendByMerchant(ctx.txs, r, 6).value;
      const series = monthlySeries(ctx.txs, r);
      const data = { range: r, totalSpend: total.value, previousPeriodSpend: total.comparison?.previousPeriodValue, spendChangePct: total.comparison?.changePct, income: income.value, fixed: fv.fixed, variable: fv.variable, fixedShare: fv.fixedShare, transactionCount: M.spendTxs(ctx.txs, r).length, averagePurchase: avg.value, averagePurchaseChangePct: avg.comparison?.changePct, purchasesPer30Days: freq.value, purchasesPer30DaysChangePct: freq.comparison?.changePct, topCategories: cats.map((c) => ({ category: c.key, total: c.total, share: c.share })), topMerchants: merchants.map((m) => ({ merchant: m.key, total: m.total, count: m.count })), monthly: series };
      return {
        data,
        cards: [
          { type: "metric", label: `Spent ${r.label}`, value: total.value, unit: "usd", delta: total.comparison?.changePct != null ? { value: total.comparison.changePct, label: "vs previous period" } : undefined },
          { type: "breakdown", title: "By category", kind: "category", rows: cats.map((c) => ({ label: c.key, value: c.total, share: c.share, count: c.count })) },
          ...(series.length > 1 ? [{ type: "trend" as const, title: "Monthly spending", series }] : []),
        ],
        evidence: ev("get_spending_summary", "Spending summary", r, [{ metric: "total_spend", value: total.value }, { metric: "previous_period_spend", value: total.comparison?.previousPeriodValue ?? "n/a" }, { metric: "transaction_count", value: data.transactionCount }, { metric: "average_purchase", value: avg.value }]),
      };
    },
  },
  {
    name: "compare_periods",
    description: "Compare two ranges: totals, per-category and per-merchant differences, and whether the change came from buying more often or spending more per purchase.",
    parameters: { type: "object", properties: { periodA: DATE_RANGE_SCHEMA, periodB: DATE_RANGE_SCHEMA }, required: ["periodA", "periodB"], additionalProperties: false },
    status: () => "Comparing the two periods…",
    run: (a, ctx) => {
      const A = range(a, ctx, "periodA");
      const B = range(a, ctx, "periodB");
      const tA = M.getTotalSpend(ctx.txs, A, false).value;
      const tB = M.getTotalSpend(ctx.txs, B, false).value;
      const cat = (r: ResolvedRange) => new Map(M.getSpendByCategory(ctx.txs, r).value.map((c) => [c.key, c.total]));
      const mer = (r: ResolvedRange) => new Map(M.getSpendByMerchant(ctx.txs, r, 40).value.map((c) => [c.key, c.total]));
      const cA = cat(A), cB = cat(B), mA = mer(A), mB = mer(B);
      const rows = [...new Set([...cA.keys(), ...cB.keys()])].map((k) => ({ label: k, a: cA.get(k) ?? 0, b: cB.get(k) ?? 0, delta: r2((cA.get(k) ?? 0) - (cB.get(k) ?? 0)) })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
      const mrows = [...new Set([...mA.keys(), ...mB.keys()])].map((k) => ({ merchant: k, a: mA.get(k) ?? 0, b: mB.get(k) ?? 0, delta: r2((mA.get(k) ?? 0) - (mB.get(k) ?? 0)) })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 8);
      const nA = M.spendTxs(ctx.txs, A).length, nB = M.spendTxs(ctx.txs, B).length;
      // Normalize by month count so a 12-month range compares fairly with a 1-month range.
      const perMonth = (t: number, r: ResolvedRange) => r2(t / Math.max(1, r.months));
      const data = { periodA: { ...A, total: tA, perMonth: perMonth(tA, A), transactions: nA, averagePurchase: r2(nA ? tA / nA : 0) }, periodB: { ...B, total: tB, perMonth: perMonth(tB, B), transactions: nB, averagePurchase: r2(nB ? tB / nB : 0) }, difference: r2(tA - tB), changePct: M.pct(tA, tB), perMonthChangePct: M.pct(perMonth(tA, A), perMonth(tB, B)), categoryDifferences: rows.slice(0, 8), merchantDifferences: mrows, note: A.months !== B.months ? "Periods have different lengths; use perMonth figures for a fair comparison." : undefined };
      return {
        data,
        cards: [{ type: "comparison", title: `${A.label} vs ${B.label}`, a: { label: A.label, value: tA }, b: { label: B.label, value: tB }, rows: rows.slice(0, 6) }],
        evidence: ev("compare_periods", "Period comparison", A, [{ metric: `total_${A.label}`, value: tA }, { metric: `total_${B.label}`, value: tB }, { metric: "difference", value: r2(tA - tB) }, { metric: "transactions_a", value: nA }, { metric: "transactions_b", value: nB }]),
      };
    },
  },
  {
    name: "get_category_spending",
    description: "Spending in one category for a range: total, count, monthly series, comparison to the previous period, and the top merchants inside it.",
    parameters: rangeParams({ category: { type: "string", enum: [...CATEGORIES] } }, ["category"]),
    status: (a) => `Looking at ${String(a.category ?? "that category").toLowerCase()} spending…`,
    run: (a, ctx) => {
      const r = range(a, ctx);
      const category = resolveCategory(String(a.category)) ?? "Other";
      const rows = ctx.txs.filter((t) => t.category === category);
      const g = M.getCategoryGrowth(ctx.txs, r, category);
      const n = M.spendTxs(rows, r).length;
      const merchants = M.getSpendByMerchant(rows, r, 6).value;
      const series = monthlySeries(rows, r);
      const data = { category, range: r, total: g.value, previousPeriodTotal: g.comparison?.previousPeriodValue, changePct: g.comparison?.changePct, transactionCount: n, averagePurchase: r2(n ? g.value / n : 0), perMonth: r2(g.value / Math.max(1, r.months)), topMerchants: merchants.map((m) => ({ merchant: m.key, total: m.total, count: m.count })), monthly: series };
      return { data, cards: [{ type: "metric", label: `${category} ${r.label}`, value: g.value, unit: "usd", delta: g.comparison?.changePct != null ? { value: g.comparison.changePct, label: "vs previous period" } : undefined }, ...(series.length > 1 ? [{ type: "trend" as const, title: `${category} by month`, series }] : []), { type: "breakdown", title: `Top ${category.toLowerCase()} merchants`, kind: "merchant", rows: merchants.map((m) => ({ label: m.key, value: m.total, count: m.count, category })) }], evidence: ev("get_category_spending", `${category} spending`, r, [{ metric: "total", value: g.value }, { metric: "previous_period_total", value: g.comparison?.previousPeriodValue ?? "n/a" }, { metric: "transaction_count", value: n }]) };
    },
  },
  {
    name: "get_merchant_spending",
    description: "Spending at one merchant for a range: total, visit count, average, monthly series and comparison to the previous period. Merchant names are matched loosely.",
    parameters: rangeParams({ merchant: { type: "string" } }, ["merchant"]),
    status: (a) => `Looking at ${a.merchant}…`,
    run: (a, ctx) => {
      const r = range(a, ctx);
      const merchant = resolveMerchant(String(a.merchant), ctx.txs);
      if (!merchant) return { data: { error: `No merchant matching "${a.merchant}" in your data.`, suggestions: M.getSpendByMerchant(ctx.txs, r, 8).value.map((m) => m.key) }, cards: [], evidence: ev("get_merchant_spending", "Merchant lookup", r, [{ metric: "match", value: "none" }]) };
      const rows = ctx.txs.filter((t) => t.merchant === merchant);
      const g = M.getMerchantGrowth(ctx.txs, r, merchant);
      const n = M.spendTxs(rows, r).length;
      const series = monthlySeries(rows, r);
      const data = { merchant, category: rows[0]?.category, range: r, total: g.value, previousPeriodTotal: g.comparison?.previousPeriodValue, changePct: g.comparison?.changePct, visits: n, averagePerVisit: r2(n ? g.value / n : 0), perMonth: r2(g.value / Math.max(1, r.months)), monthly: series };
      return { data, cards: [{ type: "metric", label: `${merchant} ${r.label}`, value: g.value, unit: "usd", delta: g.comparison?.changePct != null ? { value: g.comparison.changePct, label: "vs previous period" } : undefined }, ...(series.length > 1 ? [{ type: "trend" as const, title: `${merchant} by month`, series }] : [])], evidence: ev("get_merchant_spending", `${merchant} spending`, r, [{ metric: "total", value: g.value }, { metric: "visits", value: n }, { metric: "previous_period_total", value: g.comparison?.previousPeriodValue ?? "n/a" }]) };
    },
  },
  {
    name: "get_top_spending_changes",
    description: "The categories and merchants that moved most between a range and the previous period of equal length, including new and disappeared merchants.",
    parameters: rangeParams(),
    status: () => "Finding what changed…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const prev = M.previousPeriod(r);
      const cats = (p: M.Period) => new Map(M.getSpendByCategory(ctx.txs, p).value.map((c) => [c.key, c.total]));
      const mers = (p: M.Period) => new Map(M.getSpendByMerchant(ctx.txs, p, 60).value.map((c) => [c.key, c.total]));
      const cA = cats(r), cB = cats(prev), mA = mers(r), mB = mers(prev);
      const diff = <K extends string>(A: Map<K, number>, B: Map<K, number>) => [...new Set([...A.keys(), ...B.keys()])].map((k) => ({ key: k, current: A.get(k) ?? 0, previous: B.get(k) ?? 0, delta: r2((A.get(k) ?? 0) - (B.get(k) ?? 0)), isNew: !B.has(k), disappeared: !A.has(k) })).filter((x) => Math.abs(x.delta) >= 1).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
      const total = M.getTotalSpend(ctx.txs, r);
      const data = { range: r, previousRange: prev, totalChange: r2(total.value - (total.comparison?.previousPeriodValue ?? 0)), totalChangePct: total.comparison?.changePct, categories: diff(cA, cB).slice(0, 8), merchants: diff(mA, mB).slice(0, 10) };
      return { data, cards: [{ type: "comparison", title: `What changed: ${r.label} vs before`, a: { label: r.label, value: total.value }, b: { label: "previous period", value: total.comparison?.previousPeriodValue ?? 0 }, rows: data.categories.slice(0, 6).map((c) => ({ label: c.key, a: c.current, b: c.previous, delta: c.delta })) }], evidence: ev("get_top_spending_changes", "Top changes", r, [{ metric: "total_change", value: data.totalChange }, ...data.categories.slice(0, 3).map((c) => ({ metric: `change:${c.key}`, value: c.delta }))]) };
    },
  },
  {
    name: "get_recurring_expenses",
    description: "Subscriptions and recurring bills: merchant, cadence, typical amount, monthly cost, last and next charge, confidence, and whether the latest charge changed.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    status: () => "Looking at recurring expenses…",
    run: (_a, ctx) => {
      const rec = detectRecurring(ctx.txs, ctx.rules).filter((x) => x.confidence >= 0.6 && x.status !== "ignored");
      const monthly = r2(rec.reduce((s, x) => s + x.monthlyCost, 0));
      const data = { count: rec.length, monthlyTotal: monthly, yearlyTotal: r2(monthly * 12), items: rec.map((x) => ({ merchant: x.merchant, category: x.category, cadence: x.cadence, typicalAmount: r2(x.typicalAmount), monthlyCost: r2(x.monthlyCost), lastPayment: x.lastPayment, nextExpected: x.nextExpected, confidence: x.confidence, lastChange: r2(x.lastChange), status: x.status })) };
      return { data, cards: [{ type: "breakdown", title: "Recurring per month", kind: "merchant", rows: rec.slice(0, 8).map((x) => ({ label: x.merchant, value: r2(x.monthlyCost), category: x.category })) }], evidence: ev("get_recurring_expenses", "Recurring expenses", null, [{ metric: "recurring_count", value: rec.length }, { metric: "recurring_monthly_total", value: monthly }]) };
    },
  },
  {
    name: "get_subscription_changes",
    description: "How recurring costs changed over a range vs the period before: new subscriptions, ones that stopped, price changes, and the change in total monthly recurring cost.",
    parameters: rangeParams(),
    status: () => "Checking how your subscriptions changed…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const prev = M.previousPeriod(r);
      const now = detectRecurring(M.inPeriod(ctx.txs, r), ctx.rules).filter((x) => x.confidence >= 0.6 && x.status !== "ignored" && x.category !== "Housing");
      const before = detectRecurring(M.inPeriod(ctx.txs, prev), ctx.rules).filter((x) => x.confidence >= 0.6 && x.status !== "ignored" && x.category !== "Housing");
      const bn = new Map(before.map((x) => [x.merchant, x]));
      const nn = new Map(now.map((x) => [x.merchant, x]));
      const added = now.filter((x) => !bn.has(x.merchant)).map((x) => ({ merchant: x.merchant, monthlyCost: r2(x.monthlyCost) }));
      const stopped = before.filter((x) => !nn.has(x.merchant)).map((x) => ({ merchant: x.merchant, monthlyCost: r2(x.monthlyCost) }));
      const priceChanges = now.filter((x) => bn.has(x.merchant) && Math.abs(x.typicalAmount - bn.get(x.merchant)!.typicalAmount) >= 1).map((x) => ({ merchant: x.merchant, from: r2(bn.get(x.merchant)!.typicalAmount), to: r2(x.typicalAmount) }));
      const mNow = r2(now.reduce((s, x) => s + x.monthlyCost, 0));
      const mBefore = r2(before.reduce((s, x) => s + x.monthlyCost, 0));
      const data = { range: r, previousRange: prev, countNow: now.length, countBefore: before.length, monthlyCostNow: mNow, monthlyCostBefore: mBefore, monthlyCostChangePct: M.pct(mNow, mBefore), added, stopped, priceChanges };
      return { data, cards: [{ type: "comparison", title: "Recurring cost per month", a: { label: r.label, value: mNow }, b: { label: "before", value: mBefore }, rows: [...added.map((x) => ({ label: `${x.merchant} (new)`, a: x.monthlyCost, b: 0, delta: x.monthlyCost })), ...priceChanges.map((x) => ({ label: x.merchant, a: x.to, b: x.from, delta: r2(x.to - x.from) })), ...stopped.map((x) => ({ label: `${x.merchant} (stopped)`, a: 0, b: x.monthlyCost, delta: -x.monthlyCost }))].slice(0, 8) }], evidence: ev("get_subscription_changes", "Subscription changes", r, [{ metric: "count_now", value: now.length }, { metric: "count_before", value: before.length }, { metric: "monthly_cost_now", value: mNow }, { metric: "monthly_cost_before", value: mBefore }]) };
    },
  },
  {
    name: "get_behavior_features",
    description: "Deterministic behavior signals (lifestyle inflation, subscription creep, weekend bias, fewer-larger purchases, convenience growth, etc.) for a range vs the period before, each with strength, confidence and evidence. Use for 'what habit costs me most' and 'how has my behavior changed'.",
    parameters: rangeParams(),
    status: () => "Reading your spending patterns…",
    run: (a, ctx) => {
      const r = a.dateRange ? range(a, ctx) : null;
      const report = buildBehaviorReport(ctx.txs, ctx.rules);
      const features = r ? extractFeatures(ctx.txs, r, { rules: ctx.rules }) : report?.features ?? [];
      const data = { range: r ?? (report ? { ...report.period, label: "recent half of history", comparedWith: report.comparisonPeriod } : null), features: features.map((f) => ({ id: f.id, type: f.type, label: f.label, value: f.value, unit: f.unit, direction: f.direction, strength: f.strength, confidence: f.confidence, evidence: f.evidence })), hiddenPatterns: report?.patterns.map((p) => ({ id: p.id, title: p.title, summary: p.summary, importance: p.importance, evidence: p.evidence })) ?? [] };
      return { data, cards: [], evidence: ev("get_behavior_features", "Behavior signals", r, features.slice(0, 5).flatMap((f) => f.evidence.slice(0, 2).map((e) => ({ metric: `${f.type}.${e.metric}`, value: e.value })))) };
    },
  },
  {
    name: "get_behavior_timeline",
    description: "Dated behavior changes across the whole history: when a behavior started, settled at a new level, reversed, accelerated or shifted regime. Use for 'when did my spending start changing'.",
    parameters: rangeParams(),
    status: () => "Tracing when things changed…",
    run: (a, ctx) => {
      const tl = buildTimeline(ctx.txs, ctx.rules);
      const r = a.dateRange ? range(a, ctx) : null;
      const events = tl.events.filter((e) => !r || (e.date >= r.start.slice(0, 7) && e.date <= r.end.slice(0, 7)));
      const data = { months: tl.snapshots.length, events: events.map((e) => ({ id: e.id, kind: e.kind, month: e.date, title: e.title, subject: e.subject, confidence: e.confidence, evidence: e.evidence })), monthlyDiscretionary: tl.snapshots.map((s) => ({ month: s.month, variable: s.metrics.variable, spend: s.metrics.spend })) };
      return { data, cards: tl.snapshots.length > 2 ? [{ type: "trend", title: "Discretionary spend by month", series: tl.snapshots.map((s) => ({ label: s.month, value: s.metrics.variable })) }] : [], evidence: ev("get_behavior_timeline", "Behavior timeline", r, events.slice(0, 4).map((e) => ({ metric: `${e.kind}:${e.subject}`, value: e.date }))) };
    },
  },
  {
    name: "get_weekend_vs_weekday",
    description: "Per-day weekend vs weekday discretionary spend for a range, the day-of-week profile, and the same ratio for the previous period.",
    parameters: rangeParams(),
    status: () => "Comparing weekends with weekdays…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const ratio = M.getWeekendWeekdayRatio(ctx.txs, r);
      const prof = M.getWeekdayProfile(ctx.txs, r).value;
      const we = r2((prof[5].perDay + prof[6].perDay) / 2);
      const wd = r2(prof.slice(0, 5).reduce((s, d) => s + d.perDay, 0) / 5);
      const data = { range: r, weekendPerDay: we, weekdayPerDay: wd, ratio: ratio.value, previousPeriodRatio: ratio.comparison?.previousPeriodValue, dayOfWeek: prof, note: "Discretionary spending only; rent and bills are excluded because their dates are arbitrary." };
      return { data, cards: [{ type: "trend", title: "Average spend per day of week", series: prof.map((d) => ({ label: d.day, value: d.perDay })), highlight: "Sat" }], evidence: ev("get_weekend_vs_weekday", "Weekend vs weekday", r, [{ metric: "weekend_per_day", value: we }, { metric: "weekday_per_day", value: wd }, { metric: "ratio", value: ratio.value }, { metric: "previous_ratio", value: ratio.comparison?.previousPeriodValue ?? "n/a" }]) };
    },
  },
  {
    name: "get_average_transaction_size",
    description: "Average purchase size for a range with comparison to the previous period.",
    parameters: rangeParams(),
    status: () => "Measuring purchase sizes…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const m = M.getAverageTransactionValue(ctx.txs, r);
      return { data: { range: r, averagePurchase: m.value, previousPeriod: m.comparison?.previousPeriodValue, changePct: m.comparison?.changePct }, cards: [{ type: "metric", label: "Average purchase", value: m.value, unit: "usd", delta: m.comparison?.changePct != null ? { value: m.comparison.changePct, label: "vs previous period" } : undefined }], evidence: ev("get_average_transaction_size", "Average purchase size", r, [{ metric: "average_purchase", value: m.value }, { metric: "previous", value: m.comparison?.previousPeriodValue ?? "n/a" }]) };
    },
  },
  {
    name: "get_transaction_frequency",
    description: "How often you buy: purchases per 30 days for a range with comparison to the previous period.",
    parameters: rangeParams(),
    status: () => "Counting how often you buy…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const m = M.getTransactionFrequency(ctx.txs, r);
      return { data: { range: r, purchasesPer30Days: m.value, previousPeriod: m.comparison?.previousPeriodValue, changePct: m.comparison?.changePct, totalPurchases: M.spendTxs(ctx.txs, r).length }, cards: [{ type: "metric", label: "Purchases per 30 days", value: m.value, unit: "count", delta: m.comparison?.changePct != null ? { value: m.comparison.changePct, label: "vs previous period" } : undefined }], evidence: ev("get_transaction_frequency", "Purchase frequency", r, [{ metric: "per_30_days", value: m.value }, { metric: "previous", value: m.comparison?.previousPeriodValue ?? "n/a" }]) };
    },
  },
  {
    name: "get_income_vs_spend",
    description: "Income, spending, income-to-spend ratio and savings rate for a range, with previous-period comparison. Reports when no income is present.",
    parameters: rangeParams(),
    status: () => "Comparing income with spending…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const inc = M.getTotalIncome(ctx.txs, r);
      const sp = M.getTotalSpend(ctx.txs, r);
      const sr = M.getSavingsRateIfIncomeExists(ctx.txs, r);
      const data = { range: r, income: inc.value, incomeChangePct: inc.comparison?.changePct, spend: sp.value, spendChangePct: sp.comparison?.changePct, savingsRate: sr.value, previousSavingsRate: sr.comparison?.previousPeriodValue, note: sr.note };
      return { data, cards: inc.value ? [{ type: "comparison", title: "Income vs spending", a: { label: "Income", value: inc.value }, b: { label: "Spending", value: sp.value }, rows: [] }] : [], evidence: ev("get_income_vs_spend", "Income vs spend", r, [{ metric: "income", value: inc.value }, { metric: "spend", value: sp.value }, { metric: "savings_rate", value: sr.value ?? "n/a" }]) };
    },
  },
  {
    name: "get_fixed_vs_variable",
    description: "Fixed (rent, bills, subscriptions) vs variable spending for a range, plus the discretionary monthly baseline and its change.",
    parameters: rangeParams(),
    status: () => "Separating bills from day-to-day spending…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const fv = M.getFixedVsVariableSpend(ctx.txs, r).value;
      const base = M.getDiscretionaryBaseline(ctx.txs, r);
      const prevFv = M.getFixedVsVariableSpend(ctx.txs, M.previousPeriod(r)).value;
      const data = { range: r, fixed: fv.fixed, variable: fv.variable, fixedShare: fv.fixedShare, previousFixed: prevFv.fixed, previousVariable: prevFv.variable, fixedChangePct: M.pct(fv.fixed, prevFv.fixed), variableChangePct: M.pct(fv.variable, prevFv.variable), discretionaryBaselineMonthly: base.value, discretionaryBaselineChangePct: base.comparison?.changePct };
      return { data, cards: [{ type: "comparison", title: "Fixed vs variable", a: { label: "Fixed", value: fv.fixed }, b: { label: "Variable", value: fv.variable }, rows: [] }], evidence: ev("get_fixed_vs_variable", "Fixed vs variable", r, [{ metric: "fixed", value: fv.fixed }, { metric: "variable", value: fv.variable }, { metric: "discretionary_baseline_monthly", value: base.value }]) };
    },
  },
  {
    name: "get_spending_anomalies",
    description: "Unusual purchases in a range: discretionary purchases far above your typical size, months that spike above the norm, and possible double charges.",
    parameters: rangeParams(),
    status: () => "Looking for unusual purchases…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const out = M.getOutlierTransactions(ctx.txs, r).value;
      const byId = new Map(ctx.txs.map((t) => [t.id, t]));
      const items = out.ids.map((id) => byId.get(id)!).filter(Boolean).sort((x, y) => M.spendAmount(y) - M.spendAmount(x)).slice(0, 8).map((t) => ({ date: t.date, merchant: t.merchant, category: t.category, amount: r2(M.spendAmount(t)) }));
      const monthly = M.getMonthlySpend(ctx.txs, r).value.filter((m) => m.value > 0);
      const med = [...monthly].sort((x, y) => x.value - y.value)[Math.floor(monthly.length / 2)]?.value ?? 0;
      const spikes = monthly.filter((m) => med && m.value >= med * 1.4).map((m) => ({ month: m.month, total: m.value, vsTypical: M.pct(m.value, med) }));
      const doubles = M.inPeriod(ctx.txs, r).filter((t) => t.flags.includes("possible_double_charge")).map((t) => ({ date: t.date, merchant: t.merchant, amount: r2(Math.abs(t.amount)) }));
      const data = { range: r, threshold: out.threshold, largeCount: out.count, largeTotal: out.total, largePurchases: items, typicalMonth: r2(med), spikeMonths: spikes, possibleDoubleCharges: doubles };
      return { data, cards: items.length ? [{ type: "transactions", title: "Largest unusual purchases", rows: items }] : [], evidence: ev("get_spending_anomalies", "Unusual purchases", r, [{ metric: "threshold", value: out.threshold }, { metric: "large_purchase_count", value: out.count }, { metric: "large_purchase_total", value: out.total }]) };
    },
  },
  {
    name: "get_month_explanation",
    description: "Why a month cost what it did: change vs the previous month, vs the 3-month average, the categories and merchants that drove the change, and whether it came from more purchases or larger ones.",
    parameters: { type: "object", properties: { month: { type: "string", description: "YYYY-MM; defaults to the latest month with data" } }, additionalProperties: false },
    status: (a) => `Explaining ${a.month ? String(a.month) : "this month"}…`,
    run: (a, ctx) => {
      const month = typeof a.month === "string" && /^\d{4}-\d{2}$/.test(a.month) ? a.month : ctx.latestMonth;
      const c = analyzeChanges(ctx.txs, month);
      const p = M.periodForMonth(month);
      const r3 = M.getRolling3MonthAverage(ctx.txs, month).value;
      const n = M.spendTxs(ctx.txs, p).length;
      const nPrev = M.spendTxs(ctx.txs, M.periodForMonth(addMonths(month, -1))).length;
      const avg = r2(n ? c.currentTotal / n : 0);
      const avgPrev = r2(nPrev ? c.previousTotal / nPrev : 0);
      const data = { month, total: r2(c.currentTotal), previousMonthTotal: r2(c.previousTotal), change: r2(c.delta), changePct: c.ratio != null ? r2(c.ratio * 100) : null, threeMonthAverage: r3, vsThreeMonthAveragePct: r3 ? M.pct(c.currentTotal, r3) : null, transactions: n, previousMonthTransactions: nPrev, averagePurchase: avg, previousMonthAveragePurchase: avgPrev, categoryDrivers: c.categories.slice(0, 6).map((x) => ({ category: x.key, current: r2(x.current), previous: r2(x.previous), delta: r2(x.delta), isNew: x.isNew, disappeared: x.disappeared })), merchantDrivers: c.merchants.slice(0, 8).map((x) => ({ merchant: x.key, current: r2(x.current), previous: r2(x.previous), delta: r2(x.delta), isNew: x.isNew, disappeared: x.disappeared })) };
      return { data, cards: [{ type: "comparison", title: `${c.monthLabel} vs ${c.previousLabel}`, a: { label: c.monthLabel, value: c.currentTotal }, b: { label: c.previousLabel, value: c.previousTotal }, rows: c.categories.slice(0, 6).map((x) => ({ label: x.key, a: x.current, b: x.previous, delta: x.delta })) }], evidence: ev("get_month_explanation", `${c.monthLabel} explained`, { ...p, label: c.monthLabel, months: 1 }, [{ metric: "total", value: r2(c.currentTotal) }, { metric: "previous_month_total", value: r2(c.previousTotal) }, { metric: "change", value: r2(c.delta) }, { metric: "three_month_average", value: r3 }, { metric: "transactions", value: n }, { metric: "previous_month_transactions", value: nPrev }]) };
    },
  },
  {
    name: "get_hypothetical_reversion",
    description: "What you would have spent if spending (overall, one category, or one merchant) had stayed at its average monthly level in a baseline range. Pure arithmetic on real figures, not a forecast.",
    parameters: { type: "object", properties: { dateRange: DATE_RANGE_SCHEMA, baselineRange: DATE_RANGE_SCHEMA, category: { type: "string", enum: [...CATEGORIES] }, merchant: { type: "string" } }, required: ["dateRange", "baselineRange"], additionalProperties: false },
    status: () => "Running the what-if…",
    run: (a, ctx) => {
      const r = range(a, ctx);
      const b = range(a, ctx, "baselineRange");
      const category = a.category ? resolveCategory(String(a.category)) : null;
      const merchant = a.merchant ? resolveMerchant(String(a.merchant), ctx.txs) : null;
      const filter = (t: Transaction) => (merchant ? t.merchant === merchant : category ? t.category === category : !M.isFixedTx(t));
      const sum = (p: M.Period) => M.spendTxs(ctx.txs, p).filter(filter).reduce((s, t) => s + M.spendAmount(t), 0);
      const baselineMonthly = r2(sum(b) / Math.max(1, b.months));
      const actual = r2(sum(r));
      const hypothetical = r2(baselineMonthly * r.months);
      const data = { subject: merchant ?? category ?? "discretionary spending", range: r, baselineRange: b, baselineMonthly, actualTotal: actual, hypotheticalTotal: hypothetical, difference: r2(actual - hypothetical), actualMonthly: r2(actual / Math.max(1, r.months)) };
      return { data, cards: [{ type: "comparison", title: `Actual vs at ${b.label} pace`, a: { label: "Actual", value: actual }, b: { label: `At ${b.label} pace`, value: hypothetical }, rows: [] }], evidence: ev("get_hypothetical_reversion", "What-if", r, [{ metric: "baseline_monthly", value: baselineMonthly }, { metric: "actual_total", value: actual }, { metric: "hypothetical_total", value: hypothetical }, { metric: "difference", value: r2(actual - hypothetical) }]) };
    },
  },
  {
    name: "get_habits",
    description: "Whole-history habits: top merchants with visit counts, cadence, yearly run rate and what halving them saves, plus month rhythm and impulse purchases. Use for 'what habits cost me most'.",
    parameters: rangeParams(),
    status: () => "Reading your habits…",
    run: (a, ctx) => {
      const r = a.dateRange ? range(a, ctx) : null;
      const h = buildHabits(ctx.txs, ctx.rules, r ? { from: r.start, to: r.end } : undefined);
      if (!h) return { data: { error: "No spending in that range." }, cards: [], evidence: ev("get_habits", "Habits", r, []) };
      const data = { range: r ?? { start: h.from, end: h.to, label: "all history" }, months: h.monthsCount, totalSpent: r2(h.totalSpent), avgMonthly: r2(h.avgMonthly), topMerchants: h.merchants.slice(0, 8).map((m) => ({ merchant: m.merchant, category: m.category, total: r2(m.total), visits: m.count, perWeek: r2(m.perWeek), when: m.when, trend: m.trend, yearlyRunRate: r2(m.yearlyRunRate), halfSaves: r2(m.halfSaves) })), categories: h.categories.slice(0, 6).map((c) => ({ category: c.category, total: r2(c.total), share: r2(c.share), trend: c.trend, perMonth: r2(c.perMonth) })), impulse: { count: h.impulse.count, total: r2(h.impulse.total), median: r2(h.impulse.median) } };
      return { data, cards: [{ type: "breakdown", title: "Biggest habits", kind: "merchant", rows: h.merchants.slice(0, 6).map((m) => ({ label: m.merchant, value: r2(m.total), count: m.count, category: m.category })) }], evidence: ev("get_habits", "Habits", r, h.merchants.slice(0, 3).map((m) => ({ metric: `total:${m.merchant}`, value: r2(m.total) }))) };
    },
  },
];

export const TOOL_INDEX = new Map(TOOLS.map((t) => [t.name, t]));

export function buildToolContext(txs: Transaction[], rules: SubscriptionRule[]): ToolContext | null {
  const latest = latestMonthOf(txs);
  if (!latest) return null;
  const months = availableMonths(txs);
  return { txs, rules, latestMonth: latest, firstMonth: months[0] };
}

export function runTool(name: string, args: Args, ctx: ToolContext): ToolResult {
  const def = TOOL_INDEX.get(name);
  if (!def) return { status: "Checking…", data: { error: `Unknown tool ${name}` }, cards: [], evidence: { tool: name, label: name, range: null, values: [] } };
  try {
    const out = def.run(args ?? {}, ctx);
    return { status: def.status(args ?? {}), ...out };
  } catch (e) {
    return { status: def.status(args ?? {}), data: { error: "That analysis could not be completed for this range." , detail: (e as Error).message }, cards: [], evidence: { tool: name, label: def.name, range: null, values: [] } };
  }
}

/** OpenAI function tool definitions. */
export function toolDefinitions() {
  return TOOLS.map((t) => ({ type: "function" as const, name: t.name, description: t.description, parameters: t.parameters, strict: false }));
}

/** Every number a tool returned, so the answer can be checked for invented figures. */
export function numbersFrom(value: unknown, into = new Set<number>()): Set<number> {
  if (typeof value === "number" && Number.isFinite(value)) {
    into.add(Math.abs(value));
    into.add(Math.abs(Math.round(value)));
    into.add(Math.abs(Math.round(value * 10) / 10));
  } else if (typeof value === "string") {
    for (const m of value.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
      const n = Number(m[0].replace(/,/g, ""));
      if (Number.isFinite(n)) into.add(Math.abs(n));
    }
  } else if (Array.isArray(value)) value.forEach((v) => numbersFrom(v, into));
  else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach((v) => numbersFrom(v, into));
  return into;
}

export { monthKey };
