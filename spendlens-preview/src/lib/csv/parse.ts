import Papa from "papaparse";
import type { ColumnMapping, DateOrder, RawRow } from "../types";
import { detectPreset } from "./presets";

export interface ParsedCsv {
  headers: string[];
  rows: RawRow[];
  /** Best-guess mapping (user may adjust). */
  suggestedMapping: ColumnMapping;
  /** Name of the matched bank preset, if any. */
  preset: string | null;
  /** Non-fatal problems encountered while parsing. */
  warnings: string[];
}

/** Parse CSV text into rows keyed by header, and propose a column mapping. */
export function parseCsv(text: string): ParsedCsv {
  // Some banks prepend metadata lines before the real header. Skip until a
  // line that looks like a header (>= 2 delimited cells, no digits-only cells).
  const cleaned = stripPreamble(text.replace(/^﻿/, ""));
  const result = Papa.parse<RawRow>(cleaned, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const warnings: string[] = [];
  const headers = (result.meta.fields ?? []).filter((h) => h.length > 0);
  const rows = result.data.filter((r) => Object.values(r).some((v) => (v ?? "").trim() !== ""));

  if (result.errors.length) {
    const shown = result.errors.slice(0, 3).map((e) => `Row ${e.row ?? "?"}: ${e.message}`);
    warnings.push(...shown);
  }
  if (!headers.length) warnings.push("No header row detected.");

  const preset = detectPreset(headers);
  const suggestedMapping = preset ? preset.mapping : suggestMapping(headers, rows);

  return { headers, rows, suggestedMapping, preset: preset?.name ?? null, warnings };
}

function stripPreamble(text: string): string {
  const lines = text.split(/\r?\n/);
  let start = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const looksLikeHeader =
      cells.length >= 2 &&
      cells.filter((c) => c.length > 0).length >= 2 &&
      cells.every((c) => !/^-?\$?[\d,.]+$/.test(c) || c === "");
    if (looksLikeHeader) {
      start = i;
      break;
    }
  }
  return lines.slice(start).join("\n");
}

const DATE_HEADERS = [/^(transaction |trans |posting |posted |post )?date$/i, /date/i];
const DESC_HEADERS = [/^description$/i, /^memo$/i, /^details?$/i, /^narrative$/i, /^payee$/i, /^name$/i, /descr/i];
const MERCHANT_HEADERS = [/^merchant( name)?$/i, /^payee$/i, /^name$/i];
const AMOUNT_HEADERS = [/^amount$/i, /^transaction amount$/i, /amount/i, /^value$/i];
const DEBIT_HEADERS = [/^debit$/i, /^withdrawals?$/i, /^money out$/i, /^paid out$/i, /debit/i];
const CREDIT_HEADERS = [/^credit$/i, /^deposits?$/i, /^money in$/i, /^paid in$/i, /credit/i];
const TYPE_HEADERS = [/^type$/i, /^transaction type$/i, /^debit\/credit$/i, /^cr\/dr$/i, /^details$/i];

function pick(headers: string[], patterns: RegExp[], exclude: string[] = []): string | undefined {
  for (const p of patterns) {
    const found = headers.find((h) => !exclude.includes(h) && p.test(h));
    if (found) return found;
  }
  return undefined;
}

/** Heuristic column mapping for unknown formats. */
export function suggestMapping(headers: string[], rows: RawRow[]): ColumnMapping {
  const date = pick(headers, DATE_HEADERS) ?? headers[0] ?? "";
  const description = pick(headers, DESC_HEADERS, [date]) ?? headers[1] ?? "";
  const merchant = pick(headers, MERCHANT_HEADERS, [date, description]);
  const debit = pick(headers, DEBIT_HEADERS, [date, description]);
  const credit = pick(headers, CREDIT_HEADERS, [date, description, debit ?? ""]);
  const amount = pick(headers, AMOUNT_HEADERS, [date, description, debit ?? "", credit ?? ""]);
  const type = pick(headers, TYPE_HEADERS, [date, description, amount ?? "", debit ?? "", credit ?? ""]);

  const useSplit = Boolean(debit && credit && !amount);
  const mapping: ColumnMapping = {
    date,
    description,
    merchant,
    positiveIsSpending: false,
    dateOrder: detectDateOrder(rows.map((r) => r[date] ?? "")),
  };
  if (useSplit) {
    mapping.debit = debit;
    mapping.credit = credit;
  } else if (amount) {
    mapping.amount = amount;
    // A type column lets us derive the sign; otherwise infer from the data.
    if (type && hasTypeIndicator(rows.map((r) => r[type] ?? ""))) {
      mapping.type = type;
    } else {
      mapping.positiveIsSpending = guessPositiveIsSpending(rows.map((r) => r[amount] ?? ""));
    }
  } else if (debit) {
    mapping.amount = debit;
    mapping.positiveIsSpending = true;
  }
  return mapping;
}

