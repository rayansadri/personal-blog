import type { Category } from "../types";

/** Time window the question refers to. Resolved against the data's latest month. */
export interface TimeRange {
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
}

/**
 * A structured analytics query. The deterministic planner (V1) and a future
 * LLM planner (V2) both produce this shape; the executor stays the same.
 */
export type QueryPlan =
  | { kind: "spend-total"; range: TimeRange; merchant?: string; category?: Category; categories?: Category[] }
  | { kind: "explain-month"; month: string }
  | { kind: "top-merchants"; range: TimeRange; limit: number }
  | { kind: "top-categories"; range: TimeRange; limit: number }
  | { kind: "recurring"; limit: number }
  | { kind: "upcoming"; days: number }
  | { kind: "habits" }
  | { kind: "attention"; month: string }
  | { kind: "frequency_vs_size"; range: TimeRange }
  | { kind: "compare_periods"; a: TimeRange; b: TimeRange }
  | { kind: "explain_year"; year: string }
  | { kind: "detect_behavior_change" }
  | { kind: "lifestyle_inflation" }
  | { kind: "weekend_spend"; range: TimeRange }
  | { kind: "late_day_spend"; range: TimeRange }
  | { kind: "merchant_growth"; merchant: string; range: TimeRange }
  | { kind: "category_growth"; category: Category; range: TimeRange }
  | { kind: "income_vs_spend"; range: TimeRange }
  | { kind: "savings_rate"; range: TimeRange }
  | { kind: "hypothetical_reversion"; merchant?: string; category?: Category; toMonth: string; range: TimeRange }
  | { kind: "trend"; months: string[] }
  | { kind: "count"; range: TimeRange; merchant?: string; category?: Category; categories?: Category[] }
  | { kind: "income"; range: TimeRange }
  | { kind: "largest"; range: TimeRange; limit: number }
  | { kind: "help" };

export interface AnswerTable {
  columns: string[];
  rows: Array<Array<string | number>>;
}

export interface AnswerChart {
  type: "bar";
  data: Array<{ label: string; value: number }>;
}

export interface Answer {
  /** Headline sentence. */
  text: string;
  /** Optional supporting detail lines. */
  details?: string[];
  table?: AnswerTable;
  chart?: AnswerChart;
  plan: QueryPlan;
}

/** Implemented by the deterministic planner today; an LLM planner tomorrow. */
export interface QueryPlanner {
  plan(question: string, context: PlannerContext): QueryPlan | Promise<QueryPlan>;
}

export interface PlannerContext {
  /** Subscription feedback, passed to recurring detection. */
  rules?: import("../types").SubscriptionRule[];
  /** Latest month with data, YYYY-MM. Acts as "now". */
  latestMonth: string;
  availableMonths: string[];
  merchants: string[];
}
