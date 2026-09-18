import type { CardSpec, EvidenceItem } from "@/services/chat/tools";
import { DEMO_FOLLOWUPS, DEMO_TURNS, type DemoTurn } from "./scenarios";

/** Events the demo player emits; the chat UI applies them exactly like live SSE events. */
export type DemoEvent =
  | { type: "status"; text: string }
  | { type: "text"; text: string }
  | { type: "card"; card: CardSpec }
  | { type: "finish"; evidence: EvidenceItem[]; followups: string[] };

/** Pick the scripted turn for a question: exact scenario key, matching question text, a mapped follow-up, or the page's default. */
export function resolveDemoTurn(question: string, fallbackKey: string | null): DemoTurn {
  const key =
    DEMO_TURNS[question] ? question : Object.keys(DEMO_TURNS).find((k) => DEMO_TURNS[k].question.toLowerCase() === question.toLowerCase()) ?? DEMO_FOLLOWUPS[question] ?? (fallbackKey && DEMO_TURNS[fallbackKey] ? fallbackKey : "august");
  return DEMO_TURNS[key];
}

/**
 * Replay a scripted turn with realistic pacing. `wait` is injectable so tests
 * can run it instantly. Emits statuses, then the answer word by word, then cards.
 */
export async function playDemoTurn(turn: DemoTurn, emit: (e: DemoEvent) => void, wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
  for (const s of turn.statuses) {
    emit({ type: "status", text: s });
    await wait(650 + Math.random() * 350);
  }
  emit({ type: "status", text: "" });
  const words = turn.answer.split(/(\s+)/);
  let acc = "";
  for (const w of words) {
    acc += w;
    emit({ type: "text", text: acc });
    if (w.trim()) await wait(18 + Math.random() * 22);
  }
  await wait(250);
  for (const card of turn.cards) {
    emit({ type: "card", card });
    await wait(220);
  }
  emit({ type: "finish", evidence: turn.evidence, followups: turn.followups });
}
