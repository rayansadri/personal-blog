import type { Category } from "../types";
import type { CategorizationInput, CategorizationResult, Categorizer } from "./types";
import { CATEGORY_RULES } from "./rules";

/**
 * Deterministic keyword categorizer. User-defined merchant rules take
 * precedence, then built-in patterns are tested against the normalized
 * merchant first (high confidence) and the raw description second.
 */
export class RuleCategorizer implements Categorizer {
  constructor(private readonly userRules: Map<string, Category> = new Map()) {}

  categorize(input: CategorizationInput): CategorizationResult {
    if (input.transactionType === "income") return { category: "Income", confidence: 1, source: "rule" };
    if (input.transactionType === "transfer" || input.transactionType === "payment") {
      return { category: "Transfer", confidence: 1, source: "rule" };
    }

    const userRule = this.userRules.get(input.merchant);
    if (userRule) return { category: userRule, confidence: 1, source: "user-rule" };

    for (const rule of CATEGORY_RULES) {
      if (rule.patterns.some((p) => p.test(input.merchant))) {
        return { category: rule.category, confidence: 0.9, source: "rule" };
      }
    }
    for (const rule of CATEGORY_RULES) {
      if (rule.patterns.some((p) => p.test(input.description))) {
        return { category: rule.category, confidence: 0.7, source: "rule" };
      }
    }
    return { category: "Other", confidence: 0.2, source: "fallback" };
  }
}
