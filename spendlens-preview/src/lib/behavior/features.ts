import type { Category, SubscriptionRule, Transaction } from "../types";
import { addMonths } from "../dates";
import * as M from "../analytics/metrics";

/**
 * EPIC 3: deterministic behavior feature extraction.
 *
 * A feature is a machine-readable signal derived from metrics, always with the
 * evidence that produced it. Nothing here calls a model. Thresholds are
 * explicit constants so the "why" is inspectable.
 */

export type FeatureType =
  | "discretionary_baseline_shift"
  | "weekend_spending_bias"
  | "late_day_spending_bias"
  | "merchant_concentration"
  | "category_concentration"
  | "subscription_creep"
  | "recurring_cost_growth"
  | "average_purchase_size_shift"
  | "transaction_frequency_shift"
  | "spend_volatility_shift"
  | "convenience_spend_growth"
  | "travel_spend_pattern"
  | "dining_delivery_growth"
  | "fixed_cost_growth"
  | "income_spend_decoupling"
  | "savings_rate_shift"
  | "spend_spike_pattern"
  | "impulse_like_burst_pattern"
  | "lifestyle_inflation"
  | "category_rotation";

export interface Evidence {
  metric: string;
  value: number | string;
}

export interface BehaviorFeature {
  id: string;
  type: FeatureType;
  label: string;
  value: number | string;
  unit: string | null;
  direction: "up" | "down" | "stable" | null;
  /** 0..1, how pronounced the signal is. */
  strength: number;
  /** 0..1, how much data backs it. */
  confidence: number;
  period: M.Period;
  comparisonPeriod?: M.Period;
  evidence: Evidence[];
}

export interface FeatureOptions {
  rules?: SubscriptionRule[];
  /** Comparison window. Default: the previous period of equal length. */
  comparison?: M.Period;
}

const T = {
  weekendRatio: 1.5,
  baselineShiftPct: 15,
  concentrationTop3: 0.45,
  categoryTopShare: 0.35,
  subCreepCount: 2,
  costGrowthPct: 12,
  avgSizeShiftPct: 20,
  frequencyShiftPct: 20,
  volatilityShift: 0.1,
  convenienceGrowthPct: 20,
  travelMonthsShare: 0.34,
  diningGrowthPct: 20,
  fixedGrowthPct: 8,
  decouplingGapPct: 15,
  savingsShiftPts: 0.05,
  spikeMultiple: 1.4,
  burstMinTx: 4,
  lifestyleGapPct: 10,
  rotationShare: 0.08,
};

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const r2 = (n: number) => Math.round(n * 100) / 100;
const CONVENIENCE: Category[] = ["Delivery", "Transportation"];

/** Confidence grows with the number of complete months and spend transactions behind a feature. */
function dataConfidence(txs: Transaction[], p: M.Period): number {
  const months = M.monthsIn(p).length;
  const n = M.spendTxs(txs, p).length;
  return clamp(0.35 + Math.min(months, 12) / 24 + Math.min(n, 200) / 500);
}

