import type { BehaviorSnapshot } from "./timeline";
import type { BehaviorFeature } from "./features";

/**
 * EPIC 8: hidden patterns. Multi-variable relationships detected
 * deterministically from the snapshot series. AI may explain them; it never
 * discovers them.
 */

export interface HiddenPattern {
  id: string;
  title: string;
  /** Observable framing, no psychology. */
  summary: string;
  importance: "high" | "medium" | "low";
  confidence: number;
  evidence: Array<{ metric: string; value: number | string }>;
  evidenceFeatureIds: string[];
  period: { start: string; end: string };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (a: number, b: number) => (b ? r2(((a - b) / Math.abs(b)) * 100) : 0);

/** Compare the last 6 months against the 6 before them. */
export function detectHiddenPatterns(snaps: BehaviorSnapshot[], features: BehaviorFeature[]): HiddenPattern[] {
  if (snaps.length < 8) return [];
  const half = Math.min(12, Math.floor(snaps.length / 2));
  const recent = snaps.slice(-half);
  const prior = snaps.slice(-half * 2, -half);
  const period = { start: `${recent[0].month}-01`, end: `${recent[recent.length - 1].month}-28` };
  const m = (rows: BehaviorSnapshot[], k: keyof BehaviorSnapshot["metrics"]) => mean(rows.map((s) => (s.metrics[k] as number | null) ?? 0));
  const fid = (types: BehaviorFeature["type"][]) => features.filter((f) => types.includes(f.type)).map((f) => f.id);
  const out: HiddenPattern[] = [];

  const spendChg = pct(m(recent, "spend"), m(prior, "spend"));
  const freqChg = pct(m(recent, "transactions"), m(prior, "transactions"));
  const avgChg = pct(m(recent, "avgTransaction"), m(prior, "avgTransaction"));
  const incChg = pct(m(recent, "income"), m(prior, "income"));
  const fixedChg = pct(m(recent, "fixed"), m(prior, "fixed"));
  const varChg = pct(m(recent, "variable"), m(prior, "variable"));
  const subCountChg = m(recent, "subscriptionCount") - m(prior, "subscriptionCount");
  const subCostChg = pct(m(recent, "recurringMonthly"), m(prior, "recurringMonthly"));
  const srRecent = m(recent, "savingsRate");
  const srPrior = m(prior, "savingsRate");

  // 1. spend up while frequency flat
  if (spendChg >= 15 && Math.abs(freqChg) < 8) {
    out.push({ id: "spend-up-frequency-flat", title: "Spending rose without buying more often", summary: `Spend is up ${spendChg}% while the number of purchases moved ${freqChg}%. The change is in purchase size, not count.`, importance: "high", confidence: 0.8, evidence: [{ metric: "spend_change_pct", value: spendChg }, { metric: "frequency_change_pct", value: freqChg }, { metric: "avg_purchase_change_pct", value: avgChg }], evidenceFeatureIds: fid(["average_purchase_size_shift", "discretionary_baseline_shift"]), period });
  }
  // 2. income up but savings rate flat
  if (incChg >= 10 && Math.abs(srRecent - srPrior) < 0.04) {
    out.push({ id: "income-up-savings-flat", title: "Income rose, savings rate did not", summary: `Income is up ${incChg}% but the share kept stayed at ${Math.round(srRecent * 100)}% (was ${Math.round(srPrior * 100)}%). Spending absorbed the raise.`, importance: "high", confidence: 0.85, evidence: [{ metric: "income_change_pct", value: incChg }, { metric: "savings_rate_recent", value: r2(srRecent) }, { metric: "savings_rate_prior", value: r2(srPrior) }, { metric: "spend_change_pct", value: spendChg }], evidenceFeatureIds: fid(["income_spend_decoupling", "lifestyle_inflation", "savings_rate_shift"]), period });
  }
  // 3. category stable but merchant concentration rising
  const topShareRecent = mean(recent.map((s) => s.features.find((f) => f.type === "merchant_concentration")?.value as number ?? 0));
  const topSharePrior = mean(prior.map((s) => s.features.find((f) => f.type === "merchant_concentration")?.value as number ?? 0));
  if (Math.abs(varChg) < 10 && topShareRecent - topSharePrior >= 0.08) {
    out.push({ id: "concentration-rising", title: "Same spending, fewer places", summary: `Discretionary spend moved only ${varChg}%, but the top three merchants' share rose from ${Math.round(topSharePrior * 100)}% to ${Math.round(topShareRecent * 100)}%.`, importance: "medium", confidence: 0.7, evidence: [{ metric: "variable_change_pct", value: varChg }, { metric: "top3_share_recent", value: r2(topShareRecent) }, { metric: "top3_share_prior", value: r2(topSharePrior) }], evidenceFeatureIds: fid(["merchant_concentration"]), period });
  }
  // 4. fewer purchases but higher average purchase size
  if (freqChg <= -15 && avgChg >= 15) {
    out.push({ id: "fewer-larger", title: "Fewer purchases, bigger ones", summary: `Purchases per month fell ${Math.abs(freqChg)}% while the average purchase grew ${avgChg}%.`, importance: "medium", confidence: 0.8, evidence: [{ metric: "frequency_change_pct", value: freqChg }, { metric: "avg_purchase_change_pct", value: avgChg }, { metric: "spend_change_pct", value: spendChg }], evidenceFeatureIds: fid(["transaction_frequency_shift", "average_purchase_size_shift"]), period });
  }
  // 5. fixed costs stable while discretionary baseline rises
  if (Math.abs(fixedChg) < 6 && varChg >= 15) {
    out.push({ id: "fixed-flat-discretionary-up", title: "Bills flat, lifestyle up", summary: `Fixed costs moved ${fixedChg}% while discretionary spending rose ${varChg}%. The increase is all choice, not obligation.`, importance: "high", confidence: 0.8, evidence: [{ metric: "fixed_change_pct", value: fixedChg }, { metric: "variable_change_pct", value: varChg }], evidenceFeatureIds: fid(["discretionary_baseline_shift", "lifestyle_inflation", "dining_delivery_growth"]), period });
  }
  // 6. subscriptions stable in count but rising in cost
  if (Math.abs(subCountChg) < 1 && subCostChg >= 10) {
    out.push({ id: "subs-same-count-more-cost", title: "Same subscriptions, higher bill", summary: `Subscription count barely moved (${r2(subCountChg)}) but the recurring monthly cost rose ${subCostChg}%. Price increases, not new services.`, importance: "medium", confidence: 0.75, evidence: [{ metric: "subscription_count_change", value: r2(subCountChg) }, { metric: "recurring_cost_change_pct", value: subCostChg }], evidenceFeatureIds: fid(["recurring_cost_growth"]), period });
  }
  // 7. travel spikes followed by elevated discretionary baseline
  const travelIdx = snaps.map((s, i) => (s.metrics.travel > 0 ? i : -1)).filter((i) => i >= 0);
  for (const i of travelIdx) {
    const before = snaps.slice(Math.max(0, i - 3), i);
    const after = snaps.slice(i + 1, i + 4);
    if (before.length < 3 || after.length < 3) continue;
    const vb = mean(before.map((s) => s.metrics.variable - s.metrics.travel));
    const va = mean(after.map((s) => s.metrics.variable - s.metrics.travel));
    if (vb > 0 && va >= vb * 1.2) {
      out.push({ id: `travel-then-elevated:${snaps[i].month}`, title: "Spending stayed high after travel", summary: `After travel in ${snaps[i].month}, non-travel discretionary spend ran ${pct(va, vb)}% above the three months before the trip.`, importance: "medium", confidence: 0.65, evidence: [{ metric: "travel_month", value: snaps[i].month }, { metric: "discretionary_before_3m_avg", value: r2(vb) }, { metric: "discretionary_after_3m_avg", value: r2(va) }], evidenceFeatureIds: fid(["travel_spend_pattern", "discretionary_baseline_shift"]), period: { start: `${before[0].month}-01`, end: `${after[after.length - 1].month}-28` } });
      break;
    }
  }
  return out;
}