function hasTypeIndicator(values: string[]): boolean {
  const v = values.map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!v.length) return false;
  const hits = v.filter((x) => /^(debit|credit|dr|cr|sale|payment|purchase|refund|return|withdrawal|deposit)$/.test(x));
  return hits.length / v.length > 0.6;
}

/** If most amounts in a file are positive, positive very likely means spending (credit card export). */
export function guessPositiveIsSpending(values: string[]): boolean {
  const nums = values.map(parseAmount).filter((n): n is number => n !== null && n !== 0);
  if (nums.length < 3) return false;
  const positive = nums.filter((n) => n > 0).length;
  return positive / nums.length >= 0.75;
}

/** Parse "$1,234.56", "(12.34)", "-12.34", "12.34-", "€10" etc. */
export function parseAmount(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/-$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (/^-/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  if (/^\+/.test(s)) s = s.slice(1);
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  // European style "1.234,56"
  if (/,\d{2}$/.test(s) && !/\.\d{2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Detect whether numeric dates are M/D/Y or D/M/Y by looking for values > 12. */
export function detectDateOrder(values: string[]): DateOrder {
  let firstOver12 = 0;
  let secondOver12 = 0;
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})/);
    if (!m) continue;
    if (m[1].length === 4) return "YMD";
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) firstOver12++;
    if (b > 12) secondOver12++;
  }
  if (firstOver12 > 0 && secondOver12 === 0) return "DMY";
  return "MDY";
}

/** Parse many common date formats to ISO YYYY-MM-DD. Returns null when unparseable. */
export function parseDate(raw: string | undefined | null, order: DateOrder = "MDY"): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO: 2026-08-14 or 2026-08-14T10:00:00
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));

  // Numeric with separators
  m = s.match(/^(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let c = Number(m[3]);
    if (m[1].length === 4) return build(a, b, c); // Y/M/D
    if (m[3].length === 2) c += c < 70 ? 2000 : 1900;
    if (order === "DMY") [a, b] = [b, a];
    return build(c, a, b);
  }

  // "Aug 14, 2026" / "14 Aug 2026" / "August 14 2026"
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon) return build(Number(m[3]), mon, Number(m[2]));
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) return build(Number(m[3]), mon, Number(m[1]));
  }

  // Compact: 20260814
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return build(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return null;
}

function build(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Resolve the signed amount for a row using the mapping. Negative = money out. */
export function resolveAmount(row: RawRow, mapping: ColumnMapping): number | null {
  if (mapping.debit || mapping.credit) {
    const debit = mapping.debit ? parseAmount(row[mapping.debit]) : null;
    const credit = mapping.credit ? parseAmount(row[mapping.credit]) : null;
    if (debit != null && debit !== 0) return -Math.abs(debit);
    if (credit != null && credit !== 0) return Math.abs(credit);
    if (debit === 0 || credit === 0) return 0;
    return null;
  }
  if (!mapping.amount) return null;
  const n = parseAmount(row[mapping.amount]);
  if (n == null) return null;

  if (mapping.type) {
    const t = (row[mapping.type] ?? "").trim().toLowerCase();
    if (/^(debit|dr|sale|purchase|withdrawal|fee|debit card|pos)$/.test(t) || t.startsWith("debit")) {
      return -Math.abs(n);
    }
    if (/^(credit|cr|payment|refund|return|deposit|dslip|ach_credit)$/.test(t) || t.startsWith("credit")) {
      return Math.abs(n);
    }
  }
  return mapping.positiveIsSpending ? -n : n;
}
