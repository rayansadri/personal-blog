import { getDb } from "./index";

export interface AppSettings {
  /** AI interpretation is opt-in. Off means nothing ever leaves the machine. */
  aiEnabled: boolean;
  /** Model id used when AI is enabled. */
  aiModel: string;
  /** First name for the greeting. Empty means "not set". */
  userName: string;
}

const DEFAULTS: AppSettings = { aiEnabled: false, aiModel: "claude-opus-5", userName: "" };

export function getSettings(): AppSettings {
  const rows = getDb().prepare(`SELECT key, value FROM settings`).all() as { key: string; value: string }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    aiEnabled: map.has("aiEnabled") ? map.get("aiEnabled") === "true" : DEFAULTS.aiEnabled,
    aiModel: map.get("aiModel") ?? DEFAULTS.aiModel,
    userName: map.get("userName") ?? DEFAULTS.userName,
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
  const now = new Date().toISOString();
  db.transaction(() => {
    if (patch.aiEnabled !== undefined) stmt.run("aiEnabled", String(patch.aiEnabled), now);
    if (patch.aiModel) stmt.run("aiModel", patch.aiModel, now);
    if (patch.userName !== undefined) stmt.run("userName", patch.userName.trim().slice(0, 40), now);
  })();
  return getSettings();
}

export function getCachedInterpretation(inputHash: string): { output: string; model: string; createdAt: string } | null {
  const row = getDb().prepare(`SELECT output, model, created_at FROM ai_cache WHERE input_hash = ?`).get(inputHash) as { output: string; model: string; created_at: string } | undefined;
  return row ? { output: row.output, model: row.model, createdAt: row.created_at } : null;
}

export function putCachedInterpretation(inputHash: string, output: string, model: string): void {
  getDb().prepare(`INSERT OR REPLACE INTO ai_cache (input_hash, output, model, created_at) VALUES (?, ?, ?, ?)`).run(inputHash, output, model, new Date().toISOString());
}
