import { monthLabel } from "@/lib/dates";

/** Tiny bar series with a highlighted month, for timeline events. */
export function SparkSeries({ series, highlight }: { series: Array<{ month: string; value: number }>; highlight: string }) {
  const max = Math.max(...series.map((s) => s.value), 1);
  return (
    <div className="mt-3">
      <div className="flex h-12 items-end gap-[3px]">
        {series.map((s) => (
          <span key={s.month} title={`${monthLabel(s.month, "short")}: ${Math.round(s.value)}`} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(4, (s.value / max) * 100)}%`, background: s.month === highlight ? "var(--accent)" : s.month > highlight ? "var(--chart-secondary)" : "var(--chart-muted-bar)" }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-muted">
        <span>{monthLabel(series[0].month, "short")}</span>
        <span>{monthLabel(series[series.length - 1].month, "short")}</span>
      </div>
    </div>
  );
}
