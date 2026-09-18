"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CardProfile } from "@/lib/analytics/cards";
import type { Account } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { formatDate } from "@/lib/dates";
import { money, moneyExact, percent } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { Card, CardHeader } from "../ui/Card";
import { Stat } from "../ui/Stat";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { HorizontalBars } from "../charts/HorizontalBars";
import { CardForm } from "./CardForm";
import { CardTile, KIND_LABEL, displayName } from "./CardTile";
import { CategoryIcon } from "../ui/CategoryIcon";
import { MerchantAvatar } from "../ui/MerchantAvatar";

type Mode = { kind: "view" } | { kind: "add" } | { kind: "edit"; account: Account };

export function CardsView({ profiles, initialCard }: { profiles: CardProfile[]; initialCard: string | null }) {
  const router = useRouter();
  const names = useMemo(() => profiles.map((p) => p.account.name), [profiles]);
  const [chosen, setSelected] = useState<string>(() => (initialCard && names.includes(initialCard) ? initialCard : names[0] ?? ""));
  // Derive the effective selection so a removed card falls back to the first one without an effect.
  const selected = names.includes(chosen) ? chosen : names[0] ?? "";
  const [mode, setMode] = useState<Mode>(profiles.length ? { kind: "view" } : { kind: "add" });
  const [direction, setDirection] = useState<1 | -1>(1);
  const railRef = useRef<HTMLDivElement>(null);

  const index = Math.max(0, names.indexOf(selected));
  const profile = profiles[index];

  const select = useCallback(
    (name: string) => {
      const next = names.indexOf(name);
      setDirection(next >= index ? 1 : -1);
      setSelected(name);
      const url = new URL(window.location.href);
      url.searchParams.set("card", name);
      window.history.replaceState(null, "", url.toString());
    },
    [names, index],
  );

  // Arrow keys switch cards when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode.kind !== "view") return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "ArrowRight" && index < names.length - 1) select(names[index + 1]);
      if (e.key === "ArrowLeft" && index > 0) select(names[index - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, names, select, mode.kind]);

  // Scroll the selected tile into view in the rail.
  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-card="${cssEscape(selected)}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected]);

  const afterChange = (name?: string) => {
    setMode({ kind: "view" });
    if (name) setSelected(name);
    router.refresh();
  };

  const remove = async (account: Account, deleteTransactions: boolean) => {
    await fetch(`/api/accounts/${encodeURIComponent(account.name)}?transactions=${deleteTransactions}`, { method: "DELETE" });
    afterChange();
  };

  if (mode.kind === "add" || mode.kind === "edit") {
    return (
      <Card>
        <CardHeader title={mode.kind === "add" ? "Add a card" : `Edit ${displayName(mode.account)}`} subtitle="Details are stored locally alongside your transactions." />
        <CardForm
          initial={mode.kind === "edit" ? mode.account : undefined}
          onSaved={(a) => afterChange(a.name)}
          onCancel={() => (profiles.length ? setMode({ kind: "view" }) : router.push("/import"))}
          onDelete={mode.kind === "edit" ? (withTx) => remove(mode.account, withTx) : undefined}
        />
      </Card>
    );
  }

  if (!profile) return null;

  return (
    <div>
      {/* Card rail */}
      <div className="relative -mx-4 mb-6 sm:-mx-8 md:-mx-10">
        <div ref={railRef} className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 pt-1 sm:px-8 md:px-10">
          {profiles.map((p) => {
            const active = p.account.name === selected;
            return (
              <div key={p.account.name} data-card={p.account.name} className="snap-center">
                <CardTile
                  account={p.account}
                  size="md"
                  selected={active}
                  onClick={() => select(p.account.name)}
                  className={clsx("transition-all duration-300", active ? "scale-100 opacity-100 ring-2 ring-ink ring-offset-2 ring-offset-bg" : "scale-[0.96] opacity-60 hover:opacity-90")}
                />
                <p className={clsx("mt-2.5 text-center text-[12.5px] font-medium transition-colors", active ? "text-ink" : "text-ink-muted")}>
                  {money(p.monthSpending)} <span className="font-normal text-ink-muted">this month</span>
                </p>
              </div>
            );
          })}
          <button
            onClick={() => setMode({ kind: "add" })}
            className="flex h-[150px] w-[240px] shrink-0 snap-center flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-[20px] leading-none">+</span>
            <span className="text-[13px] font-medium">Add card</span>
          </button>
        </div>
      </div>

      {/* Switcher controls */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavButton dir="prev" disabled={index === 0} onClick={() => select(names[index - 1])} />
          <NavButton dir="next" disabled={index === names.length - 1} onClick={() => select(names[index + 1])} />
          <span className="ml-1 text-[13px] text-ink-muted">
            {index + 1} of {names.length} · <kbd className="rounded border border-line px-1 text-[11px]">←</kbd> <kbd className="rounded border border-line px-1 text-[11px]">→</kbd> to switch
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setMode({ kind: "edit", account: profile.account })}>Edit card</Button>
      </div>

      {/* Profile panel: keyed so it re-animates on switch */}
      <div key={profile.account.name} className={clsx("motion-safe:animate-[cardin_260ms_ease-out]", direction === 1 ? "[--from:16px]" : "[--from:-16px]")}>
        <Card className="mb-4">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-semibold tracking-tight">{displayName(profile.account)}</h2>
              <p className="mt-0.5 text-[13.5px] text-ink-secondary">
                {KIND_LABEL[profile.account.kind]}
                {profile.account.last4 && ` · •••• ${profile.account.last4}`}
                {profile.account.holder && ` · ${profile.account.holder}`}
              </p>
            </div>
            <Badge tone="accent">{profile.purpose}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
            <Stat
              size="lg"
              label={`Spent in ${profile.monthLabel.split(" ")[0]}`}
              value={money(profile.monthSpending)}
              delta={profile.changeRatio != null ? { text: percent(profile.changeRatio), tone: profile.changeRatio > 0 ? "up" : profile.changeRatio < 0 ? "down" : "neutral" } : undefined}
              hint={profile.changeRatio != null ? "vs last month" : undefined}
            />
            <Stat label="Share of all spending" value={`${Math.round(profile.shareOfSpending * 100)}%`} hint="this month" />
            <Stat label="Average month" value={money(profile.averageMonthly)} />
            <Stat label="Transactions" value={String(profile.transactionCount)} hint={profile.lastUsed ? `last used ${formatDate(profile.lastUsed)}` : undefined} />
          </div>
        </Card>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="What it's used for" subtitle={profile.transactionCount ? profile.monthLabel : "All time"} />
            {profile.byCategory.length ? (
              <ul className="flex flex-col gap-2.5">
                {profile.byCategory.slice(0, 6).map((c) => (
                  <li key={c.category} className="flex items-center gap-3 text-[13.5px]">
                    <CategoryIcon category={c.category} size={28} />
                    <span className="flex-1 font-medium">{c.category}</span>
                    <span className="tabular text-ink-muted">{c.count}×</span>
                    <span className="tabular w-12 text-right font-medium">{Math.round(c.share * 100)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-ink-muted">No spending yet. Import a statement for this card.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Top merchants" subtitle={profile.transactionCount ? profile.monthLabel : "All time"} />
            <HorizontalBars rows={profile.topMerchants.map((m) => ({ label: m.merchant, value: m.amount, color: CATEGORY_COLORS[m.category], lead: <MerchantAvatar name={m.merchant} category={m.category} size={26} />, sublabel: `${m.count}×`, href: `/transactions?merchant=${encodeURIComponent(m.merchant)}&account=${encodeURIComponent(profile.account.name)}` }))} />
          </Card>
          <Card>
            <CardHeader title="Billed to this card" subtitle={profile.recurring.length ? `${money(profile.recurringMonthly)} per month` : "No recurring payments"} />
            <ul className="flex flex-col gap-2 text-[13.5px]">
              {profile.recurring.slice(0, 7).map((r) => (
                <li key={r.merchant} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[r.category] }} />
                    <span className="truncate">{r.merchant}</span>
                  </span>
                  <span className="tabular shrink-0 text-ink-secondary">{money(r.monthlyCost)}/mo</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardHeader title="Last six months" />
            <MiniTrend data={profile.trend} highlight={profile.month} />
          </Card>
          <Card padded={false}>
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
              <CardHeader title="Recent activity" />
              <Link href={`/transactions?account=${encodeURIComponent(profile.account.name)}`} className="text-[13px] font-medium text-accent hover:underline">All transactions</Link>
            </div>
            <ul className="divide-y divide-line">
              {profile.recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-[13.5px] sm:px-6">
                  <span className="w-14 shrink-0 text-ink-muted">{formatDate(t.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.merchant}</span>
                    <span className="block truncate text-[12px] text-ink-muted">{t.transactionType === "expense" ? t.category : t.transactionType}</span>
                  </span>
                  <span className={clsx("tabular shrink-0 font-medium", t.amount > 0 && t.transactionType !== "payment" && t.transactionType !== "transfer" && "text-positive", (t.transactionType === "payment" || t.transactionType === "transfer") && "text-ink-muted")}>
                    {t.amount < 0 ? moneyExact(Math.abs(t.amount)) : `+${moneyExact(t.amount)}`}
                  </span>
                </li>
              ))}
              {!profile.recent.length && <li className="px-6 py-8 text-center text-[13.5px] text-ink-muted">Nothing here yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NavButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous card" : "Next card"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-secondary transition-colors hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
  );
}

function MiniTrend({ data, highlight }: { data: Array<{ month: string; label: string; total: number }>; highlight: string }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex h-36 items-end gap-2">
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="tabular text-[11px] text-ink-muted">{d.total ? money(d.total) : ""}</span>
          <div className="flex w-full flex-1 items-end">
            <div className={clsx("w-full rounded-t", d.month === highlight ? "bg-accent" : "bg-ink-faint")} style={{ height: `${Math.max(3, (d.total / max) * 100)}%` }} />
          </div>
          <span className="text-[11px] text-ink-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}
