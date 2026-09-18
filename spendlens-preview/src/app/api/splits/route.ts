import { NextResponse } from "next/server";
import { getSplitForTransaction, listPeople, listSplits, saveSplit } from "@/lib/db/splits";
import { computeShares, type ShareInput } from "@/lib/splits";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const txId = new URL(req.url).searchParams.get("transactionId");
  if (txId) return NextResponse.json({ split: getSplitForTransaction(txId), people: listPeople() });
  return NextResponse.json({ splits: listSplits(), people: listPeople() });
}

/** POST { transactionId, shares: ShareInput[], note? } */
export async function POST(req: Request) {
  const body = (await req.json()) as { transactionId?: string; shares?: ShareInput[]; note?: string | null };
  if (!body.transactionId || !body.shares?.length) return NextResponse.json({ error: "transactionId and shares are required" }, { status: 400 });
  const tx = getDb().prepare(`SELECT amount FROM transactions WHERE id = ?`).get(body.transactionId) as { amount: number } | undefined;
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  const shares = computeShares(Math.abs(tx.amount), body.shares);
  const sum = shares.reduce((a, s) => a + s.amount, 0);
  if (Math.abs(sum - Math.abs(tx.amount)) > 0.02) return NextResponse.json({ error: "Shares must add up to the total" }, { status: 400 });
  return NextResponse.json({ split: saveSplit(body.transactionId, shares, body.note ?? null) });
}
