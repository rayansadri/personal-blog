"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { monthLabel } from "@/lib/dates";

export function MonthPicker({ month, months }: { month: string; months: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const idx = months.indexOf(month);
  const go = (m: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("month", m);
    router.push(`${pathname}?${p.toString()}`);
  };
  const btn = "flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-secondary transition-colors hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="inline-flex items-center gap-1.5">
      <button className={btn} disabled={idx <= 0} onClick={() => go(months[idx - 1])} aria-label="Previous month">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span className="relative">
        <select
          value={month}
          onChange={(e) => go(e.target.value)}
          className="h-8 appearance-none rounded-full border border-line bg-surface px-3.5 pr-8 text-[13.5px] font-medium tracking-tight outline-none hover:bg-surface-2"
          aria-label="Select month"
        >
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-muted" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </span>
      <button className={btn} disabled={idx >= months.length - 1} onClick={() => go(months[idx + 1])} aria-label="Next month">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}
