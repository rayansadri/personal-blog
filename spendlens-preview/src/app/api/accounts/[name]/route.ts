import { NextResponse } from "next/server";
import { deleteAccount, getAccount, renameAccount, upsertAccount } from "@/lib/db/accounts";
import type { Account } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const current = getAccount(decodeURIComponent(name));
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as Partial<Account>;
  let target = current.name;
  if (body.name && body.name.trim() && body.name.trim() !== current.name) {
    target = body.name.trim();
    renameAccount(current.name, target);
  }
  const account = upsertAccount({
    ...body,
    name: target,
    last4: body.last4 === undefined ? undefined : body.last4 ? body.last4.replace(/\D/g, "").slice(-4) : null,
  });
  return NextResponse.json({ account });
}

/** DELETE ?transactions=true also removes the card's transactions. */
export async function DELETE(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const withTx = new URL(req.url).searchParams.get("transactions") === "true";
  deleteAccount(decodeURIComponent(name), withTx);
  return NextResponse.json({ ok: true });
}
