import type { ImportRecord, SubscriptionRule, Transaction } from "../types";
import { daysBetween, formatDate, monthRange } from "../dates";
import { latestMonth } from "./core";
import { generateInsights, type Insight } from "./insights";
import { buildHeadsUp, headsUpBody, headsUpTitle } from "./headsUp";

export type NotificationIcon =
  | "trend-up"
  | "trend-down"
  | "repeat"
  | "alert"
  | "receipt"
  | "sparkle"
  | "upload"
  | "calendar"
  | "refund"
  | "star"
  | "compare"
  | "fork";

export type NotificationTone = "neutral" | "accent" | "positive" | "negative" | "warning";

export interface Notification {
  /** Stable across reloads so read state can be persisted. */
  id: string;
  icon: NotificationIcon;
  tone: NotificationTone;
  title: string;
  body: string;
  /** ISO date or datetime used for ordering and "time ago". */
  at: string;
  href?: string;
  /** Group label shown in the panel. */
  group: "Today" | "This week" | "Earlier";
  read: boolean;
}

const INSIGHT_ICON: Record<Insight["kind"], NotificationIcon> = {
  "total-change": "compare",
  "vs-average": "compare",
  "category-change": "trend-up",
  "merchant-change": "trend-up",
  frequency: "fork",
  subscriptions: "repeat",
  weekend: "calendar",
  "bill-increase": "receipt",
  "double-charge": "alert",
  "new-merchant": "sparkle",
  "large-transaction": "star",
  refunds: "refund",
};

/**
 * Build the notification feed from deterministic sources: this month's
 * insights, upcoming recurring charges and recent imports. `now` is the
 * latest date in the data so the feed is stable for a given dataset.
 */
export function buildNotifications(
  txs: Transaction[],
  imports: ImportRecord[],
  readIds: Set<string>,
  clock: Date = new Date(),
  rules: SubscriptionRule[] = [],
): Notification[] {
  const month = latestMonth(txs);
  const out: Omit<Notification, "group" | "read">[] = [];
  const todayIso = clock.toISOString().slice(0, 10);

  // 0. Heads-ups: charges about to hit, relative to the wall clock. Always first.
  for (const h of buildHeadsUp(txs, rules, todayIso)) {
    out.push({
      id: h.id,
      icon: h.reason === "cancel" ? "alert" : h.reason === "renewal" ? "repeat" : h.reason === "big" ? "receipt" : "calendar",
      tone: h.reason === "cancel" ? "warning" : h.reason === "big" || h.reason === "renewal" ? "negative" : "accent",
      title: headsUpTitle(h),
      body: headsUpBody(h),
      at: `${todayIso}T23:59:59.000Z`,
      href: `/recurring?focus=${encodeURIComponent(h.merchant)}`,
    });
  }

  if (month) {
    const { to } = monthRange(month);
    const lastDate = txs.map((t) => t.date).sort().at(-1) ?? to;

    // 1. Insights for the latest month. Things that need action (double
    //    charges, price increases, refunds) always make the feed; the rest by impact.
    const insights = generateInsights(txs, month, rules);
    const urgentKinds = new Set<Insight["kind"]>(["double-charge", "bill-increase", "refunds", "new-merchant"]);
    const urgent = insights.filter((i) => urgentKinds.has(i.kind));
    const ranked = insights.filter((i) => !urgentKinds.has(i.kind)).slice(0, 8);
    for (const i of [...urgent, ...ranked]) {
      const icon = i.kind === "category-change" || i.kind === "merchant-change" ? (i.tone === "down" ? "trend-down" : "trend-up") : INSIGHT_ICON[i.kind];
      const tone: NotificationTone =
        i.kind === "double-charge" ? "warning" : i.kind === "new-merchant" ? "accent" : i.tone === "up" ? "negative" : i.tone === "down" ? "positive" : "neutral";
      const href = i.merchant
        ? `/transactions?merchant=${encodeURIComponent(i.merchant)}`
        : i.category
          ? `/transactions?category=${encodeURIComponent(i.category)}&month=${month}`
          : i.kind === "subscriptions" || i.kind === "bill-increase"
            ? "/recurring"
            : i.kind === "total-change" || i.kind === "vs-average"
              ? `/changes?month=${month}`
              : `/insights?month=${month}`;
      // Anchor to the most recent related transaction so "time ago" feels real.
      const related = i.transactionIds?.length ? txs.filter((t) => i.transactionIds!.includes(t.id)).map((t) => t.date).sort().at(-1) : undefined;
      const merchantDate = i.merchant ? txs.filter((t) => t.merchant === i.merchant && t.date <= to).map((t) => t.date).sort().at(-1) : undefined;
      out.push({ id: `insight:${month}:${i.id}`, icon, tone, title: i.title, body: i.detail, at: related ?? merchantDate ?? lastDate, href });
    }

  }

  // 3. Imports
  for (const im of imports.slice(0, 6)) {
    if (im.importedCount === 0) continue;
    out.push({
      id: `import:${im.id}`,
      icon: "upload",
      tone: "neutral",
      title: `Imported ${im.importedCount} transactions into ${im.account}`,
      body: `${im.fileName}${im.duplicateCount ? ` · ${im.duplicateCount} duplicate${im.duplicateCount === 1 ? "" : "s"} skipped` : ""}${im.dateFrom && im.dateTo ? ` · ${formatDate(im.dateFrom)} – ${formatDate(im.dateTo)}` : ""}.`,
      at: im.importedAt,
      href: `/transactions?account=${encodeURIComponent(im.account)}`,
    });
  }

  const nowIso = clock.toISOString();
  return out
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((n) => ({ ...n, read: readIds.has(n.id), group: groupFor(n.at, nowIso) }));
}

function groupFor(at: string, nowIso: string): Notification["group"] {
  const days = daysBetween(at.slice(0, 10), nowIso.slice(0, 10));
  if (days <= 0) return "Today";
  if (days <= 7) return "This week";
  return "Earlier";
}


/** "2h ago", "3d ago", "Aug 14" */
export function timeAgo(at: string, now: Date = new Date()): string {
  const d = at.length > 10 ? new Date(at) : new Date(`${at}T12:00:00Z`);
  const diff = now.getTime() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  if (days <= 30) return `${Math.round(days / 7)}w ago`;
  return formatDate(at.slice(0, 10), days > 300 ? { year: "numeric" } : {});
}
