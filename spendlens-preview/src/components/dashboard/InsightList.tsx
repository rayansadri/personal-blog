import Link from "next/link";
import type { Insight, InsightVisual } from "@/lib/analytics/insights";
import { clsx } from "@/lib/clsx";
import { money } from "@/lib/format";
import { CategoryIcon } from "../ui/CategoryIcon";
import { MerchantAvatar } from "../ui/MerchantAvatar";
import { NotificationIcon } from "../notifications/NotificationIcon";

const KIND_ICON: Record<Insight["kind"], Parameters<typeof NotificationIcon>[0]["icon"]> = {
  "total-change": "compare",
  "vs-average": "compare",
  "category-change": "trend-up",
  "merchant-change": "trend-up",
  frequency: "fork",
  subscriptions: "repeat",
  weekend: "calendar",
  "bill-increase": "receipt",
  "double-charge": "alert",
  "new-merchant": "sparkle",
  "large-transaction": "star",
  refunds: "refund",
};

function Lead({ i, size }: { i: Insight; size: number }) {
  if (i.merchant) return <MerchantAvatar name={i.merchant} category={i.category} size={size} />;
  if (i.category) return <CategoryIcon category={i.category} size={size} />;
  const tone = i.kind === "double-charge" ? "warning" : i.tone === "up" ? "negative" : i.tone === "down" ? "positive" : "neutral";
  return <NotificationIcon icon={KIND_ICON[i.kind]} tone={tone} size={size} />;
}

export function InsightList({ insights, compact = false }: { insights: Insight[]; compact?: boolean }) {
  if (!insights.length) {
    return <p className="text-[13.5px] text-ink-muted">Nothing unusual this month. Import more months for richer comparisons.</p>;
  }
  return (
    <ul className={clsx("flex flex-col", compact ? "divide-y divide-line" : "gap-3")}>
      {insights.map((i) => {
        const href = i.merchant
          ? `/transactions?merchant=${encodeURIComponent(i.merchant)}`
          : i.category
            ? `/transactions?category=${encodeURIComponent(i.category)}`
            : i.kind === "subscriptions"
              ? "/recurring"
              : "/changes";
        const body = compact ? (
          <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Lead i={i} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium tracking-tight">{i.title}</p>
              {i.quip && <p className="truncate text-[12.5px] text-ink-muted">{i.quip}</p>}
            </div>
            <Delta i={i} />
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-start gap-3.5">
              <Lead i={i} size={44} />
              <div className="min-w-0">
                <p className="text-[16px] font-semibold leading-snug tracking-tight">{i.title}</p>
                {i.quip && <p className="mt-1 text-[13.5px] font-medium text-accent">{i.quip}</p>}
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{i.detail}</p>
              </div>
            </div>
            {i.visual && <Visual v={i.visual} tone={i.tone} />}
          </div>
        );
        return (
          <li key={i.id}>
            <Link href={href} className="block transition-opacity hover:opacity-85">
              {body}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Delta({ i }: { i: Insight }) {
  const v = i.visual;
  if (v?.type === "count") return <span className="tabular shrink-0 text-[15px] font-semibold">{v.value}×</span>;
  if (v?.type === "share") return <span className="tabular shrink-0 text-[15px] font-semibold">{Math.round(v.ratio * 100)}%</span>;
  if (v?.type === "compare") {
    const up = v.current > v.previous;
    return <span className={clsx("tabular shrink-0 text-[15px] font-semibold", up ? "text-negative" : "text-positive")}>{up ? "▲" : "▼"} {money(Math.abs(v.current - v.previous))}</span>;
  }
  return null;
}

/** Mini chart on the right of a full insight card. */
function Visual({ v, tone }: { v: InsightVisual; tone: Insight["tone"] }) {
  if (v.type === "count") {
    return (
      <div className="flex shrink-0 items-baseline gap-1.5 self-start rounded-2xl bg-surface-2 px-4 py-3 sm:self-center sm:flex-col sm:items-center sm:gap-0 sm:px-5">
        <span className="text-[30px] font-semibold leading-none tracking-tight">{v.value}</span>
        <span className="text-[12px] text-ink-muted">{v.label}</span>
      </div>
    );
  }
  if (v.type === "share") {
    const pct = Math.round(v.ratio * 100);
    const r = 22;
    const c = 2 * Math.PI * r;
    return (
      <div className="flex shrink-0 items-center gap-3 self-start sm:self-center sm:flex-col sm:gap-1">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
        </svg>
        <span className="text-[12px] text-ink-muted">
          <span className="tabular font-semibold text-ink">{pct}%</span> {v.label}
        </span>
      </div>
    );
  }
  const max = Math.max(v.previous, v.current, 1);
  const up = v.current > v.previous;
  const color = tone === "neutral" ? "var(--accent)" : up ? "var(--negative)" : "var(--positive)";
  return (
    <div className="flex shrink-0 items-end gap-3 self-start sm:self-center">
      <Bar value={v.previous} max={max} label={v.previousLabel} color="var(--chart-muted-bar)" />
      <Bar value={v.current} max={max} label={v.currentLabel} color={color} strong />
    </div>
  );
}

function Bar({ value, max, label, color, strong }: { value: number; max: number; label: string; color: string; strong?: boolean }) {
  return (
    <div className="flex w-14 flex-col items-center gap-1">
      <span className={clsx("tabular text-[11px]", strong ? "font-semibold text-ink" : "text-ink-muted")}>{money(value)}</span>
      <div className="flex h-14 w-full items-end">
        <div className="w-full rounded-t-md" style={{ height: `${Math.max(6, (value / max) * 100)}%`, background: color }} />
      </div>
      <span className="text-[11px] text-ink-muted">{label}</span>
    </div>
  );
}
