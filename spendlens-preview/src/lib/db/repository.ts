import { getDb } from "./index";
import type {
  Category,
  ImportRecord,
  Transaction,
  TransactionFilters,
  TransactionFlag,
  TransactionType,
} from "../types";

interface TxRow {
  id: string;
  date: string;
  merchant: string;
  description: string;
  amount: number;
  account: string;
  category: string;
  transaction_type: string;
  recurring: number;
  source_file: string;
  flags: string;
  imported_at: string;
  split_others?: number | null;
}

function rowToTx(r: TxRow): Transaction {
  return {
    id: r.id,
    date: r.date,
    merchant: r.merchant,
    description: r.description,
    amount: r.amount,
    account: r.account,
    category: r.category as Category,
    transactionType: r.transaction_type as TransactionType,
    recurring: r.recurring === 1,
    sourceFile: r.source_file,
    flags: JSON.parse(r.flags) as TransactionFlag[],
    importedAt: r.imported_at,
    splitOthers: r.split_others ?? 0,
  };
}

/** Sub-select adding the sum of other people's shares for split transactions. */
const SPLIT_OTHERS = `(SELECT COALESCE(SUM(ss.amount), 0) FROM splits sp JOIN split_shares ss ON ss.split_id = sp.id WHERE sp.transaction_id = transactions.id AND ss.person_id IS NOT NULL) AS split_others`;

/** All transactions usable for analytics (duplicates excluded). */
export function getAllTransactions(): Transaction[] {
  const rows = getDb()
    .prepare(
      `SELECT transactions.*, ${SPLIT_OTHERS} FROM transactions WHERE flags NOT LIKE '%"duplicate"%' ORDER BY date DESC, id`,
    )
    .all() as TxRow[];
  return rows.map(rowToTx);
}

export function countTransactions(): number {
  const r = getDb().prepare(`SELECT COUNT(*) as n FROM transactions`).get() as { n: number };
  return r.n;
}

export function getExistingFingerprints(): Set<string> {
  const rows = getDb().prepare(`SELECT fingerprint FROM transactions`).all() as {
    fingerprint: string;
  }[];
  return new Set(rows.map((r) => r.fingerprint));
}

export function getAccounts(): string[] {
  const rows = getDb()
    .prepare(`SELECT DISTINCT account FROM transactions ORDER BY account`)
    .all() as { account: string }[];
  return rows.map((r) => r.account);
}

export function queryTransactions(f: TransactionFilters): {
  items: Transaction[];
  total: number;
} {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (!f.includeDuplicates) where.push(`flags NOT LIKE '%"duplicate"%'`);
  if (f.from) {
    where.push(`date >= @from`);
    params.from = f.from;
  }
  if (f.to) {
    where.push(`date <= @to`);
    params.to = f.to;
  }
  if (f.account) {
    where.push(`account = @account`);
    params.account = f.account;
  }
  if (f.merchant) {
    where.push(`merchant = @merchant`);
    params.merchant = f.merchant;
  }
  if (f.category) {
    where.push(`category = @category`);
    params.category = f.category;
  }
  if (f.type) {
    where.push(`transaction_type = @type`);
    params.type = f.type;
  }
  if (typeof f.minAmount === "number") {
    where.push(`ABS(amount) >= @minAmount`);
    params.minAmount = f.minAmount;
  }
  if (typeof f.maxAmount === "number") {
    where.push(`ABS(amount) <= @maxAmount`);
    params.maxAmount = f.maxAmount;
  }
  if (typeof f.recurring === "boolean") {
    where.push(`recurring = @recurring`);
    params.recurring = f.recurring ? 1 : 0;
  }
  if (f.search) {
    where.push(`(merchant LIKE @search OR description LIKE @search)`);
    params.search = `%${f.search}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(f.limit ?? 100, 500);
  const offset = f.offset ?? 0;

  const db = getDb();
  const total = (
    db.prepare(`SELECT COUNT(*) as n FROM transactions ${whereSql}`).get(params) as { n: number }
  ).n;
  const items = (
    db
      .prepare(
        `SELECT transactions.*, ${SPLIT_OTHERS} FROM transactions ${whereSql} ORDER BY date DESC, ABS(amount) DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit, offset }) as TxRow[]
  ).map(rowToTx);

  return { items, total };
}

export interface InsertableTransaction extends Omit<Transaction, "importedAt"> {
  fingerprint: string;
}

