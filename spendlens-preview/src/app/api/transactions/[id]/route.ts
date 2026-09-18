import { NextResponse } from "next/server";
import { setMerchantCategory, updateTransaction } from "@/lib/db/repository";
import { CATEGORIES, type Category } from "@/lib/types";

export const runtime = "nodejs";

/** PATCH { category?, recurring?, applyToMerchant? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { category?: Category; recurring?: boolean; applyToMerchant?: boolean };
  if (body.category && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  const tx = updateTransaction(id, { category: body.category, recurring: body.recurring });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let updated = 1;
  if (body.category && body.applyToMerchant) updated = setMerchantCategory(tx.merchant, body.category);
  return NextResponse.json({ transaction: tx, updated });
}
