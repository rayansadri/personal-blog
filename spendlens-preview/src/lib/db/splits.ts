import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import type { Person, Split, SplitShare } from "../types";

interface PersonRow { id: string; name: string; venmo: string | null; cashapp: string | null; paypal: string | null; created_at: string }
const toPerson = (r: PersonRow): Person => ({ id: r.id, name: r.name, venmo: r.venmo, cashapp: r.cashapp, paypal: r.paypal, createdAt: r.created_at });

export function listPeople(): Person[] {
  return (getDb().prepare(`SELECT * FROM people ORDER BY name COLLATE NOCASE`).all() as PersonRow[]).map(toPerson);
}

export function upsertPerson(input: Partial<Person> & { name: string }): Person {
  const db = getDb();
  const clean = (v?: string | null) => (v ? v.trim().replace(/^[@$]/, "") || null : null);
  if (input.id) {
    db.prepare(`UPDATE people SET name = ?, venmo = ?, cashapp = ?, paypal = ? WHERE id = ?`).run(input.name.trim(), clean(input.venmo), clean(input.cashapp), clean(input.paypal), input.id);
    return toPerson(db.prepare(`SELECT * FROM people WHERE id = ?`).get(input.id) as PersonRow);
  }
  const person: Person = { id: randomUUID(), name: input.name.trim(), venmo: clean(input.venmo), cashapp: clean(input.cashapp), paypal: clean(input.paypal), createdAt: new Date().toISOString() };
  db.prepare(`INSERT INTO people (id, name, venmo, cashapp, paypal, created_at) VALUES (@id, @name, @venmo, @cashapp, @paypal, @createdAt)`).run(person);
  return person;
}

export function deletePerson(id: string): void {
  getDb().prepare(`DELETE FROM people WHERE id = ?`).run(id);
}

interface SplitRow { id: string; transaction_id: string; note: string | null; created_at: string; merchant: string; date: string; amount: number }
interface ShareRow { split_id: string; person_id: string | null; name: string; amount: number; settled_at: string | null }

function hydrate(rows: SplitRow[]): Split[] {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const shares = db.prepare(`SELECT * FROM split_shares WHERE split_id IN (${ids.map(() => "?").join(",")})`).all(...ids) as ShareRow[];
  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    merchant: r.merchant,
    date: r.date,
    total: Math.abs(r.amount),
    note: r.note,
    createdAt: r.created_at,
    shares: shares
      .filter((s) => s.split_id === r.id)
      .map((s): SplitShare => ({ personId: s.person_id, name: s.name, amount: s.amount, settledAt: s.settled_at })),
  }));
}

const SELECT = `SELECT sp.id, sp.transaction_id, sp.note, sp.created_at, t.merchant, t.date, t.amount FROM splits sp JOIN transactions t ON t.id = sp.transaction_id`;

export function listSplits(): Split[] {
  return hydrate(getDb().prepare(`${SELECT} ORDER BY t.date DESC, sp.created_at DESC`).all() as SplitRow[]);
}

export function getSplitForTransaction(transactionId: string): Split | null {
  const rows = getDb().prepare(`${SELECT} WHERE sp.transaction_id = ?`).all(transactionId) as SplitRow[];
  return hydrate(rows)[0] ?? null;
}

/** Create or replace the split for a transaction. */
export function saveSplit(transactionId: string, shares: Array<{ personId: string | null; name: string; amount: number }>, note: string | null): Split {
  const db = getDb();
  const id = randomUUID();
  db.transaction(() => {
    db.prepare(`DELETE FROM splits WHERE transaction_id = ?`).run(transactionId);
    db.prepare(`INSERT INTO splits (id, transaction_id, note, created_at) VALUES (?, ?, ?, ?)`).run(id, transactionId, note, new Date().toISOString());
    const stmt = db.prepare(`INSERT INTO split_shares (split_id, person_id, name, amount, settled_at) VALUES (?, ?, ?, ?, NULL)`);
    for (const s of shares) stmt.run(id, s.personId, s.name, Math.round(s.amount * 100) / 100);
  })();
  return getSplitForTransaction(transactionId)!;
}

export function settleShare(splitId: string, personId: string | null, settled: boolean): void {
  getDb()
    .prepare(`UPDATE split_shares SET settled_at = ? WHERE split_id = ? AND ${personId ? "person_id = ?" : "person_id IS NULL"}`)
    .run(settled ? new Date().toISOString() : null, splitId, ...(personId ? [personId] : []));
}

export function deleteSplit(id: string): void {
  getDb().prepare(`DELETE FROM splits WHERE id = ?`).run(id);
}
