import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionExplorer } from "@/components/transactions/TransactionExplorer";
import { countTransactions, getAccounts } from "@/lib/db/repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transactions" };

export default function TransactionsPage() {
  if (countTransactions() === 0) return <EmptyState />;
  const accounts = getAccounts();
  return (
    <div>
      <PageHeader title="Transactions" description="Every cleaned transaction across all your accounts. Search, filter, and fix categories." />
      <Suspense>
        <TransactionExplorer accounts={accounts} />
      </Suspense>
    </div>
  );
}
