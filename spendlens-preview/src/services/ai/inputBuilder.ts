import type { BehaviorReport } from "@/lib/behavior";
import type { Transaction } from "@/lib/types";
import * as M from "@/lib/analytics/metrics";

/**
 * EPIC 5 + 11: the only thing the model ever sees. Derived aggregates, feature
 * ids and evidence. No transaction rows, descriptions, accounts, file names or
 * card numbers.
 */
export interface InterpreterInput {
  summaryPeriod: { start: string; end: string; months: number };
  comparisonPeriod: { start: string; end: string };
  features: Array<{
    id: string;
    type: string;
    label: string;
    value: number | string;
    unit: string | null;
    direction: "up" | "down" | "stable" | null;
    strength: number;
    confidence: number;
    period: { start: string; end: string };
    evidence: Array<{ metric: string; value: number | string }>;
  }>;
  timelineEvents: Array<{
    id: string;
    kind: string;
    date: string;
    title: string;
    subject: string;
    confidence: number;
    evidence: Array<{ metric: string; value: number | string }>;
    evidenceFeatureIds: string[];
  }>;
  hiddenPatterns: Array<{ id: string; title: string; summary: string; importance: string; confidence: number; evidence: Array<{ metric: string; value: number | string }>; evidenceFeatureIds: string[] }>;
  topCategories: Array<{ category: string; total: number; share: number }>;
  topMerchants: Array<{ merchant: string; total: number; share: number; count: number }>;
  monthlyTrends: Array<{ month: string; spend: number; income: number; variable: number; fixed: number; transactions: number; subscriptionCount: number }>;
  /** Feature types that recur across monthly snapshots: a behavior that is *always* there, not a one-off comparison. */
  persistentFeatures: Array<{ type: string; monthsPresent: number; monthsTotal: number; featureIds: string[] }>;
}

export function buildInterpreterInput(report: BehaviorReport, txs: Transaction[]): InterpreterInput {
  const p = report.period;
  const months = M.monthsIn({ start: report.comparisonPeriod.start, end: p.end });
  return {
    summaryPeriod: { start: report.comparisonPeriod.start, end: p.end, months: months.length },
    comparisonPeriod: report.comparisonPeriod,
    features: report.features.map((f) => ({ id: f.id, type: f.type, label: f.label, value: f.value, unit: f.unit, direction: f.direction, strength: f.strength, confidence: f.confidence, period: f.period, evidence: f.evidence })),
    timelineEvents: report.timeline.events.map((e) => ({ id: e.id, kind: e.kind, date: e.date, title: e.title, subject: e.subject, confidence: e.confidence, evidence: e.evidence, evidenceFeatureIds: e.evidenceFeatureIds })),
    hiddenPatterns: report.patterns.map((h) => ({ id: h.id, title: h.title, summary: h.summary, importance: h.importance, confidence: h.confidence, evidence: h.evidence, evidenceFeatureIds: h.evidenceFeatureIds })),
    topCategories: M.getSpendByCategory(txs, p).value.slice(0, 8).map((c) => ({ category: c.key, total: c.total, share: c.share })),
    topMerchants: M.getSpendByMerchant(txs, p, 10).value.map((m) => ({ merchant: m.key, total: m.total, share: m.share, count: m.count })),
    monthlyTrends: report.timeline.snapshots.map((s) => ({ month: s.month, spend: s.metrics.spend, income: s.metrics.income, variable: s.metrics.variable, fixed: s.metrics.fixed, transactions: s.metrics.transactions, subscriptionCount: s.metrics.subscriptionCount })),
    persistentFeatures: persistentFeatures(report),
  };
}

function persistentFeatures(report: BehaviorReport): InterpreterInput["persistentFeatures"] {
  const total = report.timeline.snapshots.length;
  const byType = new Map<string, string[]>();
  for (const s of report.timeline.snapshots) for (const f of s.features) byType.set(f.type, [...(byType.get(f.type) ?? []), f.id]);
  return [...byType.entries()]
    .filter(([, ids]) => total >= 3 && ids.length / total >= 0.6)
    .map(([type, ids]) => ({ type, monthsPresent: ids.length, monthsTotal: total, featureIds: ids.slice(-6) }))
    .sort((a, b) => b.monthsPresent - a.monthsPresent);
}

/** Every feature id the model may cite: headline features, snapshot features, timeline events and hidden patterns. */
export function allowedFeatureIds(report: BehaviorReport): Set<string> {
  const ids = new Set<string>(Object.keys(report.featureIndex));
  for (const e of report.timeline.events) ids.add(e.id);
  for (const h of report.patterns) ids.add(h.id);
  return ids;
}

/** Every number the model may quote. Anything else is an invented figure. */
export function allowedNumbers(input: InterpreterInput): Set<number> {
  const out = new Set<number>();
  const add = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      out.add(Math.abs(v));
      out.add(Math.abs(Math.round(v)));
    } else if (typeof v === "string") {
      for (const m of v.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
        const n = Number(m[0].replace(/,/g, ""));
        if (Number.isFinite(n)) out.add(Math.abs(n));
      }
    }
  };
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") Object.values(o as Record<string, unknown>).forEach(walk);
    else add(o);
  };
  walk(input);
  // Derived figures a careful analyst may state: totals and averages over the period.
  const spend = input.monthlyTrends.reduce((a, m) => a + m.spend, 0);
  const income = input.monthlyTrends.reduce((a, m) => a + m.income, 0);
  add(spend);
  add(income);
  if (input.monthlyTrends.length) {
    add(spend / input.monthlyTrends.length);
    add(income / input.monthlyTrends.length);
  }
  return out;
}

export function hashInput(input: InterpreterInput, model: string): string {
  return model + JSON.stringify(input);
}
