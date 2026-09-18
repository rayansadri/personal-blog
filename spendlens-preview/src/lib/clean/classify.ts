import type { TransactionType } from "../types";
import { CARD_PAYMENT_PATTERNS, INCOME_PATTERNS, REFUND_PATTERNS, TRANSFER_PATTERNS } from "../categorize/rules";

export interface ClassifyInput {
  description: string;
  merchant: string;
  amount: number;
  /** True when the file's sign convention indicated a credit card export. */
  isCardAccount: boolean;
  /** Merchants that appear with outflows anywhere in the dataset. */
  knownExpenseMerchants: Set<string>;
}

/**
 * Decide whether a row is spending, income, a refund, a transfer between the
 * user's own accounts, or a credit card bill payment.
 */
export function classifyTransaction(input: ClassifyInput): TransactionType {
  const text = `${input.description} ${input.merchant}`;

  if (CARD_PAYMENT_PATTERNS.some((p) => p.test(text))) return "payment";
  if (TRANSFER_PATTERNS.some((p) => p.test(text))) return "transfer";

  if (input.amount > 0) {
    if (REFUND_PATTERNS.some((p) => p.test(text))) return "refund";
    if (INCOME_PATTERNS.some((p) => p.test(text))) return "income";
    if (input.knownExpenseMerchants.has(input.merchant)) return "refund";
    // Money arriving on a credit card that isn't a payment is almost always a refund/credit.
    if (input.isCardAccount) return "refund";
    return "income";
  }
  return "expense";
}
