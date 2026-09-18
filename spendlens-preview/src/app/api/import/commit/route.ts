import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { parseCsv } from "@/lib/csv/parse";
import { runPipeline } from "@/lib/clean/pipeline";
import { createCategorizer } from "@/lib/categorize";
import { getAllTransactions, getExistingFingerprints, getMerchantRules, insertImport } from "@/lib/db/repository";
import { refreshRecurringFlags } from "@/lib/server/data";
import { getAccount, guessKind, upsertAccount } from "@/lib/db/accounts";
import type { ColumnMapping } from "@/lib/types";

export const runtime = "nodejs";

/** POST { text, fileName, account, mapping } -> import summary. */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    text?: string;
    fileName?: string;
    account?: string;
    mapping?: ColumnMapping;
  };
  if (!body.text || !body.mapping) return NextResponse.json({ error: "Missing CSV text or mapping" }, { status: 400 });
  const account = (body.account ?? "").trim() || "Imported account";
  const fileName = body.fileName ?? "upload.csv";

  const parsed = parseCsv(body.text);
  const knownExpenseMerchants = new Set(
    getAllTransactions()
      .filter((t) => t.amount < 0)
      .map((t) => t.merchant),
  );
  const result = await runPipeline({
    rows: parsed.rows,
    mapping: body.mapping,
    account,
    sourceFile: fileName,
    categorizer: createCategorizer(getMerchantRules()),
    existingFingerprints: getExistingFingerprints(),
    knownExpenseMerchants,
  });

  if (!getAccount(account)) {
    upsertAccount({
      name: account,
      kind: body.mapping.positiveIsSpending ? "credit" : guessKind(account),
      theme: (["graphite", "midnight", "forest", "plum", "sand", "slate"] as const)[Math.floor(Math.random() * 6)],
    });
  }

  const record = insertImport(
    {
      id: randomUUID(),
      fileName,
      account,
      rowCount: parsed.rows.length,
      importedCount: result.transactions.length - result.duplicateCount,
      duplicateCount: result.duplicateCount,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      mapping: body.mapping,
    },
    result.transactions,
  );
  refreshRecurringFlags();

  const typeCounts: Record<string, number> = {};
  for (const t of result.transactions) {
    if (t.flags.includes("duplicate")) continue;
    typeCounts[t.transactionType] = (typeCounts[t.transactionType] ?? 0) + 1;
  }

  return NextResponse.json({
    import: record,
    skipped: result.skipped.slice(0, 20),
    skippedCount: result.skipped.length,
    duplicateCount: result.duplicateCount,
    doubleChargeCount: result.doubleChargeCount,
    typeCounts,
    categoryCounts: result.categoryCounts,
  });
}
