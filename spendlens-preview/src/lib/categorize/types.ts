import type { Category, Transaction } from "../types";

export interface CategorizationInput {
  merchant: string;
  description: string;
  amount: number;
  transactionType: Transaction["transactionType"];
}

export interface CategorizationResult {
  category: Category;
  /** 0..1 */
  confidence: number;
  /** Which rule/model produced this. */
  source: "user-rule" | "rule" | "ai" | "fallback";
}

/**
 * Pluggable categorizer. V1 ships a rule-based implementation; an
 * LLM-backed implementation can be added by implementing this interface and
 * composing it behind the rule categorizer (rules first, AI for "Other").
 */
export interface Categorizer {
  categorize(input: CategorizationInput): Promise<CategorizationResult> | CategorizationResult;
  categorizeMany?(inputs: CategorizationInput[]): Promise<CategorizationResult[]>;
}
