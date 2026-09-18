import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { MerchantAvatar } from "@/components/ui/MerchantAvatar";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ForecastBar } from "@/components/upcoming/ForecastBar";
import { buildUpcoming, type UpcomingCharge } from "@/lib/analytics/forecast";
import { latestMonth } from "@/lib/analytics/core";
import { formatDate } from "@/lib/dates";
import { money, moneyExact, percent } from "@/lib/format";
import { loadRules, loadTransactions } from "@/lib/server/data";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upcoming" };

function dueLabel(days: number): string {
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function bucket(days: number): string {
  if (days < 0) return "Expected, not seen yet";
  if (days <= 7) return "This week";
  if (days <= 14) return "Next week";
  return "Later this month";
}

export default function UpcomingPage() {
  const txs = loadTransactions();
  if (!latestMonth(txs)) return <EmptyState />;
  const r = buildUpcoming(txs, 30, undefined, loadRules());
  const f = r.forecast;
  const upcoming = r.items.filter((i) => i.status === "upcoming");
  const groups = ["Expected, not seen yet", "This week", "Next week", "Later this month"];
  const byGroup = new Map<string, UpcomingCharge[]>();
  for (const i of r.items) byGroup.set(bucket(i.daysUntil), [...(byGroup.get(bucket(i.daysUntil)) ?? []), i]);
  const renewals = upcoming.filter((i) => i.isRenewal);
  const accuracyPct = r.accuracy.predicted ? Math.round((r.accuracy.landed / r.accuracy.predicted) * 100) : null;

  return (
    <div>
      <PageHeader
        title="Upcoming"
        description={`What SpendLens expects to hit your accounts, as of ${formatDate(r.asOf, { year: "numeric" })} (your latest import).`}
      />

      {/* Hero */}
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
          <Stat size="lg" label={`Next ${r.horizonDays} days`} value={money(r.total)} hint={`${upcoming.length} expected ${upcoming.length === 1 ? "charge" : "charges"}`} />
          <Stat label="This week" value={money(upcoming.filter((i) => i.daysUntil <= 7).reduce((a, i) => a + i.amount, 0))} hint={`${upcoming.filter((i) => i.daysUntil <= 7).length} charges`} />
          <Stat label="Renewals" value={renewals.length ? money(renewals.reduce((a, i) => a + i.amount, 0)) : "—"} hint={renewals.length ? `${renewals.length} yearly or quarterly` : "none due"} />
          <Stat
            label="Prediction accuracy"
            value={accuracyPct != null ? `${accuracyPct}%` : "—"}
            hint={r.accuracy.predicted ? `${r.accuracy.landed} of ${r.accuracy.predicted} landed` : "check back next month"}
          />
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Timeline */}
        <Card padded={false}>
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardHeader title="Timeline" subtitle="Tap a charge to see its history" action={<Link href="/recurring" className="text-[13px] font-medium text-accent hover:underline">Manage</Link>} />
          </div>
          {groups.map((g) => {
            const rows = byGroup.get(g);
            if (!rows?.length) return null;
            return (
              <section key={g}>
                <h4 className="px-5 pb-1.5 pt-3 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted sm:px-6">{g}</h4>
                <ul className="divide-y divide-line border-t border-line">
                  {rows.map((i) => (
                    <li key={i.id}>
                      <Link href={`/transactions?merchant=${encodeURIComponent(i.merchant)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 sm:px-6">
                        <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-surface-2 py-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{formatDate(i.expected, { month: "short" }).split(" ")[0]}</span>
                          <span className="text-[17px] font-semibold leading-none tracking-tight">{Number(i.expected.slice(8, 10))}</span>
                        </div>
                        <MerchantAvatar name={i.merchant} category={i.category} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-[14.5px] font-medium">
                            <span className="truncate">{i.merchant}</span>
                            {i.isRenewal && <Badge tone="accent">{i.cadence} renewal</Badge>}
                            {i.status === "overdue" && <Badge tone="warning">Not seen yet</Badge>}
                          </p>
                          <p className="text-[12px] text-ink-muted">
                            {dueLabel(i.daysUntil)} · {i.account} · {Math.round(i.confidence * 100)}% sure
                          </p>
                        </div>
                        <span className={clsx("tabular shrink-0 text-[15px] font-semibold", i.status === "overdue" && "text-ink-muted")}>{moneyExact(i.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {r.items.length === 0 && <p className="px-6 py-10 text-center text-[13.5px] text-ink-muted">Nothing predicted yet. Two or more months of statements let SpendLens learn your cycle.</p>}
        </Card>

        <div className="flex flex-col gap-4">
          {/* Month forecast */}
          <Card>
            <CardHeader title={f.isNextMonth ? `${f.label} outlook` : `${f.label} forecast`} subtitle={f.isNextMonth ? "Based on your commitments and typical spending" : `Day ${f.daysElapsed} of ${f.daysInMonth}`} />
            <div className="flex items-baseline gap-2">
              <span className="text-[34px] font-semibold leading-none tracking-tight">{money(f.projected)}</span>
              {f.lastMonth > 0 && (
                <span className={clsx("text-[13px] font-medium", f.projected > f.lastMonth ? "text-negative" : "text-positive")}>{percent((f.projected - f.lastMonth) / f.lastMonth)} vs last month</span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-ink-muted">Likely between {money(f.low)} and {money(f.high)}.</p>
            <div className="mt-4">
              <ForecastBar spent={f.spentSoFar} committed={f.committedRemaining} variable={Math.max(0, f.projected - f.spentSoFar - f.committedRemaining)} lastMonth={f.lastMonth} />
            </div>
            <ul className="mt-4 flex flex-col gap-1.5 text-[13px]">
              {!f.isNextMonth && <li className="flex justify-between"><span className="text-ink-secondary">Spent so far</span><span className="tabular font-medium">{money(f.spentSoFar)}</span></li>}
              <li className="flex justify-between"><span className="text-ink-secondary">{f.isNextMonth ? "Recurring commitments" : "Still to be charged"}</span><span className="tabular font-medium">{money(f.committedRemaining)}</span></li>
              <li className="flex justify-between"><span className="text-ink-secondary">Typical day-to-day</span><span className="tabular font-medium">{money(f.variableDaily)}<span className="text-ink-muted">/day</span></span></li>
            </ul>
            <p className="mt-4 text-[12px] text-ink-muted">Come back after your next import to see how close this was.</p>
          </Card>

          {/* Scoreboard */}
          <Card>
            <CardHeader title="Did they land?" subtitle="Predictions from the last 30 days" />
            {r.landed.length ? (
              <ul className="flex flex-col gap-2.5">
                {r.landed.slice(0, 8).map((l) => (
                  <li key={`${l.merchant}-${l.expected}`} className="flex items-center gap-3 text-[13.5px]">
                    <CategoryIcon category={l.category} size={28} />
                    <span className="min-w-0 flex-1 truncate">{l.merchant}</span>
                    <span className="tabular text-ink-muted">{moneyExact(l.actualAmount ?? l.amount)}</span>
                    <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-[12px]", l.status === "landed" ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning")} title={l.status === "landed" ? `Paid ${formatDate(l.paidOn!)}` : `Expected ${formatDate(l.expected)}`}>
                      {l.status === "landed" ? "✓" : "?"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-ink-muted">No predictions have come due yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
