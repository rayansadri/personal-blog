import { ImportWizard } from "@/components/import/ImportWizard";
import { ImportHistory } from "@/components/import/ImportHistory";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrivacyNote } from "@/components/ui/PrivacyNote";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div>
      <PageHeader title="Import" description="Drop a CSV export from any bank or card. SpendLens reads the columns, cleans the data and merges it with what you already have." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <ImportWizard />
        </div>
        <div className="flex flex-col gap-4">
          <PrivacyNote />
          <ImportHistory />
          <Card>
            <h3 className="text-[15px] font-semibold tracking-tight">Cards and accounts</h3>
            <p className="mt-1 text-[13px] text-ink-muted">Name your cards, add last-four digits and colors, and see what each is used for.</p>
            <Link href="/cards" className="mt-3 inline-block text-[13.5px] font-medium text-accent hover:underline">Manage cards →</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
