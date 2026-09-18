"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnMapping } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { money } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface Queued {
  id: string;
  name: string;
  text: string;
  status: "detecting" | "ready" | "needs-mapping" | "importing" | "done" | "error";
  preset: string | null;
  rowCount: number;
  minDate: string | null;
  maxDate: string | null;
  outflow: number;
  inflow: number;
  mapping: ColumnMapping | null;
  account: string;
  imported?: number;
  duplicates?: number;
  error?: string;
}

/**
 * Drop every statement you have. Files with a recognised bank format are
 * imported in one go, oldest first; anything unrecognised is handed to the
 * single-file wizard for column mapping.
 */
export function BulkImport({ files, onDone, onNeedsMapping, onCancel }: { files: File[]; onDone: () => void; onNeedsMapping: (file: { name: string; text: string }) => void; onCancel: () => void }) {
  const router = useRouter();
  const [queue, setQueue] = useState<Queued[]>([]);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Read + detect once.
  if (!loaded) {
    setLoaded(true);
    Promise.all(
      files.map(async (f, i) => {
        const text = await f.text();
        const id = `${i}-${f.name}`;
        const base: Queued = { id, name: f.name, text, status: "detecting", preset: null, rowCount: 0, minDate: null, maxDate: null, outflow: 0, inflow: 0, mapping: null, account: "" };
        try {
          const res = await fetch("/api/import/preview", { method: "POST", body: JSON.stringify({ text }) });
          const p = (await res.json()) as { preset: string | null; rowCount: number; suggestedMapping: ColumnMapping; summary: { outflow: number; inflow: number; minDate: string | null; maxDate: string | null; unreadable: number } };
          const ok = p.preset != null && p.summary.unreadable / Math.max(1, p.rowCount) < 0.05;
          return { ...base, status: ok ? "ready" : "needs-mapping", preset: p.preset, rowCount: p.rowCount, minDate: p.summary.minDate, maxDate: p.summary.maxDate, outflow: p.summary.outflow, inflow: p.summary.inflow, mapping: p.suggestedMapping, account: p.preset ?? guessAccount(f.name) } as Queued;
        } catch {
          return { ...base, status: "error", error: "Could not read this file" } as Queued;
        }
      }),
    ).then((q) => setQueue(q.sort((a, b) => (a.minDate ?? "").localeCompare(b.minDate ?? ""))));
  }

  const ready = queue.filter((q) => q.status === "ready");
  const needs = queue.filter((q) => q.status === "needs-mapping");
  const done = queue.filter((q) => q.status === "done");

  const setAccount = (id: string, account: string) => setQueue((q) => q.map((x) => (x.id === id ? { ...x, account } : x)));

  const importAll = async () => {
    setStarted(true);
    setRunning(true);
    for (const item of ready) {
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "importing" } : x)));
      try {
        const res = await fetch("/api/import/commit", { method: "POST", body: JSON.stringify({ text: item.text, fileName: item.name, account: item.account || item.preset || "Imported", mapping: item.mapping }) });
        const d = (await res.json()) as { import?: { importedCount: number }; duplicateCount?: number; error?: string };
        if (!res.ok || !d.import) throw new Error(d.error ?? "Import failed");
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "done", imported: d.import!.importedCount, duplicates: d.duplicateCount ?? 0 } : x)));
      } catch (e) {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "error", error: (e as Error).message } : x)));
      }
    }
    setRunning(false);
    router.refresh();
  };

  const totalRows = queue.reduce((a, q) => a + q.rowCount, 0);
  const span = queue.filter((q) => q.minDate).length ? `${formatDate(queue.map((q) => q.minDate!).filter(Boolean).sort()[0])} → ${formatDate(queue.map((q) => q.maxDate!).filter(Boolean).sort().at(-1)!, { year: "numeric" })}` : "";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">{files.length} files · {totalRows.toLocaleString()} rows</h3>
            <p className="mt-0.5 text-[13px] text-ink-muted">{span || "Reading files…"}{ready.length ? ` · ${ready.length} recognised` : ""}{needs.length ? ` · ${needs.length} need column mapping` : ""}</p>
          </div>
          {!started && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
        </div>
        <ul className="mt-4 divide-y divide-line">
          {queue.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px]", q.status === "done" ? "bg-positive-soft text-positive" : q.status === "error" ? "bg-negative-soft text-negative" : q.status === "needs-mapping" ? "bg-warning-soft text-warning" : "bg-surface-2 text-ink-muted")}>
                {q.status === "done" ? "✓" : q.status === "error" ? "!" : q.status === "needs-mapping" ? "?" : q.status === "importing" ? "…" : q.status === "detecting" ? "·" : "•"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{q.name}</p>
                <p className="text-[12px] text-ink-muted">
                  {q.status === "detecting" && "Reading…"}
                  {q.status !== "detecting" && q.rowCount > 0 && `${q.rowCount} rows${q.minDate && q.maxDate ? ` · ${formatDate(q.minDate)} – ${formatDate(q.maxDate, { year: "numeric" })}` : ""} · out ${money(q.outflow)} · in ${money(q.inflow)}`}
                  {q.status === "done" && ` · imported ${q.imported}${q.duplicates ? `, ${q.duplicates} duplicates skipped` : ""}`}
                  {q.status === "error" && ` · ${q.error}`}
                </p>
              </div>
              {q.preset && <Badge tone="accent">{q.preset}</Badge>}
              {q.status === "ready" && !started && (
                <input value={q.account} onChange={(e) => setAccount(q.id, e.target.value)} placeholder="Account name" className="h-8 w-40 rounded-lg border border-line bg-surface px-2.5 text-[16px] outline-none focus:border-ink sm:text-[13px]" aria-label={`Account name for ${q.name}`} />
              )}
              {q.status === "needs-mapping" && (
                <Button size="sm" variant="secondary" onClick={() => onNeedsMapping({ name: q.name, text: q.text })}>Map columns</Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {!started ? (
          <Button onClick={importAll} disabled={!ready.length || queue.some((q) => q.status === "detecting")}>
            Import {ready.length} {ready.length === 1 ? "file" : "files"}
          </Button>
        ) : running ? (
          <Button disabled>Importing… {done.length}/{ready.length + done.length}</Button>
        ) : (
          <>
            <Button onClick={onDone}>Done · view Habits</Button>
            {needs.length > 0 && <span className="text-[13px] text-ink-secondary">{needs.length} file{needs.length === 1 ? "" : "s"} still need column mapping above.</span>}
          </>
        )}
        {!started && <p className="text-[12.5px] text-ink-muted">Same account across files? Give them the same name so statements stitch together. Overlaps are deduplicated.</p>}
      </div>
    </div>
  );
}

function guessAccount(fileName: string): string {
  return fileName.replace(/\.csv$/i, "").replace(/[-_]+/g, " ").replace(/\d{4}[-_ ]?\d{2}([-_ ]?\d{2})?/g, "").trim().replace(/\b\w/g, (c) => c.toUpperCase()) || "Imported account";
}
