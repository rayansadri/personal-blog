import { NextResponse } from "next/server";
import { detectRecurring } from "@/lib/analytics/recurring";
import { loadRules, loadTransactions } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ recurring: detectRecurring(loadTransactions(), loadRules()) });
}
