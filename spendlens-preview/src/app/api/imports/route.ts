import { NextResponse } from "next/server";
import { listImports } from "@/lib/db/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ imports: listImports() });
}