export function insertImport(
  record: Omit<ImportRecord, "importedAt">,
  transactions: InsertableTransaction[],
): ImportRecord {
  const db = getDb();
  const importedAt = new Date().toISOString();

  const insertImportStmt = db.prepare(`
    INSERT INTO imports (id, file_name, account, row_count, imported_count, duplicate_count, date_from, date_to, mapping, imported_at)
    VALUES (@id, @fileName, @account, @rowCount, @importedCount, @duplicateCount, @dateFrom, @dateTo, @mapping, @importedAt)
  `);
  const insertTxStmt = db.prepare(`
    INSERT INTO transactions (id, date, merchant, description, amount, account, category, transaction_type, recurring, source_file, import_id, flags, fingerprint, imported_at)
    VALUES (@id, @date, @merchant, @description, @amount, @account, @category, @transactionType, @recurring, @sourceFile, @importId, @flags, @fingerprint, @importedAt)
  `);

  db.transaction(() => {
    insertImportStmt.run({
      ...record,
      mapping: JSON.stringify(record.mapping),
      importedAt,
    });
    for (const t of transactions) {
      insertTxStmt.run({
        id: t.id,
        date: t.date,
        merchant: t.merchant,
        description: t.description,
        amount: t.amount,
        account: t.account,
        category: t.category,
        transactionType: t.transactionType,
        recurring: t.recurring ? 1 : 0,
        sourceFile: t.sourceFile,
        importId: record.id,
        flags: JSON.stringify(t.flags),
        fingerprint: t.fingerprint,
        importedAt,
      });
    }
  })();

  return { ...record, importedAt };
}

export function listImports(): ImportRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM imports ORDER BY imported_at DESC`)
    .all() as Array<{
    id: string;
    file_name: string;
    account: string;
    row_count: number;
    imported_count: number;
    duplicate_count: number;
    date_from: string | null;
    date_to: string | null;
    mapping: string;
    imported_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    account: r.account,
    rowCount: r.row_count,
    importedCount: r.imported_count,
    duplicateCount: r.duplicate_count,
    dateFrom: r.date_from,
    dateTo: r.date_to,
    mapping: JSON.parse(r.mapping),
    importedAt: r.imported_at,
  }));
}

export function deleteImport(id: string): void {
  getDb().prepare(`DELETE FROM imports WHERE id = ?`).run(id);
}

export function deleteAllData(): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`DELETE FROM transactions`).run();
    db.prepare(`DELETE FROM imports`).run();
    db.prepare(`DELETE FROM merchant_rules`).run();
    db.prepare(`DELETE FROM notification_reads`).run();
    db.prepare(`DELETE FROM subscription_rules`).run();
    db.prepare(`DELETE FROM split_shares`).run();
    db.prepare(`DELETE FROM splits`).run();
    db.prepare(`DELETE FROM people`).run();
    db.prepare(`DELETE FROM accounts`).run();
    db.prepare(`DELETE FROM ai_cache`).run();
    db.prepare(`DELETE FROM chat_messages`).run();
    db.prepare(`DELETE FROM chat_conversations`).run();
  })();
}

export function updateTransaction(
  id: string,
  patch: { category?: Category; recurring?: boolean },
): Transaction | null {
  const db = getDb();
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  if (patch.category) {
    sets.push(`category = @category`);
    params.category = patch.category;
  }
  if (typeof patch.recurring === "boolean") {
    sets.push(`recurring = @recurring`);
    params.recurring = patch.recurring ? 1 : 0;
  }
  if (sets.length) {
    db.prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = @id`).run(params);
  }
  const row = db.prepare(`SELECT transactions.*, ${SPLIT_OTHERS} FROM transactions WHERE id = ?`).get(id) as TxRow | undefined;
  return row ? rowToTx(row) : null;
}

/** Apply a category to every transaction from a merchant and remember the rule. */
export function setMerchantCategory(merchant: string, category: Category): number {
  const db = getDb();
  let changed = 0;
  db.transaction(() => {
    db.prepare(
      `INSERT INTO merchant_rules (merchant, category, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(merchant) DO UPDATE SET category = excluded.category, updated_at = excluded.updated_at`,
    ).run(merchant, category, new Date().toISOString());
    const r = db
      .prepare(
        `UPDATE transactions SET category = ? WHERE merchant = ? AND transaction_type IN ('expense','refund')`,
      )
      .run(category, merchant);
    changed = r.changes;
  })();
  return changed;
}

export function getMerchantRules(): Map<string, Category> {
  const rows = getDb().prepare(`SELECT merchant, category FROM merchant_rules`).all() as {
    merchant: string;
    category: Category;
  }[];
  return new Map(rows.map((r) => [r.merchant, r.category]));
}

/** Bulk-update the recurring flag after re-running detection. */
export function setRecurringMerchants(merchants: Set<string>): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`UPDATE transactions SET recurring = 0 WHERE transaction_type = 'expense'`).run();
    const stmt = db.prepare(
      `UPDATE transactions SET recurring = 1 WHERE merchant = ? AND transaction_type = 'expense'`,
    );
    for (const m of merchants) stmt.run(m);
  })();
}
