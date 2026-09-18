"use client";

import { moneyExact } from "@/lib/format";

export const AXIS_TICK = { fill: "var(--chart-axis)", fontSize: 11.5, fontFamily: "inherit" };
export const GRID = { stroke: "var(--chart-grid)", strokeDasharray: "0" };
export const CURSOR = { fill: "var(--chart-cursor)" };
export const SURFACE = "var(--surface)";
export const INK = "var(--ink)";
export const INK_SOFT = "var(--chart-muted-bar)";
export const ACCENT = "#2a78d6";

export function compactAxis(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number, payload: TooltipEntry[]) => string;
}) {
  if (!active || !payload?.length) return null;
  const title = labelFormatter ? labelFormatter(label ?? "", payload) : String(label ?? "");
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-card)]">
      {title && <div className="mb-1 text-[12px] font-medium text-ink-secondary">{title}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-[13px]">
          <span className="flex items-center gap-1.5 text-ink-secondary">
            {payload.length > 1 && <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />}
            {payload.length > 1 ? p.name : ""}
          </span>
          <span className="tabular font-medium text-ink">{moneyExact(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}
