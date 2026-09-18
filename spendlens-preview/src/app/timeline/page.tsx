import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EvidenceDrawer } from "@/components/behavior/EvidenceDrawer";
import { SparkSeries } from "@/components/behavior/SparkSeries";
import { monthLabel } from "@/lib/dates";
import { loadBehaviorBundle } from "@/lib/server/behavior";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timeline" };

const KIND_LABEL: Record<string, string> = { start: "Started", persistence: "Settled", reversal: "Reversed", acceleration: "Accelerating", regime_shift: "New baseline" };
const KIND_TONE: Record<string, "accent" | "neutral" | "positive" | "negative" | "warning"> = { start: "accent", persistence: "neutral", reversal: "positive", acceleration: "negative", regime_shift: "warning" };

export default async function TimelinePage() {
  const bundle = await loadBehaviorBundle();
  if (!bundle) return <EmptyState />;
  const { report, interpretation } = bundle;
  const narrativeByKey = new Map(interpretation.interpretation.timelineNarrative.map((t) => [`${t.date}|${t.title}`, t]));
  const events = report.timeline.events;
  const byYear = new Map<string, typeof events>();
  for (const e of events) byYear.set(e.date.slice(0, 4), [...(byYear.get(e.date.slice(0, 4)) ?? []), e]);

  return (
    <div>
      <PageHeader title="Money timeline" description="When your behavior changed, dated from the data. Each event shows the metric before and after." />
      {!events.length && (
        <Card><p className="text-[13.5px] text-ink-muted">No dated behavior changes yet. These need several months on each side of a change; keep importing.</p></Card>
      )}
      {[...byYear.entries()].map(([year, evs]) => (
        <section key={year} className="mb-6">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{year}</h2>
          <ol className="relative ml-3 border-l border-line pl-6">
            {evs.map((e) => {
              const n = narrativeByKey.get(`${e.date}|${e.title}`);
              return (
                <li key={e.id} className="relative mb-4 last:mb-0">
                  <span className={clsx("absolute -left-[31px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-bg", e.kind === "regime_shift" ? "bg-warning" : e.kind === "acceleration" ? "bg-negative" : e.kind === "reversal" ? "bg-positive" : e.kind === "start" ? "bg-accent" : "bg-ink-faint")} />
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-ink-muted">{monthLabel(e.date)}</span>
                      <Badge tone={KIND_TONE[e.kind]}>{KIND_LABEL[e.kind]}</Badge>
                      <span className="ml-auto tabular text-[12px] text-ink-muted">{Math.round(e.confidence * 100)}% confidence</span>
                    </div>
                    <p className="mt-1.5 text-[16px] font-semibold tracking-tight">{e.title}</p>
                    {n && n.summary !== e.title && <p className="mt-1 text-[13px] text-ink-secondary">{n.summary}</p>}
                    {e.series && <SparkSeries series={e.series} highlight={e.date} />}
                    <EvidenceDrawer evidenceFeatureIds={e.evidenceFeatureIds} featureIndex={report.featureIndex} extra={e.evidence} label="Metric evidence" />
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
