import type { SubscriptionRule, Transaction } from "../types";
import { availableMonths, latestMonth } from "../analytics/core";
import { executePlan } from "./executor";
import { RuleBasedPlanner } from "./planner";
import type { Answer, PlannerContext, QueryPlanner } from "./types";

export type { Answer, QueryPlan, QueryPlanner, PlannerContext } from "./types";
export { RuleBasedPlanner } from "./planner";
export { executePlan } from "./executor";

/**
 * Ask SpendLens: question -> plan -> answer.
 * Swap `planner` for an LLM-backed implementation to enable free-form questions.
 */
export async function ask(question: string, txs: Transaction[], planner: QueryPlanner = new RuleBasedPlanner(), rules: SubscriptionRule[] = []): Promise<Answer> {
  const latest = latestMonth(txs);
  if (!latest) {
    return { text: "Import a CSV first and I'll be able to answer questions about your spending.", plan: { kind: "help" } };
  }
  const ctx: PlannerContext = {
    latestMonth: latest,
    availableMonths: availableMonths(txs),
    merchants: [...new Set(txs.map((t) => t.merchant))],
    rules,
  };
  const plan = await planner.plan(question, ctx);
  return executePlan(plan, txs, rules);
}
