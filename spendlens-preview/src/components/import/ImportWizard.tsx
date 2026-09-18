"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColumnMapping } from "@/lib/types";
import { money } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { clsx } from "@/lib/clsx";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { BulkImport } from "./BulkImport";

interface Preview {
  headers: string[];
  preset: string | null;
  warnings: string[];
  rowCount: number;
  sample: Record<string, string>[];
  suggestedMapping: ColumnMapping;
  summary: { outflow: number; inflow: number; outCount: number; inCount: number; unreadable: number; minDate: string | null; maxDate: string | null };
}

interface CommitResult {
  import: { importedCount: number; duplicateCount: number; account: string; fileName: string };
  skippedCount: number;
  doubleChargeCount: number;
  typeCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}

/** Demo shortcuts are a developer convenience; the production app stays blank until you import your own files. */
const SHOW_SAMPLES = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SHOW_SAMPLES === "true";

const SAMPLES = [
  { file: "chase-checking.csv", account: "Chase Checking" },
  { file: "amex-gold.csv", account: "Amex Gold" },
  { file: "capital-one-quicksilver.csv", account: "Capital One" },
];

export function ImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [bulk, setBulk] = useState<File[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = (list: FileList | null | undefined) => {
    const files = Array.from(list ?? []).filter((f) => /\.csv$/i.test(f.name) || f.type === "text/csv");
    if (!files.length) return;
    if (files.length === 1) onFile(files[0]);
    else setBulk(files);
  };

  const loadText = useCallback(async (name: string, text: string, presetAccount?: string) => {
    setError(null);
    setResult(null);
    setFile({ name, text });
    setBusy(true);
    try {
      const res = await fetch("/api/import/preview", { method: "POST", body: JSON.stringify({ text }) });
      const data = (await res.json()) as Preview & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not read file");
      setPreview(data);
      setMapping(data.suggestedMapping);
      setAccount(presetAccount ?? guessAccount(name, data.preset));
    } catch (e) {
      setError((e as Error).message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const onFile = useCallback(
    async (f: File) => {
      const text = await f.text();
      await loadText(f.name, text);
    },
    [loadText],
  );

  // Re-run preview summary when the mapping changes so the user sees the effect live.
  useEffect(() => {
    if (!file || !mapping) return;
    const ctrl = new AbortController();
    fetch("/api/import/preview", { method: "POST", body: JSON.stringify({ text: file.text, mapping }), signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: Preview) => setPreview((p) => (p ? { ...p, summary: data.summary } : p)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [file, mapping]);

  const loadSample = async (s: (typeof SAMPLES)[number]) => {
    setBusy(true);
    const res = await fetch(`/samples/${s.file}`);
    const text = await res.text();
    await loadText(s.file, text, s.account);
  };

  const commit = async () => {
    if (!file || !mapping) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        body: JSON.stringify({ text: file.text, fileName: file.name, account, mapping }),
      });
      const data = (await res.json()) as CommitResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      setFile(null);
      setPreview(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMapping(null);
    setResult(null);
    setError(null);
  };

  const mode: "amount" | "split" = useMemo(() => (mapping?.debit || mapping?.credit ? "split" : "amount"), [mapping]);

  if (result) {
    return <ImportResult result={result} onAnother={reset} />;
  }

  if (bulk) {
    return (
      <BulkImport
        files={bulk}
        onCancel={() => setBulk(null)}
        onDone={() => router.push("/habits")}
        onNeedsMapping={(f) => {
          setBulk(null);
          loadText(f.name, f.text);
        }}
      />
    );
  }

  if (!preview || !mapping) {
    return (
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center transition-colors",
            dragging ? "border-ink bg-surface" : "border-line-strong hover:bg-surface",
          )}
        >
          <input ref={inputRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>
          </div>
          <p className="text-[15px] font-medium">{busy ? "Reading file…" : "Drop your CSVs here, or click to choose"}</p>
          <p className="mt-1 text-[13px] text-ink-muted">Drop a whole year at once. Recognised formats import in one go; anything else gets a quick column mapping.</p>
        </div>
        {error && <p className="text-[13.5px] text-negative">{error}</p>}
        {SHOW_SAMPLES && (
        <Card>
          <p className="text-[13.5px] font-medium">No export handy? Try the sample data.</p>
          <p className="mt-0.5 text-[13px] text-ink-secondary">Three fictional accounts, six months, three different bank formats. Import all three.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Button key={s.file} variant="secondary" size="sm" disabled={busy} onClick={() => loadSample(s)}>
                {s.account}
              </Button>
            ))}
          </div>
        </Card>
        )}
      </div>
    );
  }

  const headers = preview.headers;
  const select = (value: string | undefined, onChange: (v: string | undefined) => void, allowNone = false) => (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13.5px] outline-none focus:border-ink"
    >
      {allowNone && <option value="">— none —</option>}
      {headers.map((h) => (
        <option key={h} value={h}>{h}</option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight">{file?.name}</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {preview.rowCount} rows
              {preview.summary.minDate && preview.summary.maxDate && ` · ${formatDate(preview.summary.minDate, { year: "numeric" })} – ${formatDate(preview.summary.maxDate, { year: "numeric" })}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {preview.preset ? <Badge tone="accent">Detected: {preview.preset}</Badge> : <Badge>Custom format</Badge>}
            <Button variant="ghost" size="sm" onClick={reset}>Change file</Button>
          </div>
        </div>
        {preview.warnings.length > 0 && (
          <ul className="mt-3 text-[12.5px] text-warning">
            {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-[15px] font-semibold tracking-tight">1. Name this account</h3>
        <p className="mt-0.5 text-[13px] text-ink-muted">Used to tell accounts apart in the explorer. Re-use the same name when you import newer statements.</p>
        <input
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="e.g. Chase Checking"
          className="mt-3 h-10 w-full max-w-sm rounded-lg border border-line px-3 text-[14px] outline-none focus:border-ink"
        />
      </Card>

      <Card>
        <h3 className="text-[15px] font-semibold tracking-tight">2. Map the columns</h3>
        <p className="mt-0.5 text-[13px] text-ink-muted">We guessed from the headers. Adjust anything that looks off.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date">{select(mapping.date, (v) => setMapping({ ...mapping, date: v ?? "" }))}</Field>
          <Field label="Description">{select(mapping.description, (v) => setMapping({ ...mapping, description: v ?? "" }))}</Field>
          <Field label="Merchant (optional)">{select(mapping.merchant, (v) => setMapping({ ...mapping, merchant: v }), true)}</Field>
          <Field label="Date order">
            <select
              value={mapping.dateOrder ?? "MDY"}
              onChange={(e) => setMapping({ ...mapping, dateOrder: e.target.value as ColumnMapping["dateOrder"] })}
              className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13.5px] outline-none focus:border-ink"
            >
              <option value="MDY">Month / Day / Year (US)</option>
              <option value="DMY">Day / Month / Year</option>
              <option value="YMD">Year - Month - Day</option>
            </select>
          </Field>
        </div>

        <div className="mt-6 flex gap-2 rounded-full bg-surface-2 p-1 text-[13px] font-medium sm:w-fit">
          <button
            onClick={() => setMapping({ ...mapping, debit: undefined, credit: undefined, amount: mapping.amount ?? headers.find((h) => /amount/i.test(h)) ?? headers[0] })}
            className={clsx("rounded-full px-3.5 py-1.5", mode === "amount" ? "bg-surface shadow-sm" : "text-ink-secondary")}
          >
            One amount column
          </button>
          <button
            onClick={() => setMapping({ ...mapping, amount: undefined, type: undefined, debit: mapping.debit ?? headers.find((h) => /debit/i.test(h)), credit: mapping.credit ?? headers.find((h) => /credit/i.test(h)) })}
            className={clsx("rounded-full px-3.5 py-1.5", mode === "split" ? "bg-surface shadow-sm" : "text-ink-secondary")}
          >
            Separate debit / credit
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mode === "amount" ? (
            <>
              <Field label="Amount">{select(mapping.amount, (v) => setMapping({ ...mapping, amount: v }))}</Field>
              <Field label="Debit / credit indicator (optional)">{select(mapping.type, (v) => setMapping({ ...mapping, type: v }), true)}</Field>
              {!mapping.type && (
                <label className="flex items-start gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={mapping.positiveIsSpending}
                    onChange={(e) => setMapping({ ...mapping, positiveIsSpending: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-ink"
                  />
                  <span className="text-[13.5px]">
                    <span className="font-medium">Positive numbers are charges</span>
                    <span className="block text-ink-muted">Common for credit card exports (Amex, Apple Card). Leave off for bank accounts where positive means a deposit.</span>
                  </span>
                </label>
              )}
            </>
          ) : (
            <>
              <Field label="Debit (money out)">{select(mapping.debit, (v) => setMapping({ ...mapping, debit: v }), true)}</Field>
              <Field label="Credit (money in)">{select(mapping.credit, (v) => setMapping({ ...mapping, credit: v }), true)}</Field>
            </>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-semibold tracking-tight">3. Check the result</h3>
        <p className="mt-0.5 text-[13px] text-ink-muted">If “money out” looks like your income, flip the sign setting above.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Mini label="Money out" value={money(preview.summary.outflow)} hint={`${preview.summary.outCount} rows`} />
          <Mini label="Money in" value={money(preview.summary.inflow)} hint={`${preview.summary.inCount} rows`} />
          <Mini label="Unreadable" value={String(preview.summary.unreadable)} hint="rows skipped" tone={preview.summary.unreadable ? "warn" : undefined} />
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-surface-2 text-ink-muted">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {headers.map((h) => (
                    <td key={h} className="max-w-[240px] truncate whitespace-nowrap px-3 py-2 text-ink-secondary">{r[h]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {error && <p className="text-[13.5px] text-negative">{error}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={commit} disabled={busy || !account.trim()}>
          {busy ? "Importing…" : `Import ${preview.rowCount} transactions`}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

function guessAccount(fileName: string, preset: string | null): string {
  if (preset && preset !== "SpendLens Standard") return preset;
  return fileName.replace(/\.csv$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}

function Mini({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <p className="text-[12px] font-medium text-ink-muted">{label}</p>
      <p className={clsx("mt-0.5 text-[20px] font-semibold tracking-tight", tone === "warn" && "text-warning")}>{value}</p>
      {hint && <p className="text-[12px] text-ink-muted">{hint}</p>}
    </div>
  );
}

function ImportResult({ result, onAnother }: { result: CommitResult; onAnother: () => void }) {
  const t = result.typeCounts;
  const cats = Object.entries(result.categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
        </span>
        <div>
          <h3 className="text-[18px] font-semibold tracking-tight">Imported {result.import.importedCount} transactions</h3>
          <p className="mt-0.5 text-[13.5px] text-ink-secondary">
            From {result.import.fileName} into “{result.import.account}”.
            {result.import.duplicateCount > 0 && ` ${result.import.duplicateCount} duplicate${result.import.duplicateCount === 1 ? "" : "s"} skipped.`}
            {result.skippedCount > 0 && ` ${result.skippedCount} unreadable row${result.skippedCount === 1 ? "" : "s"} ignored.`}
          </p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Mini label="Spending" value={String(t.expense ?? 0)} />
        <Mini label="Income" value={String(t.income ?? 0)} />
        <Mini label="Transfers & payments" value={String((t.transfer ?? 0) + (t.payment ?? 0))} hint="excluded from spending" />
        <Mini label="Refunds" value={String(t.refund ?? 0)} />
      </div>
      {result.doubleChargeCount > 0 && (
        <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-[13px] text-warning">
          {result.doubleChargeCount} charges look like possible double charges. They are flagged in the transaction explorer.
        </p>
      )}
      {cats.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {cats.map(([c, n]) => (
            <Badge key={c}>{c} · {n}</Badge>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-ink-inverse hover:bg-ink/90">View overview</Link>
        <Button variant="secondary" onClick={onAnother}>Import another file</Button>
      </div>
    </Card>
  );
}
