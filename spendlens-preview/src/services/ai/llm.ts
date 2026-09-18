import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { InterpretationSchema, type Interpretation } from "./schema";
import type { InterpreterInput } from "./inputBuilder";

/** Anything that can turn structured features into an Interpretation. Swappable (Ollama later). */
export interface LLMInterpreter {
  readonly model: string;
  interpret(input: InterpreterInput): Promise<Interpretation>;
}

export const SYSTEM_PROMPT = `You interpret structured personal-finance behavior features for one person. You receive derived features, timeline events, hidden patterns and monthly aggregates. You never receive raw transactions.

Rules, in priority order:
1. Every claim must cite evidenceFeatureIds that appear in the input (feature ids, timeline event ids or hidden pattern ids). If you cannot cite evidence, leave the claim out.
2. Never state a number that is not present in the input. Do not compute new totals, percentages or trends; quote the ones given.
3. Use observable framing only. Say "late-night spending increased" or "delivery orders rose", never "you emotionally shop", never anything psychological or medical.
4. No generic budgeting advice. Describe what the data shows and what changed; the person decides what to do.
5. Archetypes must rest on two or more features, or one feature plus a timeline event or a persistentFeatures entry showing it recurs across months. Name them plainly (for example "Convenience-heavy spender", "Weekend spender", "Subscription-heavy", "Burst spender", "Stable baseline spender", "Experience-first spender").
6. Prefer fewer, well-evidenced statements over many weak ones. Plain, direct sentences.

Return only the JSON structure requested.`;

export class AnthropicInterpreter implements LLMInterpreter {
  private client: Anthropic;
  constructor(public readonly model = "claude-opus-5", client?: Anthropic) {
    this.client = client ?? new Anthropic();
  }

  async interpret(input: InterpreterInput): Promise<Interpretation> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Interpret this person's spending behavior. Input:\n\n${JSON.stringify(input)}`,
        },
      ],
      output_config: { format: zodOutputFormat(InterpretationSchema) },
    });
    if (response.stop_reason === "refusal") throw new Error("The model declined to interpret this input.");
    if (!response.parsed_output) throw new Error("The model returned output that did not match the schema.");
    return response.parsed_output;
  }
}

/** Credentials are resolved by the SDK (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile). */
export function hasAnthropicCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}
