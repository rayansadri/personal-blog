import { NextResponse } from "next/server";
import { analyzeChanges } from "@/lib/analytics/changes";
import { latestMonth } from "@/lib/analytics/core";
import { loadTransactions } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const txs = loadTransactions();
  const month = new URL(req.url).searchParams.get("month") || latestMonth(txs);
  if (!month) return NextResponse.json({ empty: true });
  return NextResponse.json(analyzeChanges(txs, month));
}
