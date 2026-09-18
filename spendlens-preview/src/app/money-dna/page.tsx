import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { AiControls } from "@/components/behavior/AiControls";
import { EvidenceDrawer } from "@/components/behavior/EvidenceDrawer";
import { Disclosure } from "@/components/home/Disclosure";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { NotificationIcon } from "@/components/notifications/NotificationIcon";
import { monthLabel } from "@/lib/dates";
import { buildHabits } from "@/lib/analytics/habits";
import { money } from "@/lib/format";
import { loadBehaviorBundle } from "@/lib/server/behavior";
import { loadRules, loadTransactions } from "@/lib/server/data";
import { clsx } from "@/lib/clsx";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money DNA" };

const ARCHETYPE_CATEGORY: Array<[RegExp, Category]> = [
  [/convenience|delivery/i, "Delivery"],
  [/experience|travel|dining/i, "Travel"],
  [/subscription/i, "Subscriptions"],
  [/shopping|burst|big-swing|swing/i, "Shopping"],
  [/weekend/i, "Entertainment"],
];

export default async function MoneyDnaPage() {
  const bundle = await loadBehaviorBundle();
  if (!bundle) return <EmptyState />;
  const { report, interpretation, ai } = bundle;
  const it = interpretation.interpretation;
  const idx = report.featureIndex;
  const months = report.timeline.snapshots.length;
  const stronger = report.features.filter((f) => f.direction === "up");
  const weaker = report.features.filter((f) => f.direction === "down");
  const habits = buildHabits(loadTransactions(), loadRules());

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] sm:text-[36px]">Your Money DNA</h1>
        <p className="mt-1 text-[14px] text-ink-secondary">{months} months of history, read start to finish.</p>
      </div>

      {/* Conclusion */}
      <p className="mb-8 text-[22px] font-semibold leading-snug tracking-tight sm:text-[26px]">{it.profile.summary || "Not enough evidence for a summary yet. Import more months."}</p>

      {/* A. Who you are with money */}
      <section className="mb-8">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Who you are with money</p>
        {it.profile.archetypes.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {it.profile.archetypes.slice(0, 4).map((a) => {
              const cat = ARCHETYPE_CATEGORY.find(([re]) => re.test(a.name))?.[1];
              return (
                <div key={a.name} className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-card)]">
                  <div className="mb-3 flex items-start justify-between">
                    {cat && cat !== "Other" ? <CategoryIcon category={cat} size={44} /> : <NotificationIcon icon={/stable/i.test(a.name) ? "compare" : /lifestyle|inflation/i.test(a.name) ? "trend-up" : /fewer/i.test(a.name) ? "receipt" : "star"} tone={/stable/i.test(a.name) ? "positive" : "accent"} size={44} />}
                    <span className="tabular text-[12px] text-ink-muted">{Math.round(a.confidence * 100)}%</span>
                  </div>
                  <p className="text-[17px] font-semibold tracking-tight">{a.name}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">{a.description}</p>
                  <EvidenceDrawer evidenceFeatureIds={a.evidenceFeatureIds} featureIndex={idx} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[13.5px] text-ink-muted">No archetype has enough corroborating evidence yet.</p>
        )}
      </section>

      {/* B. Strongest current patterns */}
      <section className="mb-8">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Strongest current patterns</p>
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {it.patterns.slice(0, 5).map((p) => (
              <li key={p.id} className="px-5 py-3.5 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={clsx("h-2 w-2 rounded-full", p.importance === "high" ? "bg-negative" : p.importance === "medium" ? "bg-warning" : "bg-ink-faint")} />
                  <p className="text-[15px] font-medium">{p.title}</p>
                  {p.trend !== "stable" && <Badge tone={p.trend === "weakening" ? "positive" : "negative"}>{p.trend}</Badge>}
                </div>
                <EvidenceDrawer evidenceFeatureIds={p.evidenceFeatureIds} featureIndex={idx} confidence={p.confidence} />
              </li>
            ))}
            {!it.patterns.length && <li className="px-6 py-6 text-[13.5px] text-ink-muted">Nothing stands out yet.</li>}
          </ul>
        </Card>
      </section>

      {/* C. How you changed */}
      <section className="mb-8">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">How you changed</p>
        <Card>
          {report.timeline.events.length ? (
            <ol className="flex flex-col gap-3">
              {report.timeline.events.slice(-8).map((e) => (
                <li key={e.id} className="flex gap-4">
                  <span className="w-20 shrink-0 pt-0.5 text-[12.5px] font-semibold text-ink-muted">{monthLabel(e.date, "short")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-medium">{e.title}</p>
                    <EvidenceDrawer evidenceFeatureIds={e.evidenceFeatureIds} featureIndex={idx} extra={e.evidence} label="Evidence" confidence={e.confidence} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13.5px] text-ink-muted">No dated changes yet. These need several months on each side of a change.</p>
          )}
          <Link href="/timeline" className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline">Full timeline →</Link>
        </Card>
      </section>

      {/* D. Getting stronger / weaker */}
      <section className="mb-8">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Getting stronger / weaker</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <p className="mb-2 text-[13px] font-semibold text-negative">Stronger</p>
            <ul className="flex flex-col gap-1.5 text-[13.5px]">
              {stronger.map((f) => <li key={f.id} className="rounded-xl bg-negative-soft px-3 py-2">{f.label}</li>)}
              {!stronger.length && <li className="text-ink-muted">Nothing is growing right now.</li>}
            </ul>
          </Card>
          <Card>
            <p className="mb-2 text-[13px] font-semibold text-positive">Weaker</p>
            <ul className="flex flex-col gap-1.5 text-[13.5px]">
              {weaker.map((f) => <li key={f.id} className="rounded-xl bg-positive-soft px-3 py-2">{f.label}</li>)}
              {!weaker.length && <li className="text-ink-muted">Nothing is shrinking right now.</li>}
            </ul>
          </Card>
        </div>
      </section>

      {/* Drill-downs, behind intent */}
      <Disclosure label="Show the detail: habits, hidden patterns, AI settings" openLabel="Hide detail" className="mb-8">
        <div className="flex flex-col gap-4">
          {habits && (
            <Card>
              <CardHeader title="Biggest habits" subtitle={`${money(habits.totalSpent)} over ${habits.monthsCount} months`} action={<Link href="/habits" className="text-[13px] font-medium text-accent hover:underline">All habits</Link>} />
              <ul className="divide-y divide-line">
                {habits.merchants.slice(0, 5).map((m) => (
                  <li key={m.merchant} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                    <span className="min-w-0 truncate font-medium">{m.merchant} <span className="font-normal text-ink-muted">{m.count}× · {m.when}</span></span>
                    <span className="tabular shrink-0">{money(m.yearlyRunRate)}<span className="text-ink-muted">/yr</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {report.patterns.length > 0 && (
            <Card>
              <CardHeader title="Hidden patterns" action={<Link href="/patterns" className="text-[13px] font-medium text-accent hover:underline">All patterns</Link>} />
              <ul className="flex flex-col gap-2">
                {report.patterns.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <p className="text-[14px] font-medium">{p.title}</p>
                    <p className="text-[12.5px] text-ink-secondary">{p.summary}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <AiControls interpretation={interpretation} ai={ai} />
        </div>
      </Disclosure>
    </div>
  );
}
