import type OpenAI from "openai";
import type { SubscriptionRule, Transaction } from "@/lib/types";
import { ask } from "@/lib/ask";
import { numbersSupported } from "@/services/ai/schema";
import { SYSTEM_INSTRUCTIONS } from "./prompt";
import { buildToolContext, numbersFrom, runTool, toolDefinitions, type CardSpec, type EvidenceItem, type ToolContext } from "./tools";
import { monthName } from "./ranges";

/**
 * The chat engine: question → model → tool calls → verified results → model →
 * streamed answer. Numbers in the final text are checked against every tool
 * result; an answer with unsupported numbers is rewritten once, then falls
 * back to the deterministic Ask engine.
 */

export type ChatEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "replace"; text: string; reason: string }
  | { type: "card"; card: CardSpec }
  | { type: "evidence"; item: EvidenceItem }
  | { type: "followups"; questions: string[] }
  | { type: "notice"; text: string }
  | { type: "done"; responseId: string | null; source: "ai" | "deterministic"; text: string }
  | { type: "error"; message: string };

export interface ChatTurnInput {
  question: string;
  previousResponseId: string | null;
  /** Optional context the UI prefilled, e.g. "about September 2026". */
  context?: string | null;
  /** The previous user question in this conversation, for follow-ups in fallback mode. */
  previousQuestion?: string | null;
}

/** The slice of the OpenAI client the engine needs; tests inject a fake. */
export interface ResponsesClient {
  responses: {
    // Loose on purpose: the real OpenAI client and the test fake both satisfy it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(params: any): Promise<unknown>;
  };
}

interface FunctionCall { call_id: string; name: string; arguments: string }

const MAX_ROUNDS = 6;

export async function* runChatTurn(input: ChatTurnInput, txs: Transaction[], rules: SubscriptionRule[], client: ResponsesClient | null, model: string): AsyncGenerator<ChatEvent> {
  const ctx = buildToolContext(txs, rules);
  if (!ctx) {
    yield { type: "delta", text: "I don't have any transactions yet. Import a statement and ask again." };
    yield { type: "done", responseId: null, source: "deterministic", text: "" };
    return;
  }

  if (!client) {
    yield* deterministicTurn(input, txs, rules, "AI chat is not configured on this machine (no OPENAI_API_KEY).");
    return;
  }

  const allowed = new Set<number>();
  const cardsEmitted: CardSpec[] = [];
  const evidence: EvidenceItem[] = [];
  const toolsUsed: string[] = [];
  let text = "";
  let responseId: string | null = null;

  const coverage = `Data covers ${monthName(ctx.firstMonth)} to ${monthName(ctx.latestMonth)} (${monthsBetween(ctx.firstMonth, ctx.latestMonth)} months). "This month" means ${monthName(ctx.latestMonth)}, the latest month with data.`;
  let inputItems: Array<Record<string, unknown>> = [{ role: "user", content: input.context ? `${input.context}\n\n${input.question}` : input.question }];
  let previous = input.previousResponseId;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const stream = (await client.responses.create({
        model,
        instructions: `${SYSTEM_INSTRUCTIONS}\n\n${coverage}`,
        input: inputItems,
        tools: toolDefinitions(),
        previous_response_id: previous ?? undefined,
        store: true,
        stream: true,
      })) as AsyncIterable<Record<string, unknown>>;

      const calls: FunctionCall[] = [];
      let roundText = "";
      for await (const ev of stream) {
        const t = ev.type as string;
        if (t === "response.output_text.delta") {
          const d = String(ev.delta ?? "");
          roundText += d;
          yield { type: "delta", text: d };
        } else if (t === "response.output_item.done") {
          const item = ev.item as Record<string, unknown>;
          if (item?.type === "function_call") calls.push({ call_id: String(item.call_id), name: String(item.name), arguments: String(item.arguments ?? "{}") });
        } else if (t === "response.completed") {
          const resp = ev.response as Record<string, unknown>;
          responseId = (resp?.id as string) ?? responseId;
        } else if (t === "response.failed" || t === "response.error") {
          throw new Error(String((ev.response as Record<string, Record<string, unknown>>)?.error?.message ?? ev.message ?? "The model request failed."));
        }
      }
      text += roundText;
      if (!calls.length) break;

      // Execute tools, stream friendly status + cards, feed results back.
      const outputs: Array<Record<string, unknown>> = [];
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          args = {};
        }
        const result = runTool(call.name, args, ctx);
        toolsUsed.push(call.name);
        yield { type: "status", text: result.status };
        numbersFrom(result.data, allowed);
        for (const card of result.cards) {
          if (!cardsEmitted.some((c) => JSON.stringify(c) === JSON.stringify(card))) {
            cardsEmitted.push(card);
            yield { type: "card", card };
          }
        }
        evidence.push(result.evidence);
        yield { type: "evidence", item: result.evidence };
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result.data) });
      }
      inputItems = outputs;
      previous = responseId;
    }
  } catch (e) {
    yield { type: "status", text: "" };
    yield* deterministicTurn(input, txs, rules, friendlyError(e));
    return;
  }

  // Verify every number the model wrote exists in tool output. One repair attempt, then fall back.
  if (text.trim() && toolsUsed.length && !numbersSupported(text, allowed)) {
    try {
      const repaired = (await client.responses.create({
        model,
        instructions: `${SYSTEM_INSTRUCTIONS}\n\nRewrite your previous answer so that every number in it appears verbatim (or rounded to whole dollars) in the tool results you received. Remove any figure you cannot source. Keep the same meaning and length.`,
        input: [{ role: "user", content: "Rewrite the previous answer using only sourced numbers." }],
        previous_response_id: responseId ?? undefined,
        store: true,
        stream: false,
      })) as Record<string, unknown>;
      const fixed = String((repaired as { output_text?: string }).output_text ?? "").trim();
      if (fixed && numbersSupported(fixed, allowed)) {
        text = fixed;
        responseId = (repaired.id as string) ?? responseId;
        yield { type: "replace", text, reason: "Rewritten so every number matches your data." };
      } else {
        yield { type: "replace", text: "", reason: "The model's answer contained figures I could not verify against your data, so here is the direct calculation instead." };
        yield* deterministicTurn(input, txs, rules, null);
        return;
      }
    } catch {
      yield { type: "replace", text: "", reason: "The model's answer contained figures I could not verify against your data, so here is the direct calculation instead." };
      yield* deterministicTurn(input, txs, rules, null);
      return;
    }
  }

  yield { type: "followups", questions: followupsFor(toolsUsed, input.question) };
  yield { type: "done", responseId, source: "ai", text };
}

