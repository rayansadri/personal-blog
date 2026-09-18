import { NextResponse } from "next/server";
import { loadBehaviorBundle } from "@/lib/server/behavior";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deterministic behavior report plus its (validated) interpretation. */
export async function GET() {
  const bundle = await loadBehaviorBundle();
  if (!bundle) return NextResponse.json({ empty: true });
  return NextResponse.json(bundle);
}
