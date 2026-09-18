/**
 * Core domain types for SpendLens.
 *
 * Amount convention: `amount` is signed. Negative = money leaving the account
 * (spending, transfers out, card payments). Positive = money arriving
 * (income, refunds, transfers in). Every importer normalizes to this.
 */

export const CATEGORIES = [
  "Housing",
  "Groceries",
  "Dining",
  "Delivery",
  "Transportation",
  "Shopping",
  "Travel",
  "Entertainment",
  "Health",
  "Subscriptions",
  "Utilities",
  "Income",
  "Transfer",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Categories that count as spending in analytics. */
export const SPENDING_CATEGORIES: Category[] = CATEGORIES.filter(
  (c) => c !== "Income" && c !== "Transfer",
);

/** Categories treated as fixed (predictable, committed) spending. */
export const FIXED_CATEGORIES: Category[] = ["Housing", "Utilities", "Subscriptions"];

export type TransactionType =
  | "expense" // money spent at a merchant
  | "income" // salary, interest, deposits
  | "refund" // money back from a merchant
  | "transfer" // between your own accounts
  | "payment"; // credit card bill payment

export type TransactionFlag =
  | "duplicate" // exact duplicate of another imported row (excluded from analytics)
  | "possible_double_charge" // same merchant + amount within a couple of days
  | "refund";

export interface Transaction {
  id: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** Normalized, human-friendly merchant name */
  merchant: string;
  /** Raw description as it appeared in the CSV */
  description: string;
  /** Signed amount, negative = outflow */
  amount: number;
  account: string;
  category: Category;
  transactionType: TransactionType;
  recurring: boolean;
  sourceFile: string;
  flags: TransactionFlag[];
  importedAt: string;
  /** Sum of other people's shares when this transaction has been split. Your spending = |amount| − splitOthers. */
  splitOthers?: number;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  account: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  mapping: ColumnMapping;
  importedAt: string;
}

/** How CSV columns map onto the normalized transaction. */
export interface ColumnMapping {
  date: string;
  description: string;
  /** Optional dedicated merchant column. Falls back to description. */
  merchant?: string;
  /** Single signed amount column. Mutually exclusive with debit/credit. */
  amount?: string;
  /** Separate debit (money out) and credit (money in) columns. */
  debit?: string;
  credit?: string;
  /** Optional column holding a Debit/Credit indicator (e.g. "DEBIT", "CREDIT", "Sale", "Payment"). */
  type?: string;
  /**
   * When true, positive numbers in `amount` mean money OUT (common on credit
   * card exports). When false, positive means money IN (bank exports).
   */
  positiveIsSpending: boolean;
  /** Optional date format hint: "MDY" | "DMY" | "YMD" */
  dateOrder?: DateOrder;
}

export type DateOrder = "MDY" | "DMY" | "YMD";

/** A raw CSV row keyed by header. */
export type RawRow = Record<string, string>;

/** Filters used by the transaction explorer and analytics helpers. */
export interface TransactionFilters {
  from?: string;
  to?: string;
  account?: string;
  merchant?: string;
  category?: Category;
  type?: TransactionType;
  minAmount?: number;
  maxAmount?: number;
  recurring?: boolean;
  search?: string;
  includeDuplicates?: boolean;
  limit?: number;
  offset?: number;
}

export type AccountKind = "credit" | "debit" | "checking" | "savings";
export const ACCOUNT_KINDS: AccountKind[] = ["credit", "debit", "checking", "savings"];

export type CardTheme = "graphite" | "midnight" | "forest" | "plum" | "sand" | "slate";
export const CARD_THEMES: CardTheme[] = ["graphite", "midnight", "forest", "plum", "sand", "slate"];

/** A card or bank account. `name` matches Transaction.account. */
export interface Account {
  name: string;
  nickname: string | null;
  last4: string | null;
  holder: string | null;
  kind: AccountKind;
  theme: CardTheme;
  network: string | null;
  createdAt: string;
}

export type SubscriptionStatus = "confirmed" | "ignored" | "cancel";

/**
 * What the user has told us about a recurring merchant. Feeds back into
 * detection: confirmed/cancel raise confidence, ignored removes it, manual
 * entries add subscriptions the data alone can't see yet (e.g. annual renewals).
 */
export interface SubscriptionRule {
  merchant: string;
  status: SubscriptionStatus;
  /** Days before a charge to raise a heads-up. */
  reminderDays: number;
  /** Overrides for manual entries or corrections. */
  amount: number | null;
  cadence: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  nextDate: string | null;
  category: Category | null;
  note: string | null;
  manual: boolean;
  updatedAt: string;
}

/** Someone you split bills with. Stored locally; handles are only used to build payment links. */
export interface Person {
  id: string;
  name: string;
  venmo: string | null;
  cashapp: string | null;
  paypal: string | null;
  createdAt: string;
}

export interface SplitShare {
  personId: string | null; // null = you
  name: string;
  amount: number;
  settledAt: string | null;
}

export interface Split {
  id: string;
  transactionId: string;
  merchant: string;
  date: string;
  total: number;
  note: string | null;
  shares: SplitShare[];
  createdAt: string;
}
