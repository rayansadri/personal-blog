import { getAllTransactions, setRecurringMerchants } from "../db/repository";
import { getSubscriptionRules } from "../db/subscriptions";
import { detectRecurring } from "../analytics/recurring";
import type { SubscriptionRule, Transaction } from "../types";

/** Load analytics-ready transactions (duplicates already excluded). */
export function loadTransactions(): Transaction[] {
  return getAllTransactions();
}

/** User feedback about subscriptions; threaded into recurring detection everywhere. */
export function loadRules(): SubscriptionRule[] {
  return getSubscriptionRules();
}

/** Re-run recurring detection over the whole dataset and persist the flag. */
export function refreshRecurringFlags(): void {
  const txs = getAllTransactions();
  const recurring = detectRecurring(txs, getSubscriptionRules()).filter((r) => r.confidence >= 0.6);
  setRecurringMerchants(new Set(recurring.map((r) => r.merchant)));
}
