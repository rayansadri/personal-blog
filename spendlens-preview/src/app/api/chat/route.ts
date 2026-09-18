import { NextResponse } from "next/server";
import { addMessage, createConversation, getConversation, listMessages, setLastResponseId } from "@/lib/db/chat";
import { loadRules, loadTransactions } from "@/lib/server/data";
import { runChatTurn, type ChatEvent } from "@/services/chat/engine";
import { DEFAULT_CHAT_MODEL, getOpenAI } from "@/services/chat/openai";
import type { CardSpec, EvidenceItem } from "@/services/chat/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { message, conversationId?, context? } → server-sent events.
 * The only entry point the browser uses for AI chat. The OpenAI key stays here.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { message?: string; conversationId?: string; context?: string | null };
  const message = (body.message ?? "").trim().slice(0, 2000);
  if (!message) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

  const conversation = (body.conversationId && getConversation(body.conversationId)) || createConversation(message.slice(0, 80));
  const previousQuestion = listMessages(conversation.id).filter((m) => m.role === "user").at(-1)?.content ?? null;
  addMessage({ conversationId: conversation.id, role: "user", content: message, cards: [], evidence: [], followups: [], source: null });

  const txs = loadTransactions();
  const rules = loadRules();
  const client = getOpenAI();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: ChatEvent | { type: "conversation"; id: string }) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      send({ type: "conversation", id: conversation.id });
      let text = "";
      const cards: CardSpec[] = [];
      const evidence: EvidenceItem[] = [];
      let followups: string[] = [];
      let source: "ai" | "deterministic" = "deterministic";
      try {
        for await (const ev of runChatTurn({ question: message, previousResponseId: conversation.lastResponseId, context: body.context ?? null, previousQuestion }, txs, rules, client, DEFAULT_CHAT_MODEL)) {
          if (ev.type === "delta") text += ev.text;
          if (ev.type === "replace") text = ev.text;
          if (ev.type === "card") cards.push(ev.card);
          if (ev.type === "evidence") evidence.push(ev.item);
          if (ev.type === "followups") followups = ev.questions;
          if (ev.type === "done") {
            source = ev.source;
            if (ev.responseId) setLastResponseId(conversation.id, ev.responseId);
          }
          send(ev);
        }
      } catch (e) {
        send({ type: "error", message: "Something went wrong answering that. Try again." });
        console.error("chat turn failed", e);
      }
      addMessage({ conversationId: conversation.id, role: "assistant", content: text, cards, evidence, followups, source });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
