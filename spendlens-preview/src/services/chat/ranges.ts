import { addMonths, monthRange } from "@/lib/dates";
import type { Period } from "@/lib/analytics/metrics";

/** How the model asks for a date range. Presets resolve relative to the latest month in the data, not today. */
export interface DateRangeInput {
  preset?: "this_month" | "last_month" | "last_3_months" | "last_6_months" | "last_12_months" | "this_year" | "last_year" | "all";
  month?: string; // YYYY-MM
  year?: string; // YYYY
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
}

export interface ResolvedRange extends Period {
  label: string;
  months: number;
}

export function resolveRange(input: DateRangeInput | undefined, latestMonth: string, firstMonth: string): ResolvedRange {
  const r = (start: string, end: string, label: string): ResolvedRange => ({ start, end, label, months: monthsBetween(start.slice(0, 7), end.slice(0, 7)) });
  if (!input || (!input.preset && !input.month && !input.year && !input.start)) input = { preset: "last_3_months" };
  if (input.start && input.end) return r(input.start, input.end, `${input.start} to ${input.end}`);
  if (input.month && /^\d{4}-\d{2}$/.test(input.month)) {
    const m = monthRange(input.month);
    return r(m.from, m.to, monthName(input.month));
  }
  if (input.year && /^\d{4}$/.test(input.year)) return r(`${input.year}-01-01`, `${input.year}-12-31`, input.year);
  const lastRange = monthRange(latestMonth);
  switch (input.preset) {
    case "this_month":
      return r(lastRange.from, lastRange.to, monthName(latestMonth));
    case "last_month": {
      const m = monthRange(addMonths(latestMonth, -1));
      return r(m.from, m.to, monthName(addMonths(latestMonth, -1)));
    }
    case "last_6_months":
      return r(monthRange(addMonths(latestMonth, -5)).from, lastRange.to, "the last 6 months");
    case "last_12_months":
      return r(monthRange(addMonths(latestMonth, -11)).from, lastRange.to, "the last 12 months");
    case "this_year":
      return r(`${latestMonth.slice(0, 4)}-01-01`, lastRange.to, latestMonth.slice(0, 4));
    case "last_year": {
      const y = String(Number(latestMonth.slice(0, 4)) - 1);
      return r(`${y}-01-01`, `${y}-12-31`, y);
    }
    case "all":
      return r(monthRange(firstMonth).from, lastRange.to, "all available history");
    case "last_3_months":
    default:
      return r(monthRange(addMonths(latestMonth, -2)).from, lastRange.to, "the last 3 months");
  }
}

export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am) + 1;
}

export function monthName(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export const DATE_RANGE_SCHEMA = {
  type: "object",
  description: "A date range. Prefer a preset; presets are relative to the most recent month of data, not the calendar.",
  properties: {
    preset: { type: "string", enum: ["this_month", "last_month", "last_3_months", "last_6_months", "last_12_months", "this_year", "last_year", "all"] },
    month: { type: "string", description: "A single month, YYYY-MM" },
    year: { type: "string", description: "A calendar year, YYYY" },
    start: { type: "string", description: "YYYY-MM-DD, with end" },
    end: { type: "string", description: "YYYY-MM-DD, with start" },
  },
  additionalProperties: false,
};
