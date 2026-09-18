import { PageHeader } from "@/components/ui/PageHeader";
import { SplitsBoard } from "@/components/splits/SplitsBoard";
import { listPeople, listSplits } from "@/lib/db/splits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Splits" };

export default function SplitsPage() {
  return (
    <div>
      <PageHeader title="Splits" description="Who owes you what. Split any purchase from the transaction list; send the message; mark it paid when the money lands." />
      <SplitsBoard initialSplits={listSplits()} initialPeople={listPeople()} />
    </div>
  );
}
