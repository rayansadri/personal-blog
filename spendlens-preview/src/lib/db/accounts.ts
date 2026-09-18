import { getDb } from "./index";
import type { Account, AccountKind, CardTheme } from "../types";

interface Row {
  name: string;
  nickname: string | null;
  last4: string | null;
  holder: string | null;
  kind: string;
  theme: string;
  network: string | null;
  created_at: string;
}

const rowToAccount = (r: Row): Account => ({
  name: r.name,
  nickname: r.nickname,
  last4: r.last4,
  holder: r.holder,
  kind: r.kind as AccountKind,
  theme: r.theme as CardTheme,
  network: r.network,
  createdAt: r.created_at,
});

/**
 * All accounts: explicit card records plus any account name that only exists
 * on transactions (imported before a card was added). Ordered by creation.
 */
export function listAccounts(): Account[] {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM accounts ORDER BY created_at`).all() as Row[];
  const known = new Set(rows.map((r) => r.name));
  const orphan = (
    db.prepare(`SELECT DISTINCT account FROM transactions ORDER BY account`).all() as { account: string }[]
  ).filter((r) => !known.has(r.account));
  const now = new Date().toISOString();
  const THEMES: CardTheme[] = ["graphite", "midnight", "forest", "plum", "sand", "slate"];
  const created = orphan.map((o, i) =>
    upsertAccount({ name: o.account, kind: guessKind(o.account), theme: THEMES[(rows.length + i) % THEMES.length], createdAt: now }),
  );
  return [...rows.map(rowToAccount), ...created];
}

export function getAccount(name: string): Account | null {
  const r = getDb().prepare(`SELECT * FROM accounts WHERE name = ?`).get(name) as Row | undefined;
  return r ? rowToAccount(r) : null;
}

export function upsertAccount(input: Partial<Account> & { name: string }): Account {
  const db = getDb();
  const existing = getAccount(input.name);
  const merged: Account = {
    name: input.name,
    nickname: input.nickname ?? existing?.nickname ?? null,
    last4: input.last4 ?? existing?.last4 ?? null,
    holder: input.holder ?? existing?.holder ?? null,
    kind: input.kind ?? existing?.kind ?? "credit",
    theme: input.theme ?? existing?.theme ?? "graphite",
    network: input.network ?? existing?.network ?? null,
    createdAt: existing?.createdAt ?? input.createdAt ?? new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO accounts (name, nickname, last4, holder, kind, theme, network, created_at)
     VALUES (@name, @nickname, @last4, @holder, @kind, @theme, @network, @createdAt)
     ON CONFLICT(name) DO UPDATE SET nickname = excluded.nickname, last4 = excluded.last4, holder = excluded.holder,
       kind = excluded.kind, theme = excluded.theme, network = excluded.network`,
  ).run(merged);
  return merged;
}

/** Rename an account everywhere (card record + transactions + imports). */
export function renameAccount(from: string, to: string): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`UPDATE accounts SET name = ? WHERE name = ?`).run(to, from);
    db.prepare(`UPDATE transactions SET account = ? WHERE account = ?`).run(to, from);
    db.prepare(`UPDATE imports SET account = ? WHERE account = ?`).run(to, from);
  })();
}

/** Remove a card and, optionally, every transaction imported under it. */
export function deleteAccount(name: string, deleteTransactions: boolean): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`DELETE FROM accounts WHERE name = ?`).run(name);
    if (deleteTransactions) {
      db.prepare(`DELETE FROM transactions WHERE account = ?`).run(name);
      db.prepare(`DELETE FROM imports WHERE account = ?`).run(name);
    }
  })();
}

export function guessKind(name: string): AccountKind {
  const n = name.toLowerCase();
  if (/saving/.test(n)) return "savings";
  if (/check|current|chequing/.test(n)) return "checking";
  if (/debit/.test(n)) return "debit";
  return "credit";
}