export function extractFeatures(txs: Transaction[], period: M.Period, opts: FeatureOptions = {}): BehaviorFeature[] {
  const rules = opts.rules ?? [];
  const cmp = opts.comparison ?? M.previousPeriod(period);
  const hasPrev = M.spendTxs(txs, cmp).length >= 5;
  const conf = dataConfidence(txs, period);
  const out: BehaviorFeature[] = [];
  const idOf = (type: FeatureType) => `${type}:${period.start}:${period.end}`;
  const push = (f: Omit<BehaviorFeature, "id" | "period" | "confidence"> & { confidence?: number }) =>
    out.push({ id: idOf(f.type), period, confidence: r2(f.confidence ?? conf), ...f });

  // 1. discretionary_baseline_shift
  const base = M.getDiscretionaryBaseline(txs, period, false).value;
  const basePrev = M.getDiscretionaryBaseline(txs, cmp, false).value;
  if (hasPrev && basePrev > 0) {
    const chg = M.pct(base, basePrev)!;
    if (Math.abs(chg) >= T.baselineShiftPct) {
      push({ type: "discretionary_baseline_shift", label: `Discretionary baseline ${chg > 0 ? "rose" : "fell"} ${Math.abs(chg).toFixed(0)}%`, value: chg, unit: "%", direction: chg > 0 ? "up" : "down", strength: clamp(Math.abs(chg) / 60), comparisonPeriod: cmp, evidence: [{ metric: "discretionary_baseline_monthly", value: base }, { metric: "discretionary_baseline_monthly_previous", value: basePrev }] });
    }
  }

  // 2. weekend_spending_bias
  const wk = M.getWeekendWeekdayRatio(txs, period, hasPrev);
  if (wk.value >= T.weekendRatio) {
    push({ type: "weekend_spending_bias", label: `Weekend days cost ${wk.value.toFixed(1)}× weekdays`, value: wk.value, unit: "x", direction: wk.comparison ? (wk.value > wk.comparison.previousPeriodValue * 1.1 ? "up" : wk.value < wk.comparison.previousPeriodValue * 0.9 ? "down" : "stable") : null, strength: clamp((wk.value - 1) / 3), comparisonPeriod: wk.comparison?.previousPeriod, evidence: [{ metric: "weekend_weekday_ratio", value: wk.value }, ...(wk.comparison ? [{ metric: "weekend_weekday_ratio_previous", value: wk.comparison.previousPeriodValue }] : [])] });
  }

  // 3. late_day_spending_bias (only when the data carries times)
  const tod = M.getTimeOfDayDistribution(txs, period);
  if (tod.value.available) {
    const late = tod.value.buckets.find((b) => b.bucket === "late")?.share ?? 0;
    if (late >= 0.25) push({ type: "late_day_spending_bias", label: `${Math.round(late * 100)}% of spending happens late in the day`, value: late, unit: "share", direction: null, strength: clamp((late - 0.15) / 0.4), evidence: [{ metric: "time_of_day_late_share", value: late }] });
  }

  // 4. merchant_concentration
  const conc = M.getSpendConcentration(txs, period, hasPrev);
  if (conc.value.top3Share >= T.concentrationTop3) {
    push({ type: "merchant_concentration", label: `Top 3 merchants take ${Math.round(conc.value.top3Share * 100)}% of spending`, value: conc.value.top3Share, unit: "share", direction: conc.comparison ? (conc.value.top3Share > conc.comparison.previousPeriodValue.top3Share + 0.05 ? "up" : conc.value.top3Share < conc.comparison.previousPeriodValue.top3Share - 0.05 ? "down" : "stable") : null, strength: clamp((conc.value.top3Share - 0.3) / 0.5), comparisonPeriod: conc.comparison?.previousPeriod, evidence: [{ metric: "top3_merchant_share", value: conc.value.top3Share }, { metric: "hhi", value: conc.value.hhi }, { metric: "top_merchants", value: conc.value.topMerchants.join(", ") }] });
  }

  // 5. category_concentration (excluding Housing, which dominates everyone)
  const cats = M.getSpendByCategory(txs, period).value.filter((c) => c.key !== "Housing");
  const catTotal = cats.reduce((a, c) => a + c.total, 0) || 1;
  const topCat = cats[0];
  if (topCat && topCat.total / catTotal >= T.categoryTopShare) {
    const share = r2(topCat.total / catTotal);
    push({ type: "category_concentration", label: `${topCat.key} is ${Math.round(share * 100)}% of non-housing spend`, value: share, unit: "share", direction: null, strength: clamp((share - 0.25) / 0.5), evidence: [{ metric: "category", value: topCat.key }, { metric: "share_of_non_housing_spend", value: share }, { metric: "category_total", value: topCat.total }] });
  }

  // 6. subscription_creep & 7. recurring_cost_growth
  const subs = M.getSubscriptionCount(txs, period, rules, hasPrev);
  if (subs.comparison && subs.value - subs.comparison.previousPeriodValue >= T.subCreepCount) {
    push({ type: "subscription_creep", label: `Subscriptions went from ${subs.comparison.previousPeriodValue} to ${subs.value}`, value: subs.value - subs.comparison.previousPeriodValue, unit: "count", direction: "up", strength: clamp((subs.value - subs.comparison.previousPeriodValue) / 6), comparisonPeriod: subs.comparison.previousPeriod, evidence: [{ metric: "subscription_count", value: subs.value }, { metric: "subscription_count_previous", value: subs.comparison.previousPeriodValue }] });
  }
  const rec = M.getRecurringSpend(txs, period, rules, hasPrev);
  if (rec.comparison?.changePct != null && rec.comparison.changePct >= T.costGrowthPct) {
    push({ type: "recurring_cost_growth", label: `Recurring costs up ${rec.comparison.changePct.toFixed(0)}%`, value: rec.comparison.changePct, unit: "%", direction: "up", strength: clamp(rec.comparison.changePct / 50), comparisonPeriod: rec.comparison.previousPeriod, evidence: [{ metric: "recurring_monthly_spend", value: rec.value }, { metric: "recurring_monthly_spend_previous", value: rec.comparison.previousPeriodValue }] });
  }

  // 8. average_purchase_size_shift & 9. transaction_frequency_shift
  const avg = M.getAverageTransactionValue(txs, period, hasPrev);
  if (avg.comparison?.changePct != null && Math.abs(avg.comparison.changePct) >= T.avgSizeShiftPct) {
    push({ type: "average_purchase_size_shift", label: `Average purchase ${avg.comparison.changePct > 0 ? "grew" : "shrank"} ${Math.abs(avg.comparison.changePct).toFixed(0)}%`, value: avg.comparison.changePct, unit: "%", direction: avg.comparison.changePct > 0 ? "up" : "down", strength: clamp(Math.abs(avg.comparison.changePct) / 80), comparisonPeriod: avg.comparison.previousPeriod, evidence: [{ metric: "average_transaction_value", value: avg.value }, { metric: "average_transaction_value_previous", value: avg.comparison.previousPeriodValue }] });
  }
  const freq = M.getTransactionFrequency(txs, period, hasPrev);
  if (freq.comparison?.changePct != null && Math.abs(freq.comparison.changePct) >= T.frequencyShiftPct) {
    push({ type: "transaction_frequency_shift", label: `Purchase frequency ${freq.comparison.changePct > 0 ? "up" : "down"} ${Math.abs(freq.comparison.changePct).toFixed(0)}%`, value: freq.comparison.changePct, unit: "%", direction: freq.comparison.changePct > 0 ? "up" : "down", strength: clamp(Math.abs(freq.comparison.changePct) / 80), comparisonPeriod: freq.comparison.previousPeriod, evidence: [{ metric: "transaction_frequency_per_30d", value: freq.value }, { metric: "transaction_frequency_per_30d_previous", value: freq.comparison.previousPeriodValue }] });
  }

  // 10. spend_volatility_shift
  const vol = M.getSpendVolatility(txs, period, hasPrev);
  if (vol.comparison && Math.abs(vol.value - vol.comparison.previousPeriodValue) >= T.volatilityShift) {
    const d = vol.value - vol.comparison.previousPeriodValue;
    push({ type: "spend_volatility_shift", label: `Month-to-month spending became ${d > 0 ? "more" : "less"} volatile`, value: r2(d), unit: "cv", direction: d > 0 ? "up" : "down", strength: clamp(Math.abs(d) / 0.4), comparisonPeriod: vol.comparison.previousPeriod, evidence: [{ metric: "spend_volatility_cv", value: vol.value }, { metric: "spend_volatility_cv_previous", value: vol.comparison.previousPeriodValue }] });
  }

  // 11. convenience_spend_growth (Delivery + rideshare/Transportation)
  const convCur = M.spendTxs(txs, period).filter((t) => CONVENIENCE.includes(t.category)).reduce((a, t) => a + M.spendAmount(t), 0);
  const convPrev = M.spendTxs(txs, cmp).filter((t) => CONVENIENCE.includes(t.category)).reduce((a, t) => a + M.spendAmount(t), 0);
  const convChg = hasPrev ? M.pct(convCur, convPrev) : null;
  if (convChg != null && convChg >= T.convenienceGrowthPct && convCur > 100) {
    push({ type: "convenience_spend_growth", label: `Delivery and rides up ${convChg.toFixed(0)}%`, value: convChg, unit: "%", direction: "up", strength: clamp(convChg / 100), comparisonPeriod: cmp, evidence: [{ metric: "convenience_spend", value: r2(convCur) }, { metric: "convenience_spend_previous", value: r2(convPrev) }] });
  }

  // 12. travel_spend_pattern
  const travelMonths = M.getMonthlySpend(txs.filter((t) => t.category === "Travel"), period).value;
  const monthsWithTravel = travelMonths.filter((m) => m.value > 0).length;
  const travelTotal = travelMonths.reduce((a, m) => a + m.value, 0);
  if (travelTotal > 0) {
    const share = monthsWithTravel / Math.max(1, travelMonths.length);
    push({ type: "travel_spend_pattern", label: share >= T.travelMonthsShare ? `Travel shows up in ${monthsWithTravel} of ${travelMonths.length} months` : `Travel is occasional: ${monthsWithTravel} of ${travelMonths.length} months`, value: r2(share), unit: "share_of_months", direction: null, strength: clamp(share), evidence: [{ metric: "travel_months", value: monthsWithTravel }, { metric: "months_in_period", value: travelMonths.length }, { metric: "travel_total", value: r2(travelTotal) }] });
  }

  // 13. dining_delivery_growth
  const dd = (pp: M.Period) => M.spendTxs(txs, pp).filter((t) => t.category === "Dining" || t.category === "Delivery").reduce((a, t) => a + M.spendAmount(t), 0);
  const ddCur = dd(period);
  const ddPrev = dd(cmp);
  const ddChg = hasPrev ? M.pct(ddCur, ddPrev) : null;
  if (ddChg != null && Math.abs(ddChg) >= T.diningGrowthPct && Math.max(ddCur, ddPrev) > 150) {
    push({ type: "dining_delivery_growth", label: `Dining and delivery ${ddChg > 0 ? "up" : "down"} ${Math.abs(ddChg).toFixed(0)}%`, value: ddChg, unit: "%", direction: ddChg > 0 ? "up" : "down", strength: clamp(Math.abs(ddChg) / 100), comparisonPeriod: cmp, evidence: [{ metric: "dining_delivery_spend", value: r2(ddCur) }, { metric: "dining_delivery_spend_previous", value: r2(ddPrev) }] });
  }

  // 14. fixed_cost_growth
  const fv = M.getFixedVsVariableSpend(txs, period).value;
  const fvPrev = M.getFixedVsVariableSpend(txs, cmp).value;
  const fixedChg = hasPrev ? M.pct(fv.fixed, fvPrev.fixed) : null;
  if (fixedChg != null && fixedChg >= T.fixedGrowthPct) {
    push({ type: "fixed_cost_growth", label: `Fixed costs up ${fixedChg.toFixed(0)}%`, value: fixedChg, unit: "%", direction: "up", strength: clamp(fixedChg / 40), comparisonPeriod: cmp, evidence: [{ metric: "fixed_spend", value: fv.fixed }, { metric: "fixed_spend_previous", value: fvPrev.fixed }] });
  }

  // 15. income_spend_decoupling & 16. savings_rate_shift & 19. lifestyle_inflation
  const inc = M.getTotalIncome(txs, period, hasPrev);
  const spend = M.getTotalSpend(txs, period, hasPrev);
  if (inc.value > 0 && inc.comparison && spend.comparison && inc.comparison.previousPeriodValue > 0) {
    const incChg = inc.comparison.changePct ?? 0;
    const spendChg = spend.comparison.changePct ?? 0;
    const gap = spendChg - incChg;
    if (Math.abs(gap) >= T.decouplingGapPct) {
      push({ type: "income_spend_decoupling", label: gap > 0 ? `Spending grew ${gap.toFixed(0)} points faster than income` : `Income grew ${(-gap).toFixed(0)} points faster than spending`, value: r2(gap), unit: "pct_points", direction: gap > 0 ? "up" : "down", strength: clamp(Math.abs(gap) / 50), comparisonPeriod: cmp, evidence: [{ metric: "income_change_pct", value: incChg }, { metric: "spend_change_pct", value: spendChg }] });
    }
    const varChg = M.pct(fv.variable, fvPrev.variable);
    if (varChg != null && varChg - incChg >= T.lifestyleGapPct && varChg > 0) {
      push({ type: "lifestyle_inflation", label: `Discretionary spend grew ${varChg.toFixed(0)}% vs income ${incChg.toFixed(0)}%`, value: r2(varChg - incChg), unit: "pct_points", direction: "up", strength: clamp((varChg - incChg) / 40), comparisonPeriod: cmp, evidence: [{ metric: "variable_spend", value: fv.variable }, { metric: "variable_spend_previous", value: fvPrev.variable }, { metric: "income_change_pct", value: incChg }, { metric: "variable_spend_change_pct", value: varChg }] });
    }
  }
  const sr = M.getSavingsRateIfIncomeExists(txs, period, hasPrev);
  if (sr.value != null && sr.comparison?.previousPeriodValue != null && Math.abs(sr.value - sr.comparison.previousPeriodValue) >= T.savingsShiftPts) {
    const d = r2(sr.value - sr.comparison.previousPeriodValue);
    push({ type: "savings_rate_shift", label: `Savings rate ${d > 0 ? "up" : "down"} ${Math.round(Math.abs(d) * 100)} points`, value: d, unit: "pct_points", direction: d > 0 ? "up" : "down", strength: clamp(Math.abs(d) / 0.25), comparisonPeriod: sr.comparison.previousPeriod, evidence: [{ metric: "savings_rate", value: sr.value }, { metric: "savings_rate_previous", value: sr.comparison.previousPeriodValue }] });
  }

  // 17. spend_spike_pattern: months well above the period median
  const monthly = M.getMonthlySpend(txs, period).value.filter((m) => m.value > 0);
  if (monthly.length >= 4) {
    const med = [...monthly].sort((a, b) => a.value - b.value)[Math.floor(monthly.length / 2)].value;
    const spikes = monthly.filter((m) => m.value >= med * T.spikeMultiple);
    if (spikes.length) {
      push({ type: "spend_spike_pattern", label: `${spikes.length} spike month${spikes.length === 1 ? "" : "s"} at ${T.spikeMultiple}× the typical month`, value: spikes.length, unit: "months", direction: null, strength: clamp(spikes.length / Math.max(4, monthly.length / 2)), evidence: [{ metric: "median_month_spend", value: r2(med) }, { metric: "spike_months", value: spikes.map((s) => s.month).join(", ") }, { metric: "spike_total", value: r2(spikes.reduce((a, s) => a + s.value, 0)) }] });
    }
  }

  // 18. impulse_like_burst_pattern: ≥ N discretionary purchases on one day (observable, no psychology)
  const byDay = new Map<string, number>();
  for (const t of M.spendTxs(txs, period).filter((t) => !M.isFixedTx(t) && t.category !== "Groceries")) byDay.set(t.date, (byDay.get(t.date) ?? 0) + 1);
  const burstDays = [...byDay.entries()].filter(([, n]) => n >= T.burstMinTx);
  if (burstDays.length >= 2) {
    push({ type: "impulse_like_burst_pattern", label: `${burstDays.length} days with ${T.burstMinTx}+ discretionary purchases`, value: burstDays.length, unit: "days", direction: null, strength: clamp(burstDays.length / 12), evidence: [{ metric: "burst_days", value: burstDays.length }, { metric: "burst_threshold_purchases", value: T.burstMinTx }, { metric: "example_days", value: burstDays.slice(0, 3).map(([d]) => d).join(", ") }] });
  }

  // 20. category_rotation: categories that gained or lost > N share points vs comparison
  if (hasPrev) {
    const curShares = new Map(M.getSpendByCategory(txs, period).value.map((c) => [c.key, c.share]));
    const prevShares = new Map(M.getSpendByCategory(txs, cmp).value.map((c) => [c.key, c.share]));
    const moves = [...new Set([...curShares.keys(), ...prevShares.keys()])]
      .map((k) => ({ k, d: (curShares.get(k) ?? 0) - (prevShares.get(k) ?? 0) }))
      .filter((x) => Math.abs(x.d) >= T.rotationShare)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (moves.length >= 2) {
      const up = moves.filter((m) => m.d > 0).map((m) => m.k);
      const down = moves.filter((m) => m.d < 0).map((m) => m.k);
      push({ type: "category_rotation", label: `Spending rotated${up.length ? ` toward ${up.join(", ")}` : ""}${down.length ? ` away from ${down.join(", ")}` : ""}`, value: moves.length, unit: "categories", direction: null, strength: clamp(Math.abs(moves[0].d) / 0.3), comparisonPeriod: cmp, evidence: moves.slice(0, 4).map((m) => ({ metric: `share_change:${m.k}`, value: r2(m.d) })) });
    }
  }

  return out.sort((a, b) => b.strength - a.strength);
}

/** Convenience: features for one month compared with the month before. */
export function monthFeatures(txs: Transaction[], month: string, opts: FeatureOptions = {}): BehaviorFeature[] {
  return extractFeatures(txs, M.periodForMonth(month), { ...opts, comparison: M.periodForMonth(addMonths(month, -1)) });
}
