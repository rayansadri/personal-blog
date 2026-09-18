import { NextResponse } from "next/server";
import { buildUpcoming } from "@/lib/analytics/forecast";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildUpcoming(loadTransactions(), 30, undefined, loadRules()));
}
