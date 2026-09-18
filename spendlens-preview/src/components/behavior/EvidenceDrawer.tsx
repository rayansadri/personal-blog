"use client";

import { useState } from "react";
import type { BehaviorFeature } from "@/lib/behavior";
import { formatDate } from "@/lib/dates";
import { clsx } from "@/lib/clsx";

/**
 * EPIC 10: every AI or engine claim opens to the exact features, metrics and
 * periods behind it. Nothing is shown that can't be traced.
 */
export function EvidenceDrawer({
  evidenceFeatureIds,
  featureIndex,
  extra,
  confidence,
  label = "Why am I seeing this?",
}: {
  evidenceFeatureIds: string[];
  featureIndex: Record<string, BehaviorFeature>;
  /** Evidence attached directly (timeline events, patterns). */
  extra?: Array<{ metric: string; value: number | string }>;
  confidence?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const features = evidenceFeatureIds.map((id) => featureIndex[id]).filter((f): f is BehaviorFeature => Boolean(f));
  const otherIds = evidenceFeatureIds.filter((id) => !featureIndex[id]);
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline" aria-expanded={open}>
        <svg viewBox="0 0 24 24" className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        {label}
        {confidence != null && <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-muted">{Math.round(confidence * 100)}% confidence</span>}
      </button>
      {open && (
        <div className="mt-2 rounded-2xl bg-surface-2 p-3.5 text-[12.5px]">
          {extra && extra.length > 0 && (
            <ul className="mb-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {extra.map((e, i) => (
                <li key={i} className="flex justify-between gap-3 rounded-lg bg-surface px-2.5 py-1.5">
                  <span className="truncate text-ink-secondary">{e.metric.replace(/_/g, " ")}</span>
                  <span className="tabular shrink-0 font-medium">{fmtVal(e.value)}</span>
                </li>
              ))}
            </ul>
          )}
          {features.map((f) => (
            <div key={f.id} className="mb-3 last:mb-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">{f.type}</span>
                {f.label}
              </p>
              <p className="mt-0.5 text-ink-muted">
                {formatDate(f.period.start, { year: "numeric" })} → {formatDate(f.period.end, { year: "numeric" })}
                {f.comparisonPeriod && <> · vs {formatDate(f.comparisonPeriod.start, { year: "numeric" })} → {formatDate(f.comparisonPeriod.end, { year: "numeric" })}</>}
                {" · "}strength {Math.round(f.strength * 100)}% · confidence {Math.round(f.confidence * 100)}%
              </p>
              <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {f.evidence.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3 rounded-lg bg-surface px-2.5 py-1.5">
                    <span className="truncate text-ink-secondary">{e.metric.replace(/_/g, " ")}</span>
                    <span className="tabular shrink-0 font-medium">{fmtVal(e.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {otherIds.length > 0 && <p className="text-ink-muted">Also cites: {otherIds.join(", ")}</p>}
          {!features.length && !extra?.length && <p className="text-ink-muted">No evidence attached. This claim should not be here; please report it.</p>}
        </div>
      )}
    </div>
  );
}

export function fmtVal(v: number | string): string {
  if (typeof v !== "number") return v;
  if (Math.abs(v) >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
  if (Math.abs(v) >= 100) return `$${v.toFixed(0)}`;
  return `${Math.round(v * 100) / 100}`;
}
