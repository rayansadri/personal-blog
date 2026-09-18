import { NextResponse } from "next/server";
import { countTransactions, deleteAllData } from "@/lib/db/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ transactionCount: countTransactions() });
}

/** Erase everything. Local data, local decision. */
export async function DELETE() {
  deleteAllData();
  return NextResponse.json({ ok: true });
}
