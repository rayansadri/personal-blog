"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HabitsReport, MerchantHabit } from "@/lib/analytics/habits";
import { CATEGORY_COLORS } from "@/lib/categories";
import { formatDate, monthLabel } from "@/lib/dates";
import { money, moneyExact } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { Card, CardHeader } from "../ui/Card";
import { Stat } from "../ui/Stat";
import { Badge } from "../ui/Badge";
import { MerchantAvatar } from "../ui/MerchantAvatar";
import { CategoryIcon } from "../ui/CategoryIcon";
import { StackedMonths } from "./StackedMonths";

export function HabitsView({ report: r, range }: { report: HabitsReport; range: string }) {
  const router = useRouter();
  const spanLabel = r.monthsCount === 1 ? monthLabel(r.months[0]) : `${monthLabel(r.months[0], "short")} – ${monthLabel(r.months[r.months.length - 1], "short")}`;

  return (
    <div>
      {/* Range */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "Everything"],
            ["ytd", "This year"],
            ["12m", "Last 12 months"],
          ] as Array<[string, string]>
        ).map(([k, label]) => (
          <button key={k} onClick={() => router.push(k === "all" ? "/habits" : `/habits?range=${k}`)} className={clsx("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", range === k ? "bg-ink text-ink-inverse" : "bg-surface text-ink-secondary shadow-[var(--shadow-card)] hover:text-ink")}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-[12.5px] text-ink-muted">{spanLabel} · {formatDate(r.from)} → {formatDate(r.to, { year: "numeric" })}</span>
      </div>

      {/* Headline */}
      <Card className="mb-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-accent">The big picture</p>
        <p className="mt-1 text-[22px] font-semibold leading-snug tracking-tight sm:text-[26px]">{r.headline}</p>
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
          <Stat size="lg" label="Total spent" value={money(r.totalSpent)} hint={`${r.transactionCount} purchases over ${r.monthsCount} ${r.monthsCount === 1 ? "month" : "months"}`} />
          <Stat label="Average month" value={money(r.avgMonthly)} />
          <Stat label="Committed costs" value={`${Math.round(r.fixedShare * 100)}%`} hint="rent, bills, subscriptions" />
          <Stat label={r.savingsRate != null ? "Kept from income" : "Subscriptions so far"} value={r.savingsRate != null ? `${Math.round(r.savingsRate * 100)}%` : money(r.subscriptionsLifetime)} hint={r.savingsRate != null ? `${money(r.totalIncome)} in` : `${money(r.subscriptionsMonthly)}/mo now`} />
        </div>
      </Card>

      {/* Personality */}
      {r.personality.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.personality.map((p) => (
            <div key={p.id} className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-card)]">
              <span className={clsx("mb-2 inline-block h-2 w-2 rounded-full", p.tone === "up" ? "bg-negative" : p.tone === "down" ? "bg-positive" : "bg-accent")} />
              <p className="text-[17px] font-semibold tracking-tight">{p.title}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">{p.evidence}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stacked months */}
      <Card className="mb-4">
        <CardHeader title="Where it went, month by month" subtitle="Top categories stacked" />
        <StackedMonths data={r.stacked} keys={r.stackedKeys} />
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* The big ones */}
        <Card padded={false}>
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardHeader title="The big ones" subtitle="Where the money actually went, over the whole span" />
          </div>
          <ul className="divide-y divide-line">
            {r.merchants.slice(0, 12).map((m) => (
              <MerchantRow key={m.merchant} m={m} months={r.monthsCount} />
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Categories */}
          <Card>
            <CardHeader title="By category" subtitle="Share of everything, with trend" />
            <ul className="flex flex-col gap-3">
              {r.categories.slice(0, 8).map((c) => (
                <li key={c.category}>
                  <Link href={`/transactions?category=${encodeURIComponent(c.category)}`} className="flex items-center gap-3 text-[13.5px] hover:opacity-85">
                    <CategoryIcon category={c.category} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{c.category}</span>
                        <TrendBadge trend={c.trend} slope={c.slope} />
                      </span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, c.share * 100)}%`, background: CATEGORY_COLORS[c.category] }} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block font-semibold">{money(c.total)}</span>
                      <span className="tabular text-[11.5px] text-ink-muted">{Math.round(c.share * 100)}% · {money(c.perMonth)}/mo</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {/* Weekday profile */}
          <Card>
            <CardHeader title="Your week" subtitle="Average spend per day of the week" />
            <WeekProfile days={r.weekdays} />
            <p className="mt-3 text-[13px] text-ink-secondary">
              Weekend day <span className="font-medium text-ink">{money(r.weekendVsWeekdayPerDay.weekend)}</span> · weekday <span className="font-medium text-ink">{money(r.weekendVsWeekdayPerDay.weekday)}</span>
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Month rhythm" subtitle="When in the month you spend" />
          <Thirds t={r.monthThirds} />
        </Card>
        <Card>
          <CardHeader title="Big swings" subtitle={`Purchases over 3× your usual ${moneyExact(r.impulse.median)}`} />
          <Stat label="Count" value={String(r.impulse.count)} hint={`${money(r.impulse.total)} total`} />
          {r.impulse.largest && (
            <p className="mt-3 text-[13px] text-ink-secondary">
              Biggest: <span className="font-medium text-ink">{money(r.impulse.largest.amount)}</span> at {r.impulse.largest.merchant} on {formatDate(r.impulse.largest.date)}.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="Delivery streaks" subtitle="Days" />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Longest without" value={String(r.streaks.longestWithoutDelivery)} hint="days clean" />
            <Stat label="Longest run" value={String(r.streaks.longestDeliveryRun)} hint="days in a row" />
          </div>
          <p className="mt-3 text-[13px] text-ink-secondary">Currently {r.streaks.currentWithoutDelivery} days since the last order.</p>
        </Card>
      </div>
    </div>
  );
}

function MerchantRow({ m, months }: { m: MerchantHabit; months: number }) {
  const max = Math.max(...m.monthly.map((x) => x.total), 1);
  return (
    <li>
      <Link href={`/transactions?merchant=${encodeURIComponent(m.merchant)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 sm:px-6">
        <MerchantAvatar name={m.merchant} category={m.category} size={42} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] font-medium">
            <span className="truncate">{m.merchant}</span>
            <TrendBadge trend={m.trend} slope={m.slope} />
          </p>
          <p className="text-[12px] text-ink-muted">
            {m.count}× · {m.perWeek >= 0.9 ? `${m.perWeek.toFixed(1)}/week` : `${(m.perWeek * 4.33).toFixed(1)}/month`} · {m.when} · {money(m.avgPerVisit)} each
          </p>
          <p className="mt-0.5 text-[12px] text-accent">
            {money(m.yearlyRunRate)} a year at this pace{months >= 2 ? ` · halve it and keep ${money(m.halfSaves)}` : ""}
          </p>
        </div>
        {/* sparkline */}
        <div className="hidden h-8 items-end gap-0.5 sm:flex" aria-hidden>
          {m.monthly.map((x) => (
            <span key={x.month} className="w-1.5 rounded-sm" style={{ height: `${Math.max(8, (x.total / max) * 100)}%`, background: x.total ? CATEGORY_COLORS[m.category] : "var(--surface-3)" }} />
          ))}
        </div>
        <span className="shrink-0 text-right">
          <span className="tabular block text-[15px] font-semibold">{money(m.total)}</span>
          <span className="tabular text-[11.5px] text-ink-muted">{Math.round(m.share * 100)}%</span>
        </span>
      </Link>
    </li>
  );
}

function TrendBadge({ trend, slope }: { trend: MerchantHabit["trend"]; slope: number }) {
  if (trend === "steady") return null;
  return <Badge tone={trend === "rising" ? "negative" : "positive"}>{trend === "rising" ? "▲" : "▼"} {Math.abs(Math.round(slope * 100))}%/mo</Badge>;
}

function WeekProfile({ days }: { days: HabitsReport["weekdays"] }) {
  const max = Math.max(...days.map((d) => d.perDay), 1);
  return (
    <div className="flex h-28 items-end gap-2">
      {days.map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
          <span className="tabular text-[10.5px] text-ink-muted">{money(d.perDay)}</span>
          <div className="flex w-full flex-1 items-end">
            <div className={clsx("w-full rounded-t", d.day === "Sat" || d.day === "Sun" ? "bg-accent" : "bg-ink-faint")} style={{ height: `${Math.max(4, (d.perDay / max) * 100)}%` }} />
          </div>
          <span className="text-[11px] text-ink-muted">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function Thirds({ t }: { t: HabitsReport["monthThirds"] }) {
  const total = t.early + t.mid + t.late || 1;
  const parts = [
    ["1st–10th", t.early],
    ["11th–20th", t.mid],
    ["21st–end", t.late],
  ] as const;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {parts.map(([label, v], i) => (
          <div key={label} style={{ width: `${(v / total) * 100}%`, background: ["var(--ink)", "var(--accent)", "var(--chart-secondary)"][i] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
        {parts.map(([label, v], i) => (
          <li key={label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: ["var(--ink)", "var(--accent)", "var(--chart-secondary)"][i] }} />
            <span className="flex-1 text-ink-secondary">{label}</span>
            <span className="tabular font-medium">{Math.round((v / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
