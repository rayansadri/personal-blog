import OpenAI from "openai";
import { z } from "zod";
import { InterpretationSchema, type Interpretation } from "./schema";
import type { InterpreterInput } from "./inputBuilder";
import type { LLMInterpreter } from "./llm";
import { SYSTEM_PROMPT } from "./llm";

/** Money DNA interpretation through the OpenAI Responses API with a strict JSON schema. */
export class OpenAIInterpreter implements LLMInterpreter {
  private client: OpenAI;
  constructor(public readonly model: string, client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async interpret(input: InterpreterInput): Promise<Interpretation> {
    const res = await this.client.responses.create({
      model: this.model,
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content: `Interpret this person's spending behavior. Input:\n\n${JSON.stringify(input)}` }],
      text: { format: { type: "json_schema", name: "behavior_interpretation", schema: z.toJSONSchema(InterpretationSchema) as Record<string, unknown>, strict: false } },
      store: false,
    });
    const text = res.output_text.trim();
    if (!text) throw new Error("The model returned no output.");
    return InterpretationSchema.parse(JSON.parse(text));
  }
}
