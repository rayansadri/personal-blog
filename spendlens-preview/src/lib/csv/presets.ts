import type { ColumnMapping } from "../types";

/**
 * Known bank export formats. Matching is by header set so we can pre-fill the
 * column mapping and, importantly, the sign convention.
 */
export interface BankPreset {
  name: string;
  /** All of these headers must be present (case-insensitive). */
  requiredHeaders: string[];
  mapping: ColumnMapping;
}

export const PRESETS: BankPreset[] = [
  {
    name: "Chase Checking",
    requiredHeaders: ["Details", "Posting Date", "Description", "Amount", "Type"],
    mapping: {
      date: "Posting Date",
      description: "Description",
      amount: "Amount",
      positiveIsSpending: false,
      dateOrder: "MDY",
    },
  },
  {
    name: "Chase Credit Card",
    requiredHeaders: ["Transaction Date", "Post Date", "Description", "Category", "Type", "Amount"],
    mapping: {
      date: "Transaction Date",
      description: "Description",
      amount: "Amount",
      positiveIsSpending: false, // Chase card exports use negative for charges
      dateOrder: "MDY",
    },
  },
  {
    name: "American Express",
    requiredHeaders: ["Date", "Description", "Amount"],
    mapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
      positiveIsSpending: true, // Amex: positive = charge
      dateOrder: "MDY",
    },
  },
  {
    name: "Capital One",
    requiredHeaders: ["Transaction Date", "Posted Date", "Description", "Debit", "Credit"],
    mapping: {
      date: "Transaction Date",
      description: "Description",
      debit: "Debit",
      credit: "Credit",
      positiveIsSpending: false,
      dateOrder: "YMD",
    },
  },
  {
    name: "Bank of America",
    requiredHeaders: ["Date", "Description", "Amount", "Running Bal."],
    mapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
      positiveIsSpending: false,
      dateOrder: "MDY",
    },
  },
  {
    name: "Apple Card",
    requiredHeaders: ["Transaction Date", "Clearing Date", "Description", "Merchant", "Category", "Type", "Amount (USD)"],
    mapping: {
      date: "Transaction Date",
      description: "Description",
      merchant: "Merchant",
      amount: "Amount (USD)",
      positiveIsSpending: true,
      dateOrder: "MDY",
    },
  },
  {
    name: "Monzo",
    requiredHeaders: ["Transaction ID", "Date", "Time", "Type", "Name", "Amount"],
    mapping: {
      date: "Date",
      description: "Name",
      amount: "Amount",
      positiveIsSpending: false,
      dateOrder: "DMY",
    },
  },
  {
    name: "SpendLens Standard",
    requiredHeaders: ["date", "merchant", "description", "amount", "account"],
    mapping: {
      date: "date",
      description: "description",
      merchant: "merchant",
      amount: "amount",
      positiveIsSpending: false,
      dateOrder: "YMD",
    },
  },
];

export function detectPreset(headers: string[]): BankPreset | null {
  const lower = new Set(headers.map((h) => h.trim().toLowerCase()));
  // Prefer the most specific preset (most required headers).
  const candidates = PRESETS.filter(
    (p) => p.requiredHeaders.length > 0 && p.requiredHeaders.every((h) => lower.has(h.toLowerCase())),
  ).sort((a, b) => b.requiredHeaders.length - a.requiredHeaders.length);
  if (!candidates.length) return null;
  // Amex's header set is a subset of many others; only accept it when the file has exactly those columns (+ a few).
  const best = candidates[0];
  if (best.name === "American Express" && headers.length > 6) return null;
  return best;
}
