import { NextResponse } from "next/server";
import { detectRecurring } from "@/lib/analytics/recurring";
import { buildHeadsUp } from "@/lib/analytics/headsUp";
import { deleteSubscriptionRule, upsertSubscriptionRule } from "@/lib/db/subscriptions";
import { loadRules, loadTransactions, refreshRecurringFlags } from "@/lib/server/data";
import type { SubscriptionRule } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const txs = loadTransactions();
  const rules = loadRules();
  return NextResponse.json({ subscriptions: detectRecurring(txs, rules), headsUp: buildHeadsUp(txs, rules), rules });
}

/** POST a rule: { merchant, status?, reminderDays?, amount?, cadence?, nextDate?, category?, note?, manual? } */
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<SubscriptionRule> & { merchant?: string };
  const merchant = (body.merchant ?? "").trim();
  if (!merchant) return NextResponse.json({ error: "Merchant is required" }, { status: 400 });
  if (body.status && !["confirmed", "ignored", "cancel"].includes(body.status)) return NextResponse.json({ error: "Bad status" }, { status: 400 });
  if (body.reminderDays != null && (body.reminderDays < 0 || body.reminderDays > 30)) return NextResponse.json({ error: "Reminder must be 0–30 days" }, { status: 400 });
  const rule = upsertSubscriptionRule({ ...body, merchant });
  refreshRecurringFlags();
  return NextResponse.json({ rule });
}

/** DELETE ?merchant=... removes the rule (back to pure detection). */
export async function DELETE(req: Request) {
  const merchant = new URL(req.url).searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });
  deleteSubscriptionRule(merchant);
  refreshRecurringFlags();
  return NextResponse.json({ ok: true });
}
