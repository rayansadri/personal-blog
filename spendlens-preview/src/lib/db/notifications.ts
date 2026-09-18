import { getDb } from "./index";

export function getReadNotificationIds(): Set<string> {
  const rows = getDb().prepare(`SELECT id FROM notification_reads`).all() as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

export function markNotificationsRead(ids: string[]): void {
  const db = getDb();
  const stmt = db.prepare(`INSERT OR IGNORE INTO notification_reads (id, read_at) VALUES (?, ?)`);
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const id of ids) stmt.run(id, now);
  })();
}

export function markNotificationsUnread(ids: string[]): void {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM notification_reads WHERE id = ?`);
  db.transaction(() => {
    for (const id of ids) stmt.run(id);
  })();
}
