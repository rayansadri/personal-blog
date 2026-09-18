"use client";

import { useState } from "react";
import { clsx } from "@/lib/clsx";

/** "Show details" toggle. Children are server-rendered and only mounted when opened. */
export function Disclosure({ label = "Show details", openLabel = "Hide details", children, className }: { label?: string; openLabel?: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent hover:underline" aria-expanded={open}>
        <svg viewBox="0 0 24 24" className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        {open ? openLabel : label}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
