import { getDb } from "./index";
import type { SubscriptionRule } from "../types";

interface Row {
  merchant: string;
  status: string;
  reminder_days: number;
  amount: number | null;
  cadence: string | null;
  next_date: string | null;
  category: string | null;
  note: string | null;
  manual: number;
  updated_at: string;
}

const toRule = (r: Row): SubscriptionRule => ({
  merchant: r.merchant,
  status: r.status as SubscriptionRule["status"],
  reminderDays: r.reminder_days,
  amount: r.amount,
  cadence: r.cadence as SubscriptionRule["cadence"],
  nextDate: r.next_date,
  category: r.category as SubscriptionRule["category"],
  note: r.note,
  manual: r.manual === 1,
  updatedAt: r.updated_at,
});

export function getSubscriptionRules(): SubscriptionRule[] {
  return (getDb().prepare(`SELECT * FROM subscription_rules ORDER BY merchant`).all() as Row[]).map(toRule);
}

export function upsertSubscriptionRule(input: Partial<SubscriptionRule> & { merchant: string }): SubscriptionRule {
  const db = getDb();
  const existing = (db.prepare(`SELECT * FROM subscription_rules WHERE merchant = ?`).get(input.merchant) as Row | undefined);
  const prev = existing ? toRule(existing) : null;
  const rule: SubscriptionRule = {
    merchant: input.merchant,
    status: input.status ?? prev?.status ?? "confirmed",
    reminderDays: input.reminderDays ?? prev?.reminderDays ?? 3,
    amount: input.amount === undefined ? prev?.amount ?? null : input.amount,
    cadence: input.cadence === undefined ? prev?.cadence ?? null : input.cadence,
    nextDate: input.nextDate === undefined ? prev?.nextDate ?? null : input.nextDate,
    category: input.category === undefined ? prev?.category ?? null : input.category,
    note: input.note === undefined ? prev?.note ?? null : input.note,
    manual: input.manual ?? prev?.manual ?? false,
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO subscription_rules (merchant, status, reminder_days, amount, cadence, next_date, category, note, manual, updated_at)
     VALUES (@merchant, @status, @reminderDays, @amount, @cadence, @nextDate, @category, @note, @manual, @updatedAt)
     ON CONFLICT(merchant) DO UPDATE SET status = excluded.status, reminder_days = excluded.reminder_days, amount = excluded.amount,
       cadence = excluded.cadence, next_date = excluded.next_date, category = excluded.category, note = excluded.note,
       manual = excluded.manual, updated_at = excluded.updated_at`,
  ).run({ ...rule, manual: rule.manual ? 1 : 0 });
  return rule;
}

export function deleteSubscriptionRule(merchant: string): void {
  getDb().prepare(`DELETE FROM subscription_rules WHERE merchant = ?`).run(merchant);
}
