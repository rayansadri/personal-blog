import { money } from "@/lib/format";

/** Stacked projection bar: spent · committed · typical variable, with last month as a marker. */
export function ForecastBar({ spent, committed, variable, lastMonth }: { spent: number; committed: number; variable: number; lastMonth: number }) {
  const total = spent + committed + variable;
  const max = Math.max(total, lastMonth, 1);
  const w = (n: number) => `${(n / max) * 100}%`;
  return (
    <div>
      <div className="relative h-3 w-full rounded-full bg-surface-3">
        <div className="absolute inset-y-0 left-0 flex overflow-hidden rounded-full" style={{ width: w(total) }}>
          {spent > 0 && <div style={{ width: `${(spent / total) * 100}%`, background: "var(--ink)" }} />}
          {committed > 0 && <div style={{ width: `${(committed / total) * 100}%`, background: "var(--accent)" }} />}
          {variable > 0 && <div style={{ width: `${(variable / total) * 100}%`, background: "var(--chart-secondary)" }} />}
        </div>
        {lastMonth > 0 && (
          <div className="absolute -top-1 h-5 w-0.5 rounded bg-ink-muted" style={{ left: w(lastMonth) }} title={`Last month ${money(lastMonth)}`} />
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
        {spent > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ink" />Spent</span>}
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" />Committed</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--chart-secondary)" }} />Day-to-day</span>
        {lastMonth > 0 && <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-ink-muted" />Last month</span>}
      </div>
    </div>
  );
}
