"use client";

import Link from "next/link";
import { money } from "@/lib/format";

export interface HBarRow {
  label: string;
  /** Optional leading visual (avatar / icon). */
  lead?: React.ReactNode;
  value: number;
  color?: string;
  sublabel?: string;
  href?: string;
}

/**
 * A ranked list with proportional bars. For "top N by amount" lists this
 * reads better than an axis chart: the label, value and bar sit on one line.
 */
export function HorizontalBars({ rows, max }: { rows: HBarRow[]; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                {r.lead ?? (r.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />)}
                <span className="truncate">{r.label}</span>
                {r.sublabel && <span className="shrink-0 text-[12px] font-normal text-ink-muted">{r.sublabel}</span>}
              </span>
              <span className="tabular shrink-0 text-ink">{money(r.value)}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (Math.abs(r.value) / top) * 100)}%`, background: r.color ?? "var(--ink)" }}
              />
            </div>
          </>
        );
        return (
          <li key={r.label}>
            {r.href ? (
              <Link href={r.href} className="block rounded-md hover:opacity-80">{inner}</Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
