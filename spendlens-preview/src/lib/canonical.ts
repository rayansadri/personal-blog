import type { Transaction } from "./types";

/**
 * EPIC 1: canonical transaction schema, independent of bank/card format.
 *
 * The storage model (`Transaction`) is what the importer writes. This is the
 * canonical *view* over it: raw values preserved for audit, derived fields for
 * analytics. Everything downstream (metrics, features, AI input) reads this.
 */

export type CanonicalTransactionType =
  | "purchase"
  | "refund"
  | "transfer"
  | "credit_card_payment"
  | "income"
  | "fee"
  | "cash_withdrawal"
  | "unknown";

export interface CanonicalTransaction {
  id: string;
  userId: string;
  sourceFileId: string;
  accountId: string;
  date: string;
  postedDate?: string;
  merchantRaw: string;
  merchantNormalized: string;
  descriptionRaw: string;
  /** Absolute amount. Sign lives in `direction`. */
  amount: number;
  currency: string;
  direction: "debit" | "credit";
  category: string;
  subcategory?: string;
  transactionType: CanonicalTransactionType;
  isRecurring: boolean;
  recurringGroupId?: string;
  isDuplicate: boolean;
  /** True for anything that is not spending: transfers, card payments, income, refunds, duplicates. */
  isExcludedFromSpend: boolean;
  /** Portion of a split purchase that other people owe. Your spend = amount − splitOthers. */
  splitOthers: number;
  createdAt: string;
}

const FEE = /\b(fee|overdraft|late charge|service charge|foreign transaction|interest charge|annual fee|nsf)\b/i;
const CASH = /\b(atm|cash withdrawal|cash advance)\b/i;

export function canonicalType(t: Transaction): CanonicalTransactionType {
  switch (t.transactionType) {
    case "income":
      return "income";
    case "refund":
      return "refund";
    case "payment":
      return "credit_card_payment";
    case "transfer":
      return CASH.test(t.description) ? "cash_withdrawal" : "transfer";
    case "expense":
      if (FEE.test(t.description)) return "fee";
      return "purchase";
    default:
      return "unknown";
  }
}

export function toCanonical(t: Transaction, userId = "local"): CanonicalTransaction {
  const type = canonicalType(t);
  const isDuplicate = t.flags.includes("duplicate");
  return {
    id: t.id,
    userId,
    sourceFileId: t.sourceFile,
    accountId: t.account,
    date: t.date,
    merchantRaw: t.description,
    merchantNormalized: t.merchant,
    descriptionRaw: t.description,
    amount: Math.abs(t.amount),
    currency: "USD",
    direction: t.amount < 0 ? "debit" : "credit",
    category: t.category,
    transactionType: type,
    isRecurring: t.recurring,
    recurringGroupId: t.recurring ? `rec:${t.merchant}` : undefined,
    isDuplicate,
    isExcludedFromSpend: isDuplicate || !(type === "purchase" || type === "fee" || type === "cash_withdrawal"),
    splitOthers: t.splitOthers ?? 0,
    createdAt: t.importedAt,
  };
}

export function toCanonicalAll(txs: Transaction[]): CanonicalTransaction[] {
  return txs.map((t) => toCanonical(t));
}

/** Spend transactions only, with the amount you actually paid. */
export function spendOf(c: CanonicalTransaction): number {
  return c.isExcludedFromSpend ? 0 : Math.max(0, c.amount - c.splitOthers);
}
