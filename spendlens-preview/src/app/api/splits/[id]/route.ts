import { NextResponse } from "next/server";
import { deleteSplit, settleShare } from "@/lib/db/splits";

export const runtime = "nodejs";

/** PATCH { personId, settled } marks one share paid / unpaid. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { personId: string | null; settled: boolean };
  settleShare(id, body.personId ?? null, Boolean(body.settled));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteSplit(id);
  return NextResponse.json({ ok: true });
}
