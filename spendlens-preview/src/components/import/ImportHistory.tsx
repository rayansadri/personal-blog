"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportRecord } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export function ImportHistory() {
  const router = useRouter();
  const [imports, setImports] = useState<ImportRecord[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(() => {
    fetch("/api/imports").then((r) => r.json()).then((d) => setImports(d.imports));
  }, []);
  useEffect(load, [load]);

  // Refresh when a new import completes (router.refresh re-renders server components; poll lightly here).
  useEffect(() => {
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  const remove = async (id: string) => {
    await fetch(`/api/imports/${id}`, { method: "DELETE" });
    load();
    router.refresh();
  };
  const resetAll = async () => {
    await fetch("/api/data", { method: "DELETE" });
    setConfirmReset(false);
    load();
    router.refresh();
  };

  return (
    <Card>
      <h3 className="text-[15px] font-semibold tracking-tight">Your files</h3>
      {imports == null ? (
        <p className="mt-2 text-[13px] text-ink-muted">Loading…</p>
      ) : imports.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-muted">Nothing imported yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {imports.map((im) => (
            <li key={im.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium">{im.account}</p>
                <p className="truncate text-[12px] text-ink-muted">{im.fileName}</p>
                <p className="text-[12px] text-ink-muted">
                  {im.importedCount} rows
                  {im.dateFrom && im.dateTo && ` · ${formatDate(im.dateFrom)} – ${formatDate(im.dateTo, { year: "numeric" })}`}
                </p>
              </div>
              <button onClick={() => remove(im.id)} className="shrink-0 text-[12.5px] text-ink-muted hover:text-negative" aria-label={`Remove ${im.fileName}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {imports && imports.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-secondary">Delete everything?</span>
              <Button variant="danger" size="sm" onClick={resetAll}>Yes, erase all data</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="text-[13px] text-ink-muted hover:text-negative">
              Erase all local data
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
