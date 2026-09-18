import { NextResponse } from "next/server";
import { deleteImport } from "@/lib/db/repository";
import { refreshRecurringFlags } from "@/lib/server/data";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteImport(id);
  refreshRecurringFlags();
  return NextResponse.json({ ok: true });
}
