import Link from "next/link";
import type { MonthSummary } from "@/services/chat/summary";
import { money } from "@/lib/format";
import { clsx } from "@/lib/clsx";

/** The single AI sentence-or-two near the top of Home and What Changed, with a link into chat. */
export function AiSummary({ summary, showDrivers = false, className }: { summary: MonthSummary; showDrivers?: boolean; className?: string }) {
  return (
    <section className={clsx("rounded-3xl bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6", className)}>
      <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-accent">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
        {summary.source === "ai" ? "AI summary" : "Summary"}
      </p>
      <p className="mt-2 text-[17px] font-medium leading-snug tracking-tight sm:text-[19px]">{summary.text}</p>
      {showDrivers && summary.drivers.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">3 things that mattered</p>
          <ol className="flex flex-col gap-1.5">
            {summary.drivers.map((d, i) => (
              <li key={d.label} className="flex items-center gap-3 text-[14.5px]">
                <span className="w-4 text-ink-muted">{i + 1}.</span>
                <span className="flex-1 truncate">
                  {d.label} <span className="text-ink-muted">{d.kind === "appeared" ? "appeared" : d.kind === "disappeared" ? "disappeared" : d.kind === "up" ? "rose" : "dropped"}</span>
                </span>
                <span className={clsx("tabular font-semibold", d.delta > 0 ? "text-negative" : "text-positive")}>{d.delta > 0 ? "+" : "−"}{money(Math.abs(d.delta))}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <Link href={`/ask?q=${encodeURIComponent(summary.askQuestion)}`} className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-accent hover:underline">
        Ask about this →
      </Link>
    </section>
  );
}
