import { NextResponse } from "next/server";
import { getAccounts, queryTransactions } from "@/lib/db/repository";
import type { Category, TransactionFilters, TransactionType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  const filters: TransactionFilters = {
    from: p.get("from") || undefined,
    to: p.get("to") || undefined,
    account: p.get("account") || undefined,
    merchant: p.get("merchant") || undefined,
    category: (p.get("category") as Category) || undefined,
    type: (p.get("type") as TransactionType) || undefined,
    minAmount: num("minAmount"),
    maxAmount: num("maxAmount"),
    recurring: p.get("recurring") === "true" ? true : p.get("recurring") === "false" ? false : undefined,
    search: p.get("search") || undefined,
    includeDuplicates: p.get("includeDuplicates") === "true",
    limit: num("limit") ?? 100,
    offset: num("offset") ?? 0,
  };
  const { items, total } = queryTransactions(filters);
  return NextResponse.json({ items, total, accounts: getAccounts() });
}
