import type { Category } from "../types";
import { RuleCategorizer } from "./ruleCategorizer";
import type { Categorizer } from "./types";

export type { Categorizer, CategorizationInput, CategorizationResult } from "./types";
export { RuleCategorizer } from "./ruleCategorizer";

/**
 * Factory for the active categorizer. V2 will compose an AI categorizer here
 * (e.g. rules first, then an LLM for anything that fell through to "Other").
 */
export function createCategorizer(userRules?: Map<string, Category>): Categorizer {
  return new RuleCategorizer(userRules);
}
