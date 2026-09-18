import { EmptyState } from "@/components/ui/EmptyState";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { InsightList } from "@/components/dashboard/InsightList";
import { availableMonths, latestMonth } from "@/lib/analytics/core";
import { generateInsights } from "@/lib/analytics/insights";
import { monthLabel } from "@/lib/dates";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights" };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const txs = loadTransactions();
  const latest = latestMonth(txs);
  if (!latest) return <EmptyState />;
  const { month: requested } = await searchParams;
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : latest;
  const insights = generateInsights(txs, month, loadRules());

  return (
    <div>
      <PageHeader
        title="Insights"
        description={`What stands out in ${monthLabel(month)}, ranked by how much money is involved.`}
        action={<MonthPicker month={month} months={availableMonths(txs)} />}
      />
      <div className="max-w-3xl">
        <InsightList insights={insights} />
      </div>
      <p className="mt-8 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        Insights are generated deterministically from your transactions: month-over-month deltas, frequency counts, recurring
        payment detection and duplicate checks. No AI, no guessing. Click any insight to see the transactions behind it.
      </p>
    </div>
  );
}
