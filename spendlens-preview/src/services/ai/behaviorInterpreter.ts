import type { BehaviorReport } from "@/lib/behavior";
import type { Transaction } from "@/lib/types";
import { allowedFeatureIds, allowedNumbers, buildInterpreterInput, hashInput, type InterpreterInput } from "./inputBuilder";
import { interpretDeterministically } from "./deterministic";
import { validateInterpretation, type Interpretation, type ValidationResult } from "./schema";
import type { LLMInterpreter } from "./llm";

export interface InterpretResult {
  interpretation: Interpretation;
  /** Where the words came from. The numbers always come from the deterministic engine. */
  source: "ai" | "deterministic";
  model: string | null;
  dropped: ValidationResult["dropped"];
  /** Exactly what was (or would be) sent to the model. Shown in the privacy drawer. */
  input: InterpreterInput;
  inputHash: string;
  cached: boolean;
  error?: string;
}

export interface InterpretOptions {
  llm?: LLMInterpreter | null;
  cache?: {
    get(hash: string): { output: string; model: string } | null;
    put(hash: string, output: string, model: string): void;
  };
}

/**
 * Feature report → strict, validated interpretation. AI is optional: when no
 * interpreter is supplied (AI off, no credentials) or its output fails
 * validation, the deterministic interpreter produces the same schema.
 */
export async function interpretBehavior(report: BehaviorReport, txs: Transaction[], opts: InterpretOptions = {}): Promise<InterpretResult> {
  const input = buildInterpreterInput(report, txs);
  const ids = allowedFeatureIds(report);
  const nums = allowedNumbers(input);
  const model = opts.llm?.model ?? "deterministic";
  const inputHash = hashInput(input, model);

  const fallback = (error?: string): InterpretResult => {
    const v = validateInterpretation(interpretDeterministically(input), ids, nums);
    return { interpretation: v.interpretation, source: "deterministic", model: null, dropped: v.dropped, input, inputHash, cached: false, error };
  };

  if (!opts.llm) return fallback();

  const cached = opts.cache?.get(inputHash);
  if (cached) {
    try {
      const v = validateInterpretation(JSON.parse(cached.output), ids, nums);
      return { interpretation: v.interpretation, source: "ai", model: cached.model, dropped: v.dropped, input, inputHash, cached: true };
    } catch {
      /* fall through to a fresh call */
    }
  }

  try {
    const raw = await opts.llm.interpret(input);
    const v = validateInterpretation(raw, ids, nums);
    if (!v.interpretation.profile.archetypes.length && !v.interpretation.patterns.length) {
      return fallback("The model's output had no claims left after validation.");
    }
    opts.cache?.put(inputHash, JSON.stringify(raw), opts.llm.model);
    return { interpretation: v.interpretation, source: "ai", model: opts.llm.model, dropped: v.dropped, input, inputHash, cached: false };
  } catch (e) {
    return fallback((e as Error).message);
  }
}
