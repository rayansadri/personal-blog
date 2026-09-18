import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { HabitsView } from "@/components/habits/HabitsView";
import { buildHabits } from "@/lib/analytics/habits";
import { latestMonth } from "@/lib/analytics/core";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Habits" };

export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const txs = loadTransactions();
  if (!latestMonth(txs)) return <EmptyState />;
  const { range } = await searchParams;
  const year = new Date().getFullYear();
  const window = range === "ytd" ? { from: `${year}-01-01`, to: `${year}-12-31` } : range === "12m" ? { from: monthsAgo(12), to: "2100-01-01" } : undefined;
  const report = buildHabits(txs, loadRules(), window) ?? buildHabits(txs, loadRules());
  if (!report) return <EmptyState />;
  return (
    <div>
      <PageHeader title="Habits" description="Everything you've imported, read start to finish. Who you are with money, with receipts." />
      <HabitsView report={report} range={range ?? "all"} />
    </div>
  );
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n, 1);
  return d.toISOString().slice(0, 10);
}
