"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecurringPayment } from "@/lib/analytics/recurring";
import type { HeadsUp } from "@/lib/analytics/headsUp";
import { headsUpBody, headsUpTitle } from "@/lib/analytics/headsUp";
import { CATEGORIES, type Category, type SubscriptionRule } from "@/lib/types";
import { daysBetween, formatDate } from "@/lib/dates";
import { money, moneyExact } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { Card, CardHeader } from "../ui/Card";
import { Stat } from "../ui/Stat";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MerchantAvatar } from "../ui/MerchantAvatar";
import { CategoryIcon } from "../ui/CategoryIcon";

type Filter = "all" | "confirmed" | "cancel" | "review";

export function SubscriptionManager({ initial, headsUp, focus, today }: { initial: RecurringPayment[]; headsUp: HeadsUp[]; focus: string | null; today: string }) {
  const router = useRouter();
  const [subs, setSubs] = useState(initial);
  const [alerts] = useState(headsUp);
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const focusRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (focus) focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  const active = subs.filter((s) => s.status !== "ignored" && s.confidence >= 0.6);
  const review = subs.filter((s) => s.status === "detected" && s.confidence < 0.6);
  const monthly = active.reduce((a, s) => a + s.monthlyCost, 0);
  const toCancel = active.filter((s) => s.status === "cancel");

  const visible =
    filter === "confirmed" ? active.filter((s) => s.status === "confirmed") : filter === "cancel" ? toCancel : filter === "review" ? review : active;

  const save = async (merchant: string, patch: Partial<SubscriptionRule>) => {
    setBusy(merchant);
    const res = await fetch("/api/subscriptions", { method: "POST", body: JSON.stringify({ merchant, ...patch }) });
    const data = (await res.json()) as { rule?: SubscriptionRule; error?: string };
    if (data.rule) {
      const rule = data.rule;
      setSubs((prev) => prev.map((s) => (s.merchant === merchant ? { ...s, status: rule.status, reminderDays: rule.reminderDays, note: rule.note, confidence: rule.status === "ignored" ? s.confidence : Math.max(s.confidence, 0.97) } : s)));
    }
    setBusy(null);
    router.refresh();
  };
  const reset = async (merchant: string) => {
    setBusy(merchant);
    await fetch(`/api/subscriptions?merchant=${encodeURIComponent(merchant)}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
    // Re-fetch to get pure-detection values back.
    const data = (await fetch("/api/subscriptions").then((r) => r.json())) as { subscriptions: RecurringPayment[] };
    setSubs(data.subscriptions);
  };

  return (
    <div>
      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="mb-4 bg-warning-soft">
          <CardHeader title="Charging soon" subtitle="Inside your reminder window. Decide now, not after the charge." />
          <ul className="flex flex-col gap-2">
            {alerts.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-2xl bg-surface/80 px-3 py-2.5">
                <MerchantAvatar name={h.merchant} category={h.category} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{headsUpTitle(h)}</p>
                  <p className="truncate text-[12px] text-ink-muted">{headsUpBody(h)}</p>
                </div>
                {h.status !== "cancel" ? (
                  <Button size="sm" variant="secondary" onClick={() => save(h.merchant, { status: "cancel" })} disabled={busy === h.merchant}>Plan to cancel</Button>
                ) : (
                  <Badge tone="warning">Cancelling</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Hero */}
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
          <Stat size="lg" label="Per month" value={money(monthly)} hint={`${money(monthly * 12)} a year across ${active.length} subscriptions`} />
          <Stat label="Confirmed by you" value={String(active.filter((s) => s.status === "confirmed").length)} hint={`${active.filter((s) => s.status === "detected").length} still auto-detected`} />
          <Stat label="Planning to cancel" value={toCancel.length ? money(toCancel.reduce((a, s) => a + s.yearlyCost, 0)) : "—"} hint={toCancel.length ? `${toCancel.length} · saves this much a year` : "flag one below"} />
          <Stat label="Needs review" value={String(review.length)} hint="low confidence" />
        </div>
      </Card>

      {/* Filters + add */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", `All ${active.length}`],
            ["confirmed", "Confirmed"],
            ["cancel", `Cancelling ${toCancel.length || ""}`],
            ["review", `Review ${review.length || ""}`],
          ] as Array<[Filter, string]>
        ).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} className={clsx("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", filter === f ? "bg-ink text-ink-inverse" : "bg-surface text-ink-secondary shadow-[var(--shadow-card)] hover:text-ink")}>
            {label.trim()}
          </button>
        ))}
        <Button size="sm" className="ml-auto" onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "+ Add subscription"}</Button>
      </div>

      {adding && (
        <AddForm
          onSaved={async () => {
            setAdding(false);
            const data = (await fetch("/api/subscriptions").then((r) => r.json())) as { subscriptions: RecurringPayment[] };
            setSubs(data.subscriptions);
            router.refresh();
          }}
        />
      )}

      {/* List */}
      <Card padded={false}>
        <ul className="divide-y divide-line">
          {visible.map((s) => (
            <SubRow key={s.merchant} s={s} today={today} busy={busy === s.merchant} focused={focus === s.merchant} ref={focus === s.merchant ? focusRef : undefined} onSave={(patch) => save(s.merchant, patch)} onReset={() => reset(s.merchant)} />
          ))}
          {visible.length === 0 && <li className="px-6 py-10 text-center text-[13.5px] text-ink-muted">Nothing here.</li>}
        </ul>
      </Card>
      <p className="mt-4 text-[12.5px] text-ink-muted">
        Confirming teaches SpendLens this merchant is a real subscription even when the amount wobbles. Dismissing hides it from every total. Anything you add manually shows up in <Link href="/upcoming" className="font-medium text-accent hover:underline">Upcoming</Link> and in reminders.
      </p>
    </div>
  );
}


const SubRow = forwardRef<HTMLLIElement, { s: RecurringPayment; today: string; busy: boolean; focused: boolean; onSave: (patch: Partial<SubscriptionRule>) => void; onReset: () => void }>(function SubRow({ s, today, busy, focused, onSave, onReset }, ref) {
  const [open, setOpen] = useState(focused);
  const days = daysBetween(today, s.nextExpected);
  return (
    <li ref={ref} className={clsx("transition-colors", focused && "bg-accent-soft/40")}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <MerchantAvatar name={s.merchant} category={s.category} size={40} />
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] font-medium">
            <span className="truncate">{s.merchant}</span>
            {s.status === "confirmed" && <Badge tone="positive">Confirmed</Badge>}
            {s.status === "cancel" && <Badge tone="warning">Cancelling</Badge>}
            {s.status === "ignored" && <Badge>Dismissed</Badge>}
            {s.manual && <Badge tone="accent">Added by you</Badge>}
            {s.status === "detected" && s.confidence < 0.6 && <Badge>Maybe · {Math.round(s.confidence * 100)}%</Badge>}
          </p>
          <p className="text-[12px] text-ink-muted">
            <span className="capitalize">{s.cadence}</span> · next {formatDate(s.nextExpected)}{days >= 0 && days <= 30 ? ` (${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`})` : ""} · remind {s.reminderDays}d before
          </p>
        </button>
        <span className="shrink-0 text-right">
          <span className="tabular block text-[15px] font-semibold">{moneyExact(s.typicalAmount)}</span>
          <span className="tabular text-[11.5px] text-ink-muted">{money(s.yearlyCost)}/yr</span>
        </span>
        <button onClick={() => setOpen((v) => !v)} aria-label="Manage" className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2">
          <svg viewBox="0 0 24 24" className={clsx("h-4 w-4 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/60 px-4 py-3 sm:px-6">
          <span className="mr-1 text-[12.5px] font-medium text-ink-secondary">This is…</span>
          <Chip active={s.status === "confirmed"} onClick={() => onSave({ status: "confirmed" })} disabled={busy}>✓ A real subscription</Chip>
          <Chip active={s.status === "cancel"} tone="warning" onClick={() => onSave({ status: "cancel" })} disabled={busy}>Plan to cancel</Chip>
          <Chip active={s.status === "ignored"} onClick={() => onSave({ status: "ignored" })} disabled={busy}>✕ Not a subscription</Chip>
          <span className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-secondary">
            Remind me
            <select value={s.reminderDays} onChange={(e) => onSave({ reminderDays: Number(e.target.value) })} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px]" disabled={busy}>
              {[1, 2, 3, 5, 7, 14].map((d) => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"} before</option>)}
            </select>
          </span>
          {s.status !== "detected" && (
            <button onClick={onReset} className="text-[12.5px] text-ink-muted hover:text-ink" disabled={busy}>Reset</button>
          )}
          <Link href={`/transactions?merchant=${encodeURIComponent(s.merchant)}`} className="text-[12.5px] font-medium text-accent hover:underline">History</Link>
        </div>
      )}
    </li>
  );
});

function Chip({ children, active, onClick, disabled, tone }: { children: React.ReactNode; active: boolean; onClick: () => void; disabled?: boolean; tone?: "warning" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50",
        active ? (tone === "warning" ? "border-warning bg-warning text-white" : "border-ink bg-ink text-ink-inverse") : "border-line bg-surface hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function AddForm({ onSaved }: { onSaved: () => void }) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [nextDate, setNextDate] = useState("");
  const [category, setCategory] = useState<Category>("Subscriptions");
  const [reminderDays, setReminderDays] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] outline-none focus:border-ink";

  const submit = async () => {
    if (!merchant.trim() || !amount || !nextDate) return setError("Name, amount and next charge date are required.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      body: JSON.stringify({ merchant: merchant.trim(), status: "confirmed", amount: Number(amount), cadence, nextDate, category, reminderDays, manual: true }),
    });
    setBusy(false);
    if (!res.ok) return setError("Could not save.");
    onSaved();
  };

  return (
    <Card className="mb-3">
      <h3 className="text-[15px] font-semibold tracking-tight">Add a subscription SpendLens can&apos;t see yet</h3>
      <p className="mt-0.5 text-[13px] text-ink-muted">Annual renewals, things on a card you haven&apos;t imported, or a free trial that&apos;s about to start billing.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-ink-secondary">Name<input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Amazon Prime (annual)" className={input} /></label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-ink-secondary">Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="139.00" className={clsx(input, "tabular")} /></label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-ink-secondary">Next charge<input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={input} /></label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-ink-secondary">Cadence
          <select value={cadence} onChange={(e) => setCadence(e.target.value as typeof cadence)} className={input}>
            <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-ink-secondary">Category
          <span className="flex items-center gap-2">
            <CategoryIcon category={category} size={28} />
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={input}>
              {CATEGORIES.filter((c) => c !== "Income" && c !== "Transfer").map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-ink-secondary">Remind me
          <select value={reminderDays} onChange={(e) => setReminderDays(Number(e.target.value))} className={input}>
            {[1, 2, 3, 5, 7, 14].map((d) => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"} before</option>)}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-[13px] text-negative">{error}</p>}
      <div className="mt-4"><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Add subscription"}</Button></div>
    </Card>
  );
}
