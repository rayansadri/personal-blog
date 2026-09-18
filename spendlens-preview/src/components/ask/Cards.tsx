"use client";

import Link from "next/link";
import type { CardSpec } from "@/services/chat/tools";
import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { money, moneyExact } from "@/lib/format";
import { formatDate, monthLabel } from "@/lib/dates";
import { clsx } from "@/lib/clsx";
import { CategoryIcon } from "../ui/CategoryIcon";
import { MerchantAvatar } from "../ui/MerchantAvatar";

/** Rich answer components rendered under a chat message. */
export function ChatCard({ card }: { card: CardSpec }) {
  switch (card.type) {
    case "metric":
      return <MetricCard card={card} />;
    case "comparison":
      return <ComparisonCard card={card} />;
    case "breakdown":
      return <BreakdownCard card={card} />;
    case "trend":
      return <TrendCard card={card} />;
    case "transactions":
      return <TransactionsCard card={card} />;
    default:
      return null;
  }
}

const isCategory = (s?: string): s is Category => Boolean(s && (CATEGORIES as readonly string[]).includes(s));
const fmtUnit = (v: number, unit?: string) => (unit === "pct" ? `${v.toFixed(0)}%` : unit === "x" ? `${v.toFixed(1)}×` : unit === "count" ? `${Math.round(v)}` : money(v));
const labelOf = (l: string) => (/^\d{4}-\d{2}$/.test(l) ? monthLabel(l, "short") : l);

function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      {title && <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">{title}</p>}
      {children}
    </div>
  );
}

function MetricCard({ card }: { card: Extract<CardSpec, { type: "metric" }> }) {
  const up = (card.delta?.value ?? 0) > 0;
  return (
    <Shell>
      <p className="text-[12.5px] text-ink-secondary">{card.label}</p>
      <p className="mt-0.5 text-[30px] font-semibold leading-none tracking-tight">{fmtUnit(card.value, card.unit)}</p>
      {card.delta && (
        <p className={clsx("mt-1.5 text-[12.5px] font-medium", up ? "text-negative" : "text-positive")}>
          {up ? "▲" : "▼"} {Math.abs(card.delta.value).toFixed(0)}% <span className="font-normal text-ink-muted">{card.delta.label}</span>
        </p>
      )}
    </Shell>
  );
}

function ComparisonCard({ card }: { card: Extract<CardSpec, { type: "comparison" }> }) {
  const max = Math.max(card.a.value, card.b.value, 1);
  const rowMax = Math.max(...card.rows.map((r) => Math.abs(r.delta)), 1);
  return (
    <Shell title={card.title}>
      <div className="grid grid-cols-2 gap-3">
        {[card.a, card.b].map((s, i) => (
          <div key={s.label}>
            <p className="truncate text-[12px] text-ink-secondary">{labelOf(s.label)}</p>
            <p className="tabular text-[20px] font-semibold tracking-tight">{money(s.value)}</p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-3"><div className={clsx("h-full rounded-full", i === 0 ? "bg-accent" : "bg-ink-faint")} style={{ width: `${(s.value / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      {card.rows.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {card.rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 py-1.5 text-[12.5px]">
              {isCategory(r.label) && <CategoryIcon category={r.label} size={20} />}
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="relative h-1.5 w-20 rounded-full bg-surface-3">
                <span className="absolute left-1/2 top-0 h-full w-px bg-line-strong" />
                <span className={clsx("absolute top-0 h-full rounded-full", r.delta >= 0 ? "bg-negative" : "bg-positive")} style={r.delta >= 0 ? { left: "50%", width: `${(Math.abs(r.delta) / rowMax) * 50}%` } : { right: "50%", width: `${(Math.abs(r.delta) / rowMax) * 50}%` }} />
              </span>
              <span className={clsx("tabular w-16 text-right font-medium", r.delta >= 0 ? "text-negative" : "text-positive")}>{r.delta >= 0 ? "+" : "−"}{money(Math.abs(r.delta))}</span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function BreakdownCard({ card }: { card: Extract<CardSpec, { type: "breakdown" }> }) {
  const max = Math.max(...card.rows.map((r) => Math.abs(r.value)), 1);
  return (
    <Shell title={card.title || undefined}>
      <ul className="flex flex-col gap-2">
        {card.rows.map((r) => (
          <li key={r.label}>
            <Link href={card.kind === "category" ? `/transactions?category=${encodeURIComponent(r.label)}` : `/transactions?merchant=${encodeURIComponent(r.label)}`} className="flex items-center gap-2.5 text-[13px] hover:opacity-85">
              {card.kind === "category" && isCategory(r.label) ? <CategoryIcon category={r.label} size={26} /> : <MerchantAvatar name={r.label} category={isCategory(r.category) ? r.category : undefined} size={26} />}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{r.label}{r.count ? <span className="ml-1 font-normal text-ink-muted">{r.count}×</span> : null}</span>
                  <span className="tabular shrink-0">{money(r.value)}{r.share != null ? <span className="ml-1 text-ink-muted">{Math.round(r.share * 100)}%</span> : null}</span>
                </span>
                <span className="mt-1 block h-1 w-full rounded-full bg-surface-3"><span className="block h-full rounded-full" style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%`, background: isCategory(r.category ?? r.label) ? CATEGORY_COLORS[(r.category ?? r.label) as Category] : "var(--ink)" }} /></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function TrendCard({ card }: { card: Extract<CardSpec, { type: "trend" }> }) {
  const vals = card.series.map((s) => s.value);
  const max = Math.max(...vals.map(Math.abs), 1);
  const hasNeg = vals.some((v) => v < 0);
  return (
    <Shell title={card.title || undefined}>
      <div className="flex h-24 items-end gap-1">
        {card.series.map((s) => {
          const h = (Math.abs(s.value) / max) * 100;
          const hl = card.highlight ? s.label === card.highlight || (card.highlight === "Sat" && (s.label === "Sat" || s.label === "Sun")) : false;
          return (
            <div key={s.label} className="flex h-full flex-1 flex-col items-center justify-end" title={`${labelOf(s.label)}: ${money(s.value)}`}>
              <div className={clsx("w-full rounded-t", hasNeg ? (s.value >= 0 ? "bg-negative" : "bg-positive") : hl ? "bg-accent" : "bg-ink-faint")} style={{ height: `${Math.max(3, h)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-muted">
        <span>{labelOf(card.series[0]?.label ?? "")}</span>
        {card.series.length > 2 && <span>{labelOf(card.series[Math.floor(card.series.length / 2)].label)}</span>}
        <span>{labelOf(card.series[card.series.length - 1]?.label ?? "")}</span>
      </div>
    </Shell>
  );
}

function TransactionsCard({ card }: { card: Extract<CardSpec, { type: "transactions" }> }) {
  return (
    <Shell title={card.title}>
      <ul className="divide-y divide-line">
        {card.rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2.5 py-2 text-[13px]">
            <MerchantAvatar name={r.merchant} category={isCategory(r.category) ? r.category : undefined} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.merchant}</span>
              <span className="block text-[11.5px] text-ink-muted">{formatDate(r.date, { year: "numeric" })} · {r.category}</span>
            </span>
            <span className="tabular font-semibold">{moneyExact(r.amount)}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
