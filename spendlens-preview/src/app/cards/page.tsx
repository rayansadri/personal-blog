import { CardsView } from "@/components/cards/CardsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { availableMonths, latestMonth } from "@/lib/analytics/core";
import { buildCardProfiles } from "@/lib/analytics/cards";
import { listAccounts } from "@/lib/db/accounts";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cards" };

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ month?: string; card?: string }> }) {
  const txs = loadTransactions();
  const accounts = listAccounts();
  const latest = latestMonth(txs) ?? new Date().toISOString().slice(0, 7);
  const { month: requested, card } = await searchParams;
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : latest;
  const profiles = buildCardProfiles(txs, accounts, month, loadRules());
  const months = availableMonths(txs);

  return (
    <div>
      <PageHeader
        title="Cards"
        description="Every card and account in one place, and what each one is actually used for."
        action={months.length ? <MonthPicker month={month} months={months} /> : undefined}
      />
      <CardsView profiles={profiles} initialCard={card ?? null} />
    </div>
  );
}
