import { NextResponse } from "next/server";
import { ask } from "@/lib/ask";
import { loadRules, loadTransactions } from "@/lib/server/data";
import { getSettings } from "@/lib/db/settings";
import { hasAnthropicCredentials } from "@/services/ai";
import { explainAnswer } from "@/services/ai/askExplainer";

export const runtime = "nodejs";

/** POST { question } -> Answer. Deterministic in V1; pluggable LLM planner later. */
export async function POST(req: Request) {
  const body = (await req.json()) as { question?: string };
  const question = (body.question ?? "").slice(0, 500);
  if (!question.trim()) return NextResponse.json({ error: "Ask a question" }, { status: 400 });
  const answer = await ask(question, loadTransactions(), undefined, loadRules());
  const settings = getSettings();
  if (settings.aiEnabled && hasAnthropicCredentials() && answer.plan.kind !== "help") {
    const explained = await explainAnswer(answer, settings.aiModel);
    return NextResponse.json({ ...answer, text: explained.text, explainedBy: explained.source });
  }
  return NextResponse.json({ ...answer, explainedBy: "deterministic" });
}
