import type { SubscriptionRule, Transaction } from "../types";
import * as M from "../analytics/metrics";
import { detectRecurring } from "../analytics/recurring";
import { monthFeatures, type BehaviorFeature, type FeatureType } from "./features";

/**
 * EPIC 4: longitudinal behavior model. Monthly snapshots plus change
 * detection over the resulting time series. Deterministic.
 */

export interface SnapshotMetrics {
  spend: number;
  income: number;
  variable: number;
  fixed: number;
  transactions: number;
  avgTransaction: number;
  weekendRatio: number;
  subscriptionCount: number;
  recurringMonthly: number;
  savingsRate: number | null;
  diningDelivery: number;
  convenience: number;
  travel: number;
  shopping: number;
}

export interface BehaviorSnapshot {
  month: string;
  metrics: SnapshotMetrics;
  features: BehaviorFeature[];
}

export type TimelineEventKind = "start" | "persistence" | "reversal" | "acceleration" | "regime_shift";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** Month the event is dated to. */
  date: string;
  title: string;
  /** Which metric or feature this is about. */
  subject: string;
  confidence: number;
  evidence: Array<{ metric: string; value: number | string }>;
  /** Feature ids that back this event (from the snapshots). */
  evidenceFeatureIds: string[];
  /** Small series for a comparison chart. */
  series?: Array<{ month: string; value: number }>;
}

export interface BehaviorTimeline {
  snapshots: BehaviorSnapshot[];
  events: TimelineEvent[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildSnapshots(txs: Transaction[], rules: SubscriptionRule[] = []): BehaviorSnapshot[] {
  const p = M.periodFromTransactions(txs.filter((t) => M.spendAmount(t) > 0));
  if (!p) return [];
  // Recurring merchants are detected once over the whole history, then counted
  // as active in every month between their first and last charge. This avoids
  // the warm-up artifact where the first months look like they have no subscriptions.
  const recurring = detectRecurring(txs, rules)
    .filter((r) => r.confidence >= 0.6 && r.status !== "ignored" && r.category !== "Housing")
    .map((r) => {
      const months = txs.filter((t) => r.transactionIds.includes(t.id)).map((t) => t.date.slice(0, 7)).sort();
      return { monthlyCost: r.monthlyCost, first: months[0] ?? r.lastPayment.slice(0, 7), last: months[months.length - 1] ?? r.lastPayment.slice(0, 7) };
    });
  return M.monthsIn(p).map((month) => {
    const active = recurring.filter((r) => r.first <= month && month <= r.last);
    const mp = M.periodForMonth(month);
    const rows = M.inPeriod(txs, mp);
    const spendRows = rows.filter((t) => M.spendAmount(t) > 0);
    const fv = M.getFixedVsVariableSpend(txs, mp).value;
    const sum = (f: (t: Transaction) => boolean) => r2(spendRows.filter(f).reduce((a, t) => a + M.spendAmount(t), 0));
    const income = rows.reduce((a, t) => a + (t.transactionType === "income" ? t.amount : 0), 0);
    const spend = fv.fixed + fv.variable;
    return {
      month,
      metrics: {
        spend: r2(spend),
        income: r2(income),
        variable: fv.variable,
        fixed: fv.fixed,
        transactions: spendRows.length,
        avgTransaction: r2(spendRows.length ? spend / spendRows.length : 0),
        weekendRatio: M.getWeekendWeekdayRatio(txs, mp, false).value,
        subscriptionCount: active.length,
        recurringMonthly: r2(active.reduce((a, r) => a + r.monthlyCost, 0)),
        savingsRate: income > 0 ? r2((income - spend) / income) : null,
        diningDelivery: sum((t) => t.category === "Dining" || t.category === "Delivery"),
        convenience: sum((t) => t.category === "Delivery" || t.category === "Transportation"),
        travel: sum((t) => t.category === "Travel"),
        shopping: sum((t) => t.category === "Shopping"),
      },
      features: monthFeatures(txs, month, { rules }),
    };
  });
}

// ---------- series helpers ----------

type MetricKey = keyof SnapshotMetrics;

const ALL: TimelineEventKind[] = ["regime_shift", "start", "persistence", "reversal", "acceleration"];
const TRACKED: Array<{ key: MetricKey; label: string; minLevel: number; detectors: TimelineEventKind[] }> = [
  { key: "variable", label: "Discretionary spend", minLevel: 200, detectors: ALL },
  { key: "diningDelivery", label: "Dining and delivery", minLevel: 100, detectors: ALL },
  { key: "convenience", label: "Delivery and rides", minLevel: 60, detectors: ALL },
  { key: "shopping", label: "Shopping", minLevel: 60, detectors: ALL },
  { key: "fixed", label: "Fixed costs", minLevel: 200, detectors: ["regime_shift", "acceleration"] },
  { key: "subscriptionCount", label: "Subscription count", minLevel: 1, detectors: ["regime_shift", "acceleration", "persistence"] },
  { key: "recurringMonthly", label: "Recurring monthly cost", minLevel: 20, detectors: ["regime_shift", "acceleration", "persistence"] },
  { key: "avgTransaction", label: "Average purchase size", minLevel: 5, detectors: ["regime_shift", "persistence", "acceleration"] },
  { key: "transactions", label: "Purchase frequency", minLevel: 5, detectors: ["regime_shift", "persistence", "reversal"] },
  // Weekend bias is a noisy ratio month to month; only a sustained level change counts.
  { key: "weekendRatio", label: "Weekend spending bias", minLevel: 0.5, detectors: ["regime_shift"] },
  { key: "travel", label: "Travel spend", minLevel: 50, detectors: ["start", "persistence"] },
];

/** Relative month-to-month noise of a series; thresholds scale with it so noisy series need bigger moves. */
function noiseOf(s: Array<{ value: number }>): number {
  const v = s.map((x) => x.value).filter((x) => x > 0);
  if (v.length < 4) return 0.3;
  const m = mean(v);
  const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1));
  return Math.max(0.3, Math.min(1, (2.5 * sd) / (m || 1)));
}

