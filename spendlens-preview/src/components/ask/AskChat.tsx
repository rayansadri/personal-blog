"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ChatEvent } from "@/services/chat/engine";
import type { CardSpec, EvidenceItem } from "@/services/chat/tools";
import type { ChatMessage } from "@/lib/db/chat";
import { clsx } from "@/lib/clsx";
import { formatDate } from "@/lib/dates";
import { ChatCard } from "./Cards";
import { DEMO_TURNS } from "@/lib/demo/scenarios";
import { playDemoTurn, resolveDemoTurn } from "@/lib/demo/player";
import { answerPreviewQuestion } from '../../../preview/chat';

const SUGGESTIONS = [
  "Why did my spending change this month?",
  "What habit is costing me the most?",
  "What should I actually pay attention to?",
  "How much would I save if I spent like last year?",
  "What recurring costs are growing?",
  "How has my lifestyle changed?",
];

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards: CardSpec[];
  evidence: EvidenceItem[];
  followups: string[];
  status?: string;
  streaming?: boolean;
  source?: "ai" | "deterministic" | null;
  note?: string;
}

export function AskChat({ hasData, aiAvailable }: { hasData: boolean; aiAvailable: boolean }) {
  const params = useSearchParams();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const demo = params.get("demo") || "portfolio";

  /** Portfolio demo: replay a scripted turn through the same UI path as live events. No network, no real data. */
  const playDemo = useCallback(async (question: string, patch: (fn: (turn: Turn) => Turn) => void) => {
    const turn = await answerPreviewQuestion(question);
    await playDemoTurn(turn, (e) => {
      if (e.type === "status") patch((x) => ({ ...x, status: e.text || undefined }));
      else if (e.type === "text") patch((x) => ({ ...x, text: e.text }));
      else if (e.type === "card") patch((x) => ({ ...x, cards: [...x.cards, e.card] }));
      else patch((x) => ({ ...x, evidence: e.evidence, followups: e.followups, streaming: false, source: "deterministic" }));
    });
  }, [demo]);

  const send = useCallback(
    async (q: string, context?: string | null) => {
      const question = q.trim();
      if (!question || busy) return;
      setInput("");
      setBusy(true);
      const aid = `a-${Date.now()}`;
      setTurns((t) => [...t, { id: `u-${Date.now()}`, role: "user", text: question, cards: [], evidence: [], followups: [] }, { id: aid, role: "assistant", text: "", cards: [], evidence: [], followups: [], status: "Thinking…", streaming: true }]);
      const patch = (fn: (turn: Turn) => Turn) => setTurns((t) => t.map((x) => (x.id === aid ? fn(x) : x)));
      if (demo) {
        try { await playDemo(question, patch); }
        catch { patch(x=>({...x,text:"I couldn't resolve that question. Try asking about a merchant, a month, or your spending habits.",status:undefined,streaming:false})); }
        finally { setBusy(false); }
        return;
      }
      try {
        const res = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ message: question, conversationId, context: context ?? null }) });
        if (!res.ok || !res.body) throw new Error("request failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const ev = JSON.parse(line.slice(5)) as ChatEvent | { type: "conversation"; id: string };
            if (ev.type === "conversation") setConversationId(ev.id);
            else if (ev.type === "status") patch((x) => ({ ...x, status: ev.text || undefined }));
            else if (ev.type === "delta") patch((x) => ({ ...x, text: x.text + ev.text, status: undefined }));
            else if (ev.type === "replace") patch((x) => ({ ...x, text: ev.text, note: ev.reason }));
            else if (ev.type === "card") patch((x) => ({ ...x, cards: [...x.cards, ev.card] }));
            else if (ev.type === "evidence") patch((x) => ({ ...x, evidence: [...x.evidence, ev.item] }));
            else if (ev.type === "followups") patch((x) => ({ ...x, followups: ev.questions }));
            else if (ev.type === "notice") patch((x) => ({ ...x, note: ev.text }));
            else if (ev.type === "done") patch((x) => ({ ...x, streaming: false, status: undefined, source: ev.source }));
            else if (ev.type === "error") patch((x) => ({ ...x, text: x.text || ev.message, streaming: false, status: undefined }));
          }
        }
      } catch {
        patch((x) => ({ ...x, text: x.text || "Something went wrong answering that. Try again.", streaming: false, status: undefined }));
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, demo, playDemo],
  );

  // Deep links: /ask?q=…&context=…  and demo autoplay: /ask?demo=august
  useEffect(() => {
    const q = params.get("q") ?? (demo && DEMO_TURNS[demo] ? DEMO_TURNS[demo].question : null);
    if (q && !prefilled.current && (hasData || demo)) {
      prefilled.current = true;
      send(q, params.get("context"));
    }
  }, [params, send, hasData, demo]);

  const resumeConversation = async (id: string) => {
    const d = (await fetch(`/api/chat/conversations?id=${id}`).then((r) => r.json())) as { messages: ChatMessage[] };
    setConversationId(id);
    setTurns(d.messages.map((m) => ({ id: m.id, role: m.role, text: m.content, cards: m.cards, evidence: m.evidence, followups: m.followups, source: m.source })));
  };

  const newChat = () => {
    setConversationId(null);
    setTurns([]);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      {turns.length === 0 ? (
        <EmptyChat hasData={hasData || Boolean(demo)} aiAvailable={aiAvailable || Boolean(demo)} onPick={(q) => send(q)} onResume={resumeConversation} />
      ) : (
        <div className="flex items-center justify-between pb-3">
          <span className="text-[12px] text-ink-muted">Demo answers computed from fictional transactions.</span>
          <button onClick={newChat} className="text-[12.5px] font-medium text-accent hover:underline">New chat</button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {turns.map((t) =>
          t.role === "user" ? (
            <div key={t.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] leading-snug text-ink-inverse">{t.text}</div>
          ) : (
            <AssistantTurn key={t.id} turn={t} onFollowup={(q) => send(q)} />
          ),
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] mt-6 flex items-center gap-2 rounded-full bg-surface p-1.5 pl-4 shadow-[0_2px_16px_rgba(0,0,0,0.1)] ring-1 ring-line md:bottom-4"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about how you spend." className="h-10 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-muted sm:text-[15px]" disabled={!hasData && !demo} />
        <button type="submit" disabled={busy || !input.trim() || (!hasData && !demo)} className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-ink-inverse disabled:opacity-30" aria-label="Send">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </form>
    </div>
  );
}

function EmptyChat({ hasData, aiAvailable, onPick, onResume }: { hasData: boolean; aiAvailable: boolean; onPick: (q: string) => void; onResume: (id: string) => void }) {
  const [recent, setRecent] = useState<Array<{ id: string; title: string | null; updatedAt: string }>>([]);
  useEffect(() => {
    fetch("/api/chat/conversations").then((r) => r.json()).then((d: { conversations: Array<{ id: string; title: string | null; updatedAt: string }> }) => setRecent(d.conversations.slice(0, 5))).catch(() => {});
  }, []);
  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <p className="text-center text-[26px] font-semibold tracking-[-0.02em] sm:text-[32px]">Ask SpendLens anything</p>
      <p className="mx-auto mt-2 max-w-md text-center text-[13.5px] text-ink-secondary">
        {!hasData ? (
          <>
            There is no data yet. <Link href="/import" className="font-medium text-accent hover:underline">Import a statement</Link> first.
          </>
        ) : aiAvailable ? (
          "Explore the AI chat experience with fictional transactions. In this preview, answers and charts are computed locally; no live AI service is connected."
        ) : (
          "AI isn't configured yet, so answers come straight from the analytics engine. Add OPENAI_API_KEY to .env.local to enable conversation."
        )}
      </p>
      <div className="mx-auto mt-8 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => onPick(s)} disabled={!hasData} className="rounded-2xl px-4 py-3 text-left text-[15px] text-ink-secondary transition-colors hover:bg-surface hover:text-ink disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="mx-auto mt-8 w-full max-w-lg">
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">Recent</p>
          <ul className="flex flex-col gap-1">
            {recent.map((c) => (
              <li key={c.id}>
                <button onClick={() => onResume(c.id)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] hover:bg-surface">
                  <span className="truncate">{c.title ?? "Conversation"}</span>
                  <span className="shrink-0 text-[11.5px] text-ink-muted">{formatDate(c.updatedAt.slice(0, 10))}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AssistantTurn({ turn, onFollowup }: { turn: Turn; onFollowup: (q: string) => void }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const paragraphs = turn.text.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="max-w-[95%] self-start">
      {turn.status && (
        <p className="mb-2 flex items-center gap-2 text-[13px] text-ink-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          {turn.status}
        </p>
      )}
      {turn.text && (
        <div className="text-[15.5px] leading-relaxed tracking-tight">
          {paragraphs.map((p, i) => (
            <Paragraph key={i} text={p} />
          ))}
          {turn.streaming && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-ink align-middle" />}
        </div>
      )}
      {turn.note && <p className="mt-2 text-[12px] text-warning">{turn.note}</p>}
      {turn.cards.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {turn.cards.map((c, i) => (
            <div key={i} className={clsx((c.type === "comparison" || c.type === "transactions" || (c.type === "trend" && c.series.length > 8)) && "sm:col-span-2")}>
              <ChatCard card={c} />
            </div>
          ))}
        </div>
      )}
      {!turn.streaming && turn.evidence.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowEvidence((v) => !v)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
            <svg viewBox="0 0 24 24" className={clsx("h-3.5 w-3.5 transition-transform", showEvidence && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            Why am I seeing this?
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-normal text-ink-muted">{turn.source === "ai" ? "AI-written · numbers verified" : "computed directly"}</span>
          </button>
          {showEvidence && (
            <ul className="mt-2 flex flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-[12.5px]">
              {turn.evidence.map((e, i) => (
                <li key={i}>
                  <p className="font-medium">{e.label}{e.range ? <span className="font-normal text-ink-muted"> · {e.range.label} ({e.range.start} → {e.range.end})</span> : null}</p>
                  {e.values.length > 0 && (
                    <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {e.values.map((v, j) => (
                        <li key={j} className="flex justify-between gap-3 rounded-lg bg-surface px-2.5 py-1.5">
                          <span className="truncate text-ink-secondary">{v.metric.replace(/_/g, " ")}</span>
                          <span className="tabular shrink-0 font-medium">{typeof v.value === "number" ? (Math.abs(v.value) >= 100 ? `$${Math.round(v.value).toLocaleString("en-US")}` : Math.round(v.value * 100) / 100) : v.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!turn.streaming && turn.followups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {turn.followups.map((q) => (
            <button key={q} onClick={() => onFollowup(q)} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] hover:bg-surface-2">{q}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Minimal markdown: paragraphs, "- " bullets, **bold**. */
function Paragraph({ text }: { text: string }) {
  const lines = text.split("\n");
  const isList = lines.every((l) => /^\s*[-•*]\s+/.test(l));
  const render = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>));
  if (isList) {
    return (
      <ul className="my-2 flex flex-col gap-1 pl-4">
        {lines.map((l, i) => (
          <li key={i} className="list-disc">{render(l.replace(/^\s*[-•*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }
  return <p className="my-2 first:mt-0 last:mb-0">{lines.map((l, i) => <span key={i}>{render(l)}{i < lines.length - 1 && <br />}</span>)}</p>;
}
