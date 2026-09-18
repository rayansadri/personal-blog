import Anthropic from "@anthropic-ai/sdk";
import type { Answer } from "@/lib/ask/types";
import { numbersSupported } from "./schema";

/**
 * EPIC 9, last step: the deterministic executor produced the structured
 * result; a model may rephrase it. It cannot add numbers. If the rephrasing
 * introduces any figure not already in the result, the original text is kept.
 */
export async function explainAnswer(answer: Answer, model: string, client = new Anthropic()): Promise<{ text: string; source: "ai" | "deterministic" }> {
  const allowed = new Set<number>();
  const collect = (s: string) => {
    for (const m of s.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
      const n = Number(m[0].replace(/,/g, ""));
      if (Number.isFinite(n)) allowed.add(Math.abs(n));
    }
  };
  collect(answer.text);
  for (const d of answer.details ?? []) collect(d);
  for (const r of answer.table?.rows ?? []) for (const c of r) collect(String(c));
  for (const d of answer.chart?.data ?? []) allowed.add(Math.abs(Math.round(d.value)));

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 400,
      system: "You rewrite a structured personal-finance answer into two or three plain, direct sentences. Use only the numbers present in the input; never compute or estimate new ones. No advice, no psychology, no filler. Return only the sentences.",
      messages: [{ role: "user", content: JSON.stringify({ headline: answer.text, details: answer.details ?? [], table: answer.table ?? null }) }],
    });
    if (res.stop_reason === "refusal") return { text: answer.text, source: "deterministic" };
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (!text || !numbersSupported(text, allowed)) return { text: answer.text, source: "deterministic" };
    return { text, source: "ai" };
  } catch {
    return { text: answer.text, source: "deterministic" };
  }
}
