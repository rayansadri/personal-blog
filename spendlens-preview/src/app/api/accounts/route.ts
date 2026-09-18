import { NextResponse } from "next/server";
import { listAccounts, upsertAccount } from "@/lib/db/accounts";
import { ACCOUNT_KINDS, CARD_THEMES, type Account } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ accounts: listAccounts() });
}

/** POST a card. Creates or updates by name. */
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Account>;
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A card name is required" }, { status: 400 });
  if (body.kind && !ACCOUNT_KINDS.includes(body.kind)) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  if (body.theme && !CARD_THEMES.includes(body.theme)) return NextResponse.json({ error: "Unknown theme" }, { status: 400 });
  const last4 = body.last4 ? body.last4.replace(/\D/g, "").slice(-4) : null;
  const account = upsertAccount({
    name,
    nickname: body.nickname?.trim() || null,
    last4: last4 || null,
    holder: body.holder?.trim() || null,
    kind: body.kind,
    theme: body.theme,
    network: body.network?.trim() || null,
  });
  return NextResponse.json({ account });
}