/** Deterministic answer via the existing Ask engine, streamed in one piece. Follow-ups borrow the previous question's subject. */
async function* deterministicTurn(input: ChatTurnInput, txs: Transaction[], rules: SubscriptionRule[], note: string | null): AsyncGenerator<ChatEvent> {
  let a = await ask(input.question, txs, undefined, rules);
  if (a.plan.kind === "help" && input.previousQuestion) {
    const combined = await ask(`${input.previousQuestion} ${input.question}`, txs, undefined, rules);
    if (combined.plan.kind !== "help") a = combined;
  }
  const text = [a.text, ...(a.details ?? [])].join("\n");
  if (note) yield { type: "notice", text: note };
  yield { type: "delta", text };
  if (a.chart) yield { type: "card", card: { type: "trend", title: "", series: a.chart.data.map((d) => ({ label: d.label, value: d.value })) } };
  if (a.table) yield { type: "card", card: { type: "breakdown", title: a.table.columns[0], kind: "merchant", rows: a.table.rows.slice(0, 8).map((r) => ({ label: String(r[0]), value: Number(String(r[1]).replace(/[^0-9.-]/g, "")) || 0 })) } };
  yield { type: "evidence", item: { tool: "deterministic", label: `Computed directly (${a.plan.kind})`, range: null, values: [{ metric: "source", value: "SpendLens analytics engine" }] } };
  yield { type: "followups", questions: ["Where did most of my money go?", "What should I pay attention to?", "What changed compared with last month?"] };
  yield { type: "done", responseId: null, source: "deterministic", text };
}

export function friendlyError(e: unknown): string {
  const msg = (e as Error)?.message ?? "";
  if (/no credits|insufficient_quota|billing|exceeded your current quota/i.test(msg)) return "The OpenAI account has no credits remaining, so this is the direct calculation. Add credits at platform.openai.com to turn the AI back on.";
  if (/api key|authentication|401|invalid_api_key/i.test(msg)) return "OpenAI rejected the API key, so this is the direct calculation. Check OPENAI_API_KEY in .env.local.";
  if (/does not exist|not found|404|model_not_found/i.test(msg)) return "The configured AI model isn't available on this account, so this is the direct calculation. Change OPENAI_MODEL in .env.local.";
  if (/rate limit|429/i.test(msg)) return "OpenAI is rate-limiting requests right now, so this is the direct calculation.";
  return "The AI service didn't respond, so this is the direct calculation.";
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am) + 1;
}

/** Suggested next questions, chosen from the tools that were used. Never invented by the model. */
export function followupsFor(toolsUsed: string[], question: string): string[] {
  const used = new Set(toolsUsed);
  const out: string[] = [];
  const add = (q: string) => {
    if (out.length < 3 && !out.includes(q) && q.toLowerCase() !== question.toLowerCase()) out.push(q);
  };
  if (used.has("get_month_explanation") || used.has("get_top_spending_changes")) {
    add("How does that compare with my usual month?");
    add("Which merchants drove it?");
    add("Was it more purchases or bigger ones?");
  }
  if (used.has("get_spending_summary")) {
    add("What changed compared with the period before?");
    add("What were my biggest unusual purchases?");
  }
  if (used.has("get_behavior_features") || used.has("get_habits")) {
    add("When did that start?");
    add("If I went back to last year's level, how much would I save?");
  }
  if (used.has("get_behavior_timeline")) add("What's driving the most recent change?");
  if (used.has("get_recurring_expenses") || used.has("get_subscription_changes")) {
    add("Which subscriptions got more expensive?");
    add("What's charging me in the next 30 days?");
  }
  if (used.has("get_weekend_vs_weekday")) add("What do I buy on weekends?");
  if (used.has("get_income_vs_spend")) add("Is my savings rate improving?");
  if (used.has("get_hypothetical_reversion")) add("Which category would save the most?");
  if (used.has("get_spending_anomalies")) add("Were any of those recurring?");
  add("What should I actually pay attention to?");
  add("Where did most of my money go?");
  return out.slice(0, 3);
}

export type { ToolContext };
export { runTool };
export type { OpenAI };
