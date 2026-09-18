import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite connection. Local-first: the database lives on disk next to the app
 * (./data/spendlens.db by default) and never leaves the machine.
 */

const DEFAULT_PATH = path.join(process.cwd(), "data", "spendlens.db");

declare global {
  var __spendlensDb: Database.Database | undefined;
}

function open(): Database.Database {
  const dbPath = process.env.SPENDLENS_DB_PATH
    ? path.resolve(process.env.SPENDLENS_DB_PATH)
    : DEFAULT_PATH;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      account TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      imported_count INTEGER NOT NULL,
      duplicate_count INTEGER NOT NULL,
      date_from TEXT,
      date_to TEXT,
      mapping TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      merchant TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      account TEXT NOT NULL,
      category TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      recurring INTEGER NOT NULL DEFAULT 0,
      source_file TEXT NOT NULL,
      import_id TEXT REFERENCES imports(id) ON DELETE CASCADE,
      flags TEXT NOT NULL DEFAULT '[]',
      fingerprint TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant);
    CREATE INDEX IF NOT EXISTS idx_tx_fingerprint ON transactions(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_tx_import ON transactions(import_id);

    -- Cards / accounts the user has told us about. Keyed by the account name used on transactions.
    CREATE TABLE IF NOT EXISTS accounts (
      name TEXT PRIMARY KEY,
      nickname TEXT,
      last4 TEXT,
      holder TEXT,
      kind TEXT NOT NULL DEFAULT 'credit',
      theme TEXT NOT NULL DEFAULT 'graphite',
      network TEXT,
      created_at TEXT NOT NULL
    );

    -- Subscription feedback and manual entries.
    CREATE TABLE IF NOT EXISTS subscription_rules (
      merchant TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      reminder_days INTEGER NOT NULL DEFAULT 3,
      amount REAL,
      cadence TEXT,
      next_date TEXT,
      category TEXT,
      note TEXT,
      manual INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- Bill splitting: people you split with, and splits attached to transactions.
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      venmo TEXT,
      cashapp TEXT,
      paypal TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS splits (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS split_shares (
      split_id TEXT NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
      person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      settled_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_split_tx ON splits(transaction_id);

    -- Key/value app settings (e.g. whether AI interpretation is enabled).
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Cached AI interpretations keyed by a hash of the exact input sent.
    CREATE TABLE IF NOT EXISTS ai_cache (
      input_hash TEXT PRIMARY KEY,
      output TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Ask SpendLens conversations. Model-side state lives with the provider via previous_response_id.
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      last_response_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      cards TEXT NOT NULL DEFAULT '[]',
      evidence TEXT NOT NULL DEFAULT '[]',
      followups TEXT NOT NULL DEFAULT '[]',
      source TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id, created_at);

    -- Which notifications the user has already seen.
    CREATE TABLE IF NOT EXISTS notification_reads (
      id TEXT PRIMARY KEY,
      read_at TEXT NOT NULL
    );

    -- User overrides: "always categorize this merchant as X".
    CREATE TABLE IF NOT EXISTS merchant_rules (
      merchant TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

// The connection is cached on globalThis so dev hot-reloads reuse it, but the
// schema can change between reloads. Run the idempotent migrations once per
// module instance against whichever connection we end up with.
let migratedThisModule = false;

export function getDb(): Database.Database {
  if (!globalThis.__spendlensDb) {
    globalThis.__spendlensDb = open();
    migratedThisModule = true;
  } else if (!migratedThisModule) {
    migrate(globalThis.__spendlensDb);
    migratedThisModule = true;
  }
  return globalThis.__spendlensDb;
}
