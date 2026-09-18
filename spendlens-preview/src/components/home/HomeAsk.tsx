"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROMPTS = ["Why did I spend less this month?", "What should I actually pay attention to?", "What habit is costing me the most?"];

/** The prominent Ask entry on Home; submits into /ask with the question prefilled. */
export function HomeAsk({ prompts = PROMPTS }: { prompts?: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = (question: string) => {
    if (!question.trim()) return;
    router.push(`/ask?q=${encodeURIComponent(question.trim())}`);
  };
  return (
    <div className="mb-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="flex items-center gap-2 rounded-full bg-surface p-2 pl-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] ring-1 ring-line"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about how you spend..." className="h-11 flex-1 bg-transparent text-[17px] outline-none placeholder:text-ink-muted" />
        <button type="submit" disabled={!q.trim()} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-ink-inverse disabled:opacity-30" aria-label="Ask">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button key={p} onClick={() => go(p)} className="rounded-full bg-surface px-3.5 py-2 text-[13.5px] text-ink-secondary shadow-[var(--shadow-card)] transition-colors hover:text-ink">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
