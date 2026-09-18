import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/analytics/insights";
import { latestMonth } from "@/lib/analytics/core";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const txs = loadTransactions();
  const month = new URL(req.url).searchParams.get("month") || latestMonth(txs);
  if (!month) return NextResponse.json({ insights: [] });
  return NextResponse.json({ month, insights: generateInsights(txs, month, loadRules()) });
}
