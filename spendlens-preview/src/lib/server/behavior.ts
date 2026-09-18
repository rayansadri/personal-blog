import { buildBehaviorReport, type BehaviorReport } from "@/lib/behavior";
import { getCachedInterpretation, getSettings, putCachedInterpretation } from "@/lib/db/settings";
import { AnthropicInterpreter, hasAnthropicCredentials, interpretBehavior, OpenAIInterpreter, type InterpretResult, type LLMInterpreter } from "@/services/ai";
import { DEFAULT_CHAT_MODEL, hasOpenAICredentials } from "@/services/chat/openai";
import { loadRules, loadTransactions } from "./data";

export interface BehaviorBundle {
  report: BehaviorReport;
  interpretation: InterpretResult;
  ai: { enabled: boolean; available: boolean; model: string };
}

/** Everything the Money DNA, Timeline and Patterns pages need, in one server call. */
export async function loadBehaviorBundle(): Promise<BehaviorBundle | null> {
  const txs = loadTransactions();
  const report = buildBehaviorReport(txs, loadRules());
  if (!report) return null;
  const settings = getSettings();
  const available = hasOpenAICredentials() || hasAnthropicCredentials();
  let llm: LLMInterpreter | null = null;
  if (settings.aiEnabled) {
    if (hasOpenAICredentials()) llm = new OpenAIInterpreter(DEFAULT_CHAT_MODEL);
    else if (hasAnthropicCredentials()) llm = new AnthropicInterpreter(settings.aiModel);
  }
  const interpretation = await interpretBehavior(report, txs, {
    llm,
    cache: { get: getCachedInterpretation, put: putCachedInterpretation },
  });
  return { report, interpretation, ai: { enabled: settings.aiEnabled, available, model: llm?.model ?? (hasOpenAICredentials() ? DEFAULT_CHAT_MODEL : settings.aiModel) } };
}
