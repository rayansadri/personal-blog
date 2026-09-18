import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EvidenceDrawer } from "@/components/behavior/EvidenceDrawer";
import { formatDate } from "@/lib/dates";
import { loadBehaviorBundle } from "@/lib/server/behavior";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hidden patterns" };

export default async function PatternsPage() {
  const bundle = await loadBehaviorBundle();
  if (!bundle) return <EmptyState />;
  const { report, interpretation } = bundle;
  const explained = new Map(interpretation.interpretation.notableChanges.map((c) => [c.title, c]));

  return (
    <div>
      <PageHeader title="Hidden patterns" description="Relationships between two or more measures that a single chart would not show. Detected deterministically; explained with evidence." />
      {!report.patterns.length && (
        <Card><p className="text-[13.5px] text-ink-muted">No multi-variable patterns detected yet. These compare the recent half of your history with the earlier half, so they sharpen with more months.</p></Card>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {report.patterns.map((p) => {
          const ex = explained.get(p.title);
          return (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={p.importance === "high" ? "negative" : p.importance === "medium" ? "warning" : "neutral"}>{p.importance} importance</Badge>
                <span className="text-[12px] text-ink-muted">{formatDate(p.period.start, { year: "numeric" })} → {formatDate(p.period.end, { year: "numeric" })}</span>
                <span className="ml-auto tabular text-[12px] text-ink-muted">{Math.round(p.confidence * 100)}% confidence</span>
              </div>
              <p className="mt-2 text-[18px] font-semibold tracking-tight">{p.title}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">{ex?.summary ?? p.summary}</p>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {p.evidence.slice(0, 4).map((e, i) => (
                  <li key={i} className="rounded-xl bg-surface-2 px-3 py-2">
                    <p className="truncate text-[11px] text-ink-muted">{e.metric.replace(/_/g, " ")}</p>
                    <p className="tabular text-[15px] font-semibold">{typeof e.value === "number" ? (Math.abs(e.value) >= 100 ? `$${Math.round(e.value).toLocaleString("en-US")}` : e.value) : e.value}</p>
                  </li>
                ))}
              </ul>
              <EvidenceDrawer evidenceFeatureIds={p.evidenceFeatureIds} featureIndex={report.featureIndex} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
