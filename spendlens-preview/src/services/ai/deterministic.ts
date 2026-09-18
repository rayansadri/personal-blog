import type { Interpretation } from "./schema";
import type { InterpreterInput } from "./inputBuilder";

/**
 * Deterministic interpreter: produces the same strict schema from features
 * with no model. Used when AI is disabled, unavailable, or its output fails
 * validation, so the product never depends on a network call.
 */

type F = InterpreterInput["features"][number];

const fmt = (n: number | string) => (typeof n === "number" ? (Math.abs(n) >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `${n}`) : n);

interface ArchetypeRule {
  name: string;
  description: (fs: F[]) => string;
  /** Feature types that support this archetype. Two or more must be present, or one plus a timeline event of the given kinds. */
  types: F["type"][];
  eventSubjects?: string[];
}

const RULES: ArchetypeRule[] = [
  { name: "Convenience-heavy spender", types: ["convenience_spend_growth", "dining_delivery_growth", "category_concentration"], eventSubjects: ["convenience", "diningDelivery"], description: () => "Delivery and rides make up a growing share of spending." },
  { name: "Weekend spender", types: ["weekend_spending_bias", "spend_spike_pattern"], eventSubjects: ["weekendRatio"], description: (fs) => `Weekend days cost more than weekdays (${fmt(fs.find((f) => f.type === "weekend_spending_bias")?.value ?? "")}×).` },
  { name: "Subscription-heavy", types: ["subscription_creep", "recurring_cost_growth"], eventSubjects: ["subscriptionCount", "recurringMonthly"], description: () => "Recurring services are growing in number or cost." },
  { name: "Burst spender", types: ["impulse_like_burst_pattern", "spend_spike_pattern", "spend_volatility_shift"], description: () => "Spending arrives in bursts: spike months and days with several discretionary purchases." },
  { name: "Stable baseline spender", types: [], description: () => "Month-to-month spending is steady with no material shifts." },
  { name: "Lifestyle-inflation pattern", types: ["lifestyle_inflation", "discretionary_baseline_shift", "income_spend_decoupling"], eventSubjects: ["variable"], description: () => "Discretionary spending has moved to a higher level relative to income." },
  { name: "Fewer, larger purchases", types: ["transaction_frequency_shift", "average_purchase_size_shift"], eventSubjects: ["avgTransaction", "transactions"], description: () => "Purchases became less frequent and larger on average." },
  { name: "Experience-first spender", types: ["travel_spend_pattern", "dining_delivery_growth", "category_rotation"], eventSubjects: ["travel"], description: () => "Travel and dining are prominent and recurring in the spending mix." },
  { name: "Concentrated spender", types: ["merchant_concentration", "category_concentration"], description: (fs) => `A few merchants take most of the spending (top three: ${fmt(fs.find((f) => f.type === "merchant_concentration")?.value ?? "")} share).` },
];

export function interpretDeterministically(input: InterpreterInput): Interpretation {
  const fs = input.features;
  const byType = new Map(fs.map((f) => [f.type, f]));
  const events = input.timelineEvents;

  const archetypes: Interpretation["profile"]["archetypes"] = [];
  for (const rule of RULES) {
    const supporting = rule.types.map((t) => byType.get(t)).filter((f): f is F => Boolean(f));
    const evs = events.filter((e) => rule.eventSubjects?.includes(e.subject));
    // A behavior present in most monthly snapshots is corroborating evidence in its own right.
    const persistent = input.persistentFeatures.filter((p) => rule.types.includes(p.type as F["type"]));
    const ids = [...supporting.map((f) => f.id), ...evs.map((e) => e.id), ...persistent.flatMap((p) => p.featureIds.slice(0, 3))];
    const enough = supporting.length >= 2 || (supporting.length === 1 && (evs.length >= 1 || persistent.length >= 1));
    if (rule.name === "Stable baseline spender") {
      const shifts = fs.filter((f) => f.type.endsWith("_shift") || f.type.endsWith("_growth") || f.type === "lifestyle_inflation" || f.type === "subscription_creep");
      if (shifts.length === 0 && fs.length > 0 && events.filter((e) => e.kind !== "persistence").length <= 1) {
        archetypes.push({ name: rule.name, description: rule.description(fs), confidence: 0.7, evidenceFeatureIds: fs.map((f) => f.id).slice(0, 3) });
      }
      continue;
    }
    if (!enough) continue;
    const strength = supporting.reduce((a, f) => a + f.strength, 0) / Math.max(1, supporting.length);
    const conf = Math.min(0.95, 0.5 + strength * 0.3 + Math.min(ids.length, 4) * 0.05);
    archetypes.push({ name: rule.name, description: rule.description(supporting), confidence: Math.round(conf * 100) / 100, evidenceFeatureIds: ids });
  }
  archetypes.sort((a, b) => b.confidence - a.confidence);

  const patterns: Interpretation["patterns"] = fs.slice(0, 8).map((f) => {
    const ev = events.find((e) => f.type.startsWith(e.subject) || (e.subject === "variable" && f.type.includes("discretionary")));
    return {
      id: f.id,
      title: f.label,
      summary: f.evidence.map((e) => `${e.metric.replace(/_/g, " ")}: ${fmt(e.value)}`).join("; ") + ".",
      importance: f.strength >= 0.6 ? "high" : f.strength >= 0.3 ? "medium" : "low",
      confidence: f.confidence,
      evidenceFeatureIds: [f.id, ...(ev ? [ev.id] : [])],
      trend: f.direction === "up" ? "strengthening" : f.direction === "down" ? "weakening" : ev?.kind === "start" ? "new" : "stable",
      startedAt: ev?.date ?? null,
    };
  });

  const timelineNarrative: Interpretation["timelineNarrative"] = events.slice(0, 12).map((e) => ({
    date: e.date,
    title: e.title,
    summary: e.evidence.map((x) => `${x.metric.replace(/_/g, " ")}: ${fmt(x.value)}`).join("; ") + ".",
    evidenceFeatureIds: [e.id, ...e.evidenceFeatureIds.slice(0, 3)],
  }));

  const notableChanges: Interpretation["notableChanges"] = [...input.hiddenPatterns.map((h) => ({ title: h.title, summary: h.summary, impact: h.importance === "high" ? "high" : h.importance === "medium" ? "moderate" : "low", evidenceFeatureIds: [h.id, ...h.evidenceFeatureIds.slice(0, 3)] })), ...fs.filter((f) => f.type === "lifestyle_inflation" || f.type === "fixed_cost_growth" || f.type === "recurring_cost_growth").map((f) => ({ title: f.label, summary: f.evidence.map((e) => `${e.metric.replace(/_/g, " ")}: ${fmt(e.value)}`).join("; ") + ".", impact: f.strength >= 0.5 ? "high" : "moderate", evidenceFeatureIds: [f.id] }))];

  const top = input.topCategories[0];
  const summaryParts = [
    `Over ${input.summaryPeriod.months} months, ${fs.length} behavior signal${fs.length === 1 ? "" : "s"} stand out.`,
    top ? `${top.category} is the largest category at ${Math.round(top.share * 100)}% of spending.` : "",
    archetypes[0] ? `The strongest pattern is ${archetypes[0].name.toLowerCase()}.` : "",
  ].filter(Boolean);

  return { profile: { summary: summaryParts.join(" "), archetypes: archetypes.slice(0, 5) }, patterns, timelineNarrative, notableChanges };
}
