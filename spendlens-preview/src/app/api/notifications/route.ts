import { NextResponse } from "next/server";
import { buildNotifications } from "@/lib/analytics/notifications";
import { listImports } from "@/lib/db/repository";
import { getReadNotificationIds, markNotificationsRead, markNotificationsUnread } from "@/lib/db/notifications";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const notifications = buildNotifications(loadTransactions(), listImports(), getReadNotificationIds(), new Date(), loadRules());
  return NextResponse.json({ notifications, unread: notifications.filter((n) => !n.read).length });
}

/** POST { ids?: string[], all?: boolean, read?: boolean } */
export async function POST(req: Request) {
  const body = (await req.json()) as { ids?: string[]; all?: boolean; read?: boolean };
  const read = body.read ?? true;
  let ids = body.ids ?? [];
  if (body.all) {
    ids = buildNotifications(loadTransactions(), listImports(), new Set(), new Date(), loadRules()).map((n) => n.id);
  }
  if (read) markNotificationsRead(ids);
  else markNotificationsUnread(ids);
  return NextResponse.json({ ok: true, count: ids.length });
}
