import { NextResponse } from "next/server";
import { parseCsv, resolveAmount, parseDate } from "@/lib/csv/parse";
import type { ColumnMapping } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST { text, mapping? } -> headers, sample rows, suggested mapping and a
 * dry-run summary (how many rows would be spending vs income) so the user can
 * verify the sign convention before importing.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; mapping?: ColumnMapping };
  if (!body.text) return NextResponse.json({ error: "Missing CSV text" }, { status: 400 });

  const parsed = parseCsv(body.text);
  const mapping = body.mapping ?? parsed.suggestedMapping;
  const summary = summarize(parsed.rows, mapping);

  return NextResponse.json({
    headers: parsed.headers,
    preset: parsed.preset,
    warnings: parsed.warnings,
    rowCount: parsed.rows.length,
    sample: parsed.rows.slice(0, 5),
    suggestedMapping: parsed.suggestedMapping,
    summary,
  });
}

function summarize(rows: Record<string, string>[], mapping: ColumnMapping) {
  let outflow = 0;
  let inflow = 0;
  let outCount = 0;
  let inCount = 0;
  let unreadable = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;
  for (const r of rows) {
    const amt = resolveAmount(r, mapping);
    const date = parseDate(r[mapping.date], mapping.dateOrder ?? "MDY");
    if (amt == null || !date) {
      unreadable++;
      continue;
    }
    if (amt < 0) {
      outflow += -amt;
      outCount++;
    } else {
      inflow += amt;
      inCount++;
    }
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
  }
  return { outflow, inflow, outCount, inCount, unreadable, minDate, maxDate };
}
