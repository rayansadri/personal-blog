import { NextResponse } from "next/server";
import { deletePerson, listPeople, upsertPerson } from "@/lib/db/splits";
import type { Person } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ people: listPeople() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Person>;
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  return NextResponse.json({ person: upsertPerson({ ...body, name: body.name }) });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  deletePerson(id);
  return NextResponse.json({ ok: true });
}
