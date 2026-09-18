import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ContributionList } from "@/components/dashboard/ContributionList";
import { ChangeBar } from "@/components/dashboard/ChangeBar";
import { AiSummary } from "@/components/dashboard/AiSummary";
import { summarizeMonth } from "@/services/chat/summary";
import { analyzeChanges } from "@/lib/analytics/changes";
import { availableMonths, latestMonth } from "@/lib/analytics/core";
import { money, percent, signedMoney } from "@/lib/format";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "What changed" };

export default async function ChangesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const txs = loadTransactions();
  const latest = latestMonth(txs);
  if (!latest) return <EmptyState />;
  const { month: requested } = await searchParams;
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : latest;
  const c = analyzeChanges(txs, month);
  const months = availableMonths(txs);
  const merchantCategory = new Map(txs.map((t) => [t.merchant, t.category] as const));
  const summary = await summarizeMonth(txs, loadRules(), month);

  return (
    <div>
      <PageHeader
        title="What changed?"
        description={`${c.monthLabel} compared with ${c.previousLabel}.`}
        action={<MonthPicker month={month} months={months} />}
      />

      {summary && c.previousTotal > 0 && <AiSummary summary={summary} showDrivers className="mb-4" />}
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Detailed breakdown</p>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_1fr_1fr] [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
          <Stat
            size="lg"
            label={`Change in spending`}
            value={signedMoney(c.delta)}
            delta={c.ratio != null ? { text: percent(c.ratio), tone: c.delta > 0 ? "up" : c.delta < 0 ? "down" : "neutral" } : undefined}
            hint={`vs ${c.previousLabel}`}
          />
          <Stat label={c.monthLabel} value={money(c.currentTotal)} />
          <Stat label={c.previousLabel} value={money(c.previousTotal)} />
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <ChangeBar rows={c.categories} delta={c.delta} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="By category" subtitle="Biggest movers vs last month" />
          <ContributionList
            kind="category"
            rows={c.categories.map((x) => ({ label: x.key, current: x.current, previous: x.previous, delta: x.delta, isNew: x.isNew, disappeared: x.disappeared, href: `/transactions?category=${encodeURIComponent(x.key)}&month=${month}` }))}
          />
        </Card>
        <Card>
          <CardHeader title="By merchant" subtitle="Who you paid more or less" />
          <ContributionList
            kind="merchant"
            rows={c.merchants.map((x) => ({ label: x.key, current: x.current, previous: x.previous, delta: x.delta, isNew: x.isNew, disappeared: x.disappeared, category: merchantCategory.get(x.key), href: `/transactions?merchant=${encodeURIComponent(x.key)}&month=${month}` }))}
          />
        </Card>
      </div>

      <p className="mt-6 text-[13px] text-ink-muted">
        Want to ask about a different period? Try <Link href="/ask" className="font-medium text-accent hover:underline">Ask SpendLens</Link>: “What changed over the last three months?”
      </p>
    </div>
  );
}
