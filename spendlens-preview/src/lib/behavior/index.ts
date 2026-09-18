import type { SubscriptionRule, Transaction } from "../types";
import * as M from "../analytics/metrics";
import { extractFeatures, type BehaviorFeature } from "./features";
import { buildTimeline, type BehaviorTimeline } from "./timeline";
import { detectHiddenPatterns, type HiddenPattern } from "./patterns";

export type { BehaviorFeature, FeatureType, Evidence } from "./features";
export type { BehaviorSnapshot, BehaviorTimeline, TimelineEvent } from "./timeline";
export type { HiddenPattern } from "./patterns";

export interface BehaviorReport {
  period: M.Period;
  comparisonPeriod: M.Period;
  /** Features over the most recent half of the history vs the half before. */
  features: BehaviorFeature[];
  timeline: BehaviorTimeline;
  patterns: HiddenPattern[];
  /** Every feature id that exists anywhere in this report (for evidence validation). */
  featureIndex: Record<string, BehaviorFeature>;
}

/**
 * One call that produces every deterministic artifact the AI layer and the
 * UI need. Recent-half vs prior-half is the headline comparison; monthly
 * snapshots supply the time dimension.
 */
export function buildBehaviorReport(txs: Transaction[], rules: SubscriptionRule[] = []): BehaviorReport | null {
  const whole = M.periodFromTransactions(txs.filter((t) => M.spendAmount(t) > 0));
  if (!whole) return null;
  const months = M.monthsIn(whole);
  const half = Math.max(1, Math.floor(months.length / 2));
  const recentStart = M.periodForMonth(months[months.length - half]).start;
  const period: M.Period = { start: recentStart, end: whole.end };
  const comparison: M.Period = { start: whole.start, end: M.periodForMonth(months[Math.max(0, months.length - half - 1)]).end };
  const features = extractFeatures(txs, period, { rules, comparison: months.length >= 2 ? comparison : undefined });
  const timeline = buildTimeline(txs, rules);
  const allFeatures = [...features, ...timeline.snapshots.flatMap((s) => s.features)];
  const featureIndex: Record<string, BehaviorFeature> = {};
  for (const f of allFeatures) featureIndex[f.id] = f;
  const patterns = detectHiddenPatterns(timeline.snapshots, allFeatures);
  return { period, comparisonPeriod: comparison, features, timeline, patterns, featureIndex };
}
