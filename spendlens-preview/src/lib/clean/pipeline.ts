import { randomUUID } from "node:crypto";
import type { Category, ColumnMapping, RawRow, TransactionFlag } from "../types";
import { parseDate, resolveAmount } from "../csv/parse";
import { normalizeMerchant } from "../normalize/merchant";
import { classifyTransaction } from "./classify";
import { findExactDuplicates, findPossibleDoubleCharges, fingerprint } from "./duplicates";
import type { Categorizer } from "../categorize";
import type { InsertableTransaction } from "../db/repository";

export interface PipelineOptions {
  rows: RawRow[];
  mapping: ColumnMapping;
  account: string;
  sourceFile: string;
  categorizer: Categorizer;
  /** Fingerprints already stored, to catch re-uploaded statements. */
  existingFingerprints: Set<string>;
  /** Merchants already known as expense merchants (helps refund detection). */
  knownExpenseMerchants?: Set<string>;
}

export interface PipelineResult {
  transactions: InsertableTransaction[];
  skipped: Array<{ row: number; reason: string }>;
  duplicateCount: number;
  doubleChargeCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  categoryCounts: Record<string, number>;
}

/**
 * Turn raw CSV rows into clean, classified, categorized transactions.
 * Pure aside from ID generation, so it is easy to test.
 */
export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const { rows, mapping, account, sourceFile, categorizer } = opts;
  const skipped: PipelineResult["skipped"] = [];

  type Draft = {
    id: string;
    date: string;
    description: string;
    merchant: string;
    amount: number;
    account: string;
  };
  const drafts: Draft[] = [];

  rows.forEach((row, i) => {
    const date = parseDate(row[mapping.date], mapping.dateOrder ?? "MDY");
    const amount = resolveAmount(row, mapping);
    const description = (row[mapping.description] ?? "").trim();
    if (!date) return skipped.push({ row: i + 1, reason: `Unreadable date "${row[mapping.date] ?? ""}"` });
    if (amount == null) return skipped.push({ row: i + 1, reason: "Missing amount" });
    if (amount === 0) return skipped.push({ row: i + 1, reason: "Zero amount" });
    if (!description) return skipped.push({ row: i + 1, reason: "Missing description" });
    const merchant = normalizeMerchant(description, mapping.merchant ? row[mapping.merchant] : undefined);
    drafts.push({ id: randomUUID(), date, description, merchant, amount, account });
  });

  // Expense merchants across this batch + previously imported data inform refund detection.
  const knownExpenseMerchants = new Set(opts.knownExpenseMerchants ?? []);
  for (const d of drafts) if (d.amount < 0) knownExpenseMerchants.add(d.merchant);

  const isCardAccount = mapping.positiveIsSpending;
  const classified = drafts.map((d) => ({
    ...d,
    transactionType: classifyTransaction({
      description: d.description,
      merchant: d.merchant,
      amount: d.amount,
      isCardAccount,
      knownExpenseMerchants,
    }),
  }));

  const exactDupes = findExactDuplicates(classified, opts.existingFingerprints);
  const doubles = findPossibleDoubleCharges(classified, exactDupes, (r) => {
    const c = classified.find((x) => x.id === r.id);
    return c?.transactionType === "expense";
  });

  const categoryCounts: Record<string, number> = {};
  const transactions: InsertableTransaction[] = [];
  for (const c of classified) {
    const result = await categorizer.categorize({
      merchant: c.merchant,
      description: c.description,
      amount: c.amount,
      transactionType: c.transactionType,
    });
    const category: Category = result.category;
    const flags: TransactionFlag[] = [];
    if (exactDupes.has(c.id)) flags.push("duplicate");
    if (doubles.has(c.id)) flags.push("possible_double_charge");
    if (c.transactionType === "refund") flags.push("refund");
    if (!flags.includes("duplicate")) categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;

    transactions.push({
      id: c.id,
      date: c.date,
      merchant: c.merchant,
      description: c.description,
      amount: c.amount,
      account: c.account,
      category,
      transactionType: c.transactionType,
      recurring: false,
      sourceFile,
      flags,
      fingerprint: fingerprint(c),
    });
  }

  const dates = transactions.map((t) => t.date).sort();
  return {
    transactions,
    skipped,
    duplicateCount: exactDupes.size,
    doubleChargeCount: doubles.size,
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
    categoryCounts,
  };
}
