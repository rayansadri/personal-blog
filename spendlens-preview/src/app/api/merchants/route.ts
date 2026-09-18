import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = getDb()
    .prepare(`SELECT merchant, COUNT(*) as n FROM transactions WHERE transaction_type = 'expense' GROUP BY merchant ORDER BY n DESC`)
    .all() as { merchant: string; n: number }[];
  return NextResponse.json({ merchants: rows });
}