function series(snaps: BehaviorSnapshot[], key: MetricKey): Array<{ month: string; value: number }> {
  return snaps.map((s) => ({ month: s.month, value: (s.metrics[key] as number | null) ?? 0 }));
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const slope = (xs: number[]) => {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = (n - 1) / 2;
  const my = mean(xs);
  let num = 0;
  let den = 0;
  xs.forEach((y, i) => {
    num += (i - mx) * (y - my);
    den += (i - mx) ** 2;
  });
  return den ? num / den : 0;
};

function featureIdsFor(snaps: BehaviorSnapshot[], months: string[], types: FeatureType[]): string[] {
  return snaps.filter((s) => months.includes(s.month)).flatMap((s) => s.features.filter((f) => types.includes(f.type)).map((f) => f.id));
}

const RELATED: Partial<Record<MetricKey, FeatureType[]>> = {
  variable: ["discretionary_baseline_shift", "lifestyle_inflation"],
  diningDelivery: ["dining_delivery_growth"],
  convenience: ["convenience_spend_growth"],
  shopping: ["category_rotation", "category_concentration"],
  fixed: ["fixed_cost_growth"],
  subscriptionCount: ["subscription_creep"],
  recurringMonthly: ["recurring_cost_growth"],
  avgTransaction: ["average_purchase_size_shift"],
  transactions: ["transaction_frequency_shift"],
  weekendRatio: ["weekend_spending_bias"],
  travel: ["travel_spend_pattern"],
};

// ---------- detectors ----------

/** First month a level is sustained ≥ 25% above the preceding 3-month baseline for 3 months. */
export function detectBehaviorStart(snaps: BehaviorSnapshot[], key: MetricKey, label: string, minLevel: number): TimelineEvent[] {
  const s = series(snaps, key);
  const out: TimelineEvent[] = [];
  for (let i = 3; i <= s.length - 3; i++) {
    const before = mean(s.slice(Math.max(0, i - 6), i).map((x) => x.value));
    const after = mean(s.slice(i, i + 3).map((x) => x.value));
    if (before < minLevel && after >= minLevel * 2 && after > 0) {
      out.push({ id: `start:${key}:${s[i].month}`, kind: "start", date: s[i].month, title: `${label} became a regular line item`, subject: key, confidence: r2(Math.min(1, 0.5 + (after - before) / (after || 1))), evidence: [{ metric: `${key}_avg_before`, value: r2(before) }, { metric: `${key}_avg_after`, value: r2(after) }], evidenceFeatureIds: featureIdsFor(snaps, s.slice(i, i + 3).map((x) => x.month), RELATED[key] ?? []), series: s });
      i += 5;
    }
  }
  return out;
}

/** A level that stays ≥ 20% above the first-6-month baseline for ≥ 6 consecutive months. */
export function detectBehaviorPersistence(snaps: BehaviorSnapshot[], key: MetricKey, label: string, minLevel: number): TimelineEvent[] {
  const s = series(snaps, key);
  if (s.length < 9) return [];
  const base = median(s.slice(0, 6).map((x) => x.value));
  if (base < minLevel) return [];
  const lift = 1 + Math.max(0.2, noiseOf(s.slice(0, 6)) * 0.8);
  let run = 0;
  let startIdx = -1;
  for (let i = 6; i < s.length; i++) {
    if (s[i].value >= base * lift) {
      if (run === 0) startIdx = i;
      run++;
    } else run = 0;
    if (run === 6) {
      const level = mean(s.slice(startIdx, startIdx + 6).map((x) => x.value));
      return [{ id: `persistence:${key}:${s[startIdx].month}`, kind: "persistence", date: s[startIdx].month, title: `${label} settled at a higher level`, subject: key, confidence: r2(Math.min(1, 0.6 + (level / base - lift))), evidence: [{ metric: `${key}_baseline_first_6_months`, value: r2(base) }, { metric: `${key}_sustained_level`, value: r2(level) }, { metric: "sustained_months", value: 6 }, { metric: "threshold_lift", value: r2(lift) }], evidenceFeatureIds: featureIdsFor(snaps, s.slice(startIdx, startIdx + 6).map((x) => x.month), RELATED[key] ?? []), series: s }];
    }
  }
  return [];
}

/** A rise (well above the series' own noise, over 3 months) followed by a fall back toward the earlier level within the next 9 months. */
export function detectBehaviorReversal(snaps: BehaviorSnapshot[], key: MetricKey, label: string, minLevel: number): TimelineEvent[] {
  const s = series(snaps, key);
  const out: TimelineEvent[] = [];
  const noise = noiseOf(s);
  for (let i = 3; i < s.length - 3; i++) {
    const before = mean(s.slice(i - 3, i).map((x) => x.value));
    const peak = mean(s.slice(i, i + 3).map((x) => x.value));
    if (before < minLevel || peak < before * (1 + Math.max(0.5, noise))) continue;
    for (let j = i + 3; j <= s.length - 3 && j <= i + 9; j++) {
      const after = mean(s.slice(j, j + 3).map((x) => x.value));
      if (after <= before * (1 + noise / 2)) {
        out.push({ id: `reversal:${key}:${s[j].month}`, kind: "reversal", date: s[j].month, title: `${label} came back down after a high stretch`, subject: key, confidence: r2(Math.min(1, 0.55 + (peak - after) / (peak || 1))), evidence: [{ metric: `${key}_before`, value: r2(before) }, { metric: `${key}_peak_3m`, value: r2(peak) }, { metric: `${key}_after`, value: r2(after) }, { metric: "peak_started", value: s[i].month }], evidenceFeatureIds: featureIdsFor(snaps, s.slice(i, j + 3).map((x) => x.month), RELATED[key] ?? []), series: s });
        i = j + 2;
        break;
      }
    }
  }
  return out;
}

/** The slope over the last 6 months is materially steeper than over the previous 6. */
export function detectBehaviorAcceleration(snaps: BehaviorSnapshot[], key: MetricKey, label: string, minLevel: number): TimelineEvent[] {
  const s = series(snaps, key);
  if (s.length < 12) return [];
  const recent = s.slice(-6).map((x) => x.value);
  const earlier = s.slice(-12, -6).map((x) => x.value);
  const lvl = mean(recent);
  if (lvl < minLevel) return [];
  const sr = slope(recent) / (lvl || 1);
  const se = slope(earlier) / (mean(earlier) || 1);
  if (sr >= 0.04 && sr >= se * 2 && sr - se >= 0.03) {
    return [{ id: `acceleration:${key}:${s[s.length - 6].month}`, kind: "acceleration", date: s[s.length - 6].month, title: `${label} is climbing faster`, subject: key, confidence: r2(Math.min(1, 0.55 + (sr - se) * 4)), evidence: [{ metric: `${key}_monthly_growth_recent_6m_pct`, value: r2(sr * 100) }, { metric: `${key}_monthly_growth_prior_6m_pct`, value: r2(se * 100) }], evidenceFeatureIds: featureIdsFor(snaps, s.slice(-6).map((x) => x.month), RELATED[key] ?? []), series: s }];
  }
  return [];
}

/**
 * Regime shift: the best single split point where the mean level changes by
 * ≥ 25% and both sides are at least 4 months long and internally steady.
 */
export function detectBehaviorRegimeShift(snaps: BehaviorSnapshot[], key: MetricKey, label: string, minLevel: number): TimelineEvent[] {
  const s = series(snaps, key);
  if (s.length < 8) return [];
  const vals = s.map((x) => x.value);
  const minChange = Math.max(0.25, noiseOf(s) * 0.6);
  let best: { i: number; gain: number; a: number; b: number } | null = null;
  for (let i = 4; i <= vals.length - 4; i++) {
    const a = vals.slice(0, i);
    const b = vals.slice(i);
    const ma = mean(a);
    const mb = mean(b);
    if (Math.max(ma, mb) < minLevel) continue;
    const change = Math.abs(mb - ma) / (ma || 1);
    if (change < minChange) continue;
    const within = a.reduce((acc, v) => acc + (v - ma) ** 2, 0) + b.reduce((acc, v) => acc + (v - mb) ** 2, 0);
    const total = vals.reduce((acc, v) => acc + (v - mean(vals)) ** 2, 0);
    const gain = total ? 1 - within / total : 0;
    if (!best || gain > best.gain) best = { i, gain, a: ma, b: mb };
  }
  if (!best || best.gain < 0.35) return [];
  const up = best.b > best.a;
  return [{ id: `regime:${key}:${s[best.i].month}`, kind: "regime_shift", date: s[best.i].month, title: `${label} moved to a ${up ? "higher" : "lower"} baseline`, subject: key, confidence: r2(Math.min(1, 0.5 + best.gain / 2)), evidence: [{ metric: `${key}_mean_before`, value: r2(best.a) }, { metric: `${key}_mean_after`, value: r2(best.b) }, { metric: "change_pct", value: r2(((best.b - best.a) / (best.a || 1)) * 100) }, { metric: "split_explains_variance", value: r2(best.gain) }], evidenceFeatureIds: featureIdsFor(snaps, s.slice(best.i, best.i + 3).map((x) => x.month), RELATED[key] ?? []), series: s }];
}

export function buildTimeline(txs: Transaction[], rules: SubscriptionRule[] = []): BehaviorTimeline {
  const snapshots = buildSnapshots(txs, rules);
  const events: TimelineEvent[] = [];
  const run: Record<TimelineEventKind, typeof detectBehaviorStart> = {
    regime_shift: detectBehaviorRegimeShift,
    start: detectBehaviorStart,
    persistence: detectBehaviorPersistence,
    reversal: detectBehaviorReversal,
    acceleration: detectBehaviorAcceleration,
  };
  for (const t of TRACKED) for (const d of t.detectors) events.push(...run[d](snapshots, t.key, t.label, t.minLevel));
  // De-duplicate near-identical events on the same subject within 2 months, keep the most confident.
  const kept: TimelineEvent[] = [];
  for (const e of events.sort((a, b) => b.confidence - a.confidence)) {
    const dup = kept.find((k) => k.subject === e.subject && k.kind === e.kind && Math.abs(monthDiff(k.date, e.date)) <= 2);
    if (!dup) kept.push(e);
  }
  return { snapshots, events: kept.sort((a, b) => a.date.localeCompare(b.date)) };
}

function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}
