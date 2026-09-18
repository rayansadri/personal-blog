import { daysBetween } from "../dates";

export interface DedupeCandidate {
  id: string;
  date: string;
  amount: number;
  account: string;
  description: string;
  merchant: string;
}

/** Stable fingerprint for exact-duplicate detection across files. */
export function fingerprint(t: Pick<DedupeCandidate, "date" | "amount" | "account" | "description">): string {
  const desc = t.description.toLowerCase().replace(/\s+/g, " ").trim();
  return `${t.date}|${t.amount.toFixed(2)}|${t.account.toLowerCase()}|${desc}`;
}

/**
 * Exact duplicates: same date, amount, account, description. The first
 * occurrence is kept; later ones (within the batch, or already in the DB) are
 * flagged so they never count toward analytics.
 */
export function findExactDuplicates(rows: DedupeCandidate[], existing: Set<string>): Set<string> {
  const seen = new Set(existing);
  const dupes = new Set<string>();
  for (const r of rows) {
    const fp = fingerprint(r);
    if (seen.has(fp)) dupes.add(r.id);
    else seen.add(fp);
  }
  return dupes;
}

/**
 * Possible double charges: same merchant and amount at the same account
 * within 2 days, but not exact duplicates (e.g. different descriptions or
 * dates). These are kept but flagged for the user to review.
 */
export function findPossibleDoubleCharges(
  rows: DedupeCandidate[],
  exactDuplicates: Set<string>,
  isExpense: (r: DedupeCandidate) => boolean,
): Set<string> {
  const flagged = new Set<string>();
  const groups = new Map<string, DedupeCandidate[]>();
  for (const r of rows) {
    if (exactDuplicates.has(r.id) || !isExpense(r) || Math.abs(r.amount) < 5) continue;
    const key = `${r.merchant}|${Math.abs(r.amount).toFixed(2)}|${r.account}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(daysBetween(sorted[i - 1].date, sorted[i].date)) <= 2) {
        flagged.add(sorted[i - 1].id);
        flagged.add(sorted[i].id);
      }
    }
  }
  return flagged;
}
