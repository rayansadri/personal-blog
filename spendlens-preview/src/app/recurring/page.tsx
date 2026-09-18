import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubscriptionManager } from "@/components/subscriptions/SubscriptionManager";
import { latestMonth } from "@/lib/analytics/core";
import { buildHeadsUp } from "@/lib/analytics/headsUp";
import { detectRecurring } from "@/lib/analytics/recurring";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const txs = loadTransactions();
  if (!latestMonth(txs)) return <EmptyState />;
  const rules = loadRules();
  const { focus } = await searchParams;
  const subscriptions = detectRecurring(txs, rules);
  const headsUp = buildHeadsUp(txs, rules);
  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Everything that charges you on a schedule. Confirm what's real, dismiss what isn't, flag what to cancel, and SpendLens will warn you before each charge."
      />
      <SubscriptionManager initial={subscriptions} headsUp={headsUp} focus={focus ?? null} today={new Date().toISOString().slice(0, 10)} />
    </div>
  );
}
