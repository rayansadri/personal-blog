import Link from "next/link";
import { PrivacyNote } from "./PrivacyNote";

export function EmptyState({
  title = "Start with a CSV export",
  description = "Download a transaction export from your bank or card and drop it in. SpendLens will clean it up, categorize it and show you where your money went.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-2">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
        </svg>
      </div>
      <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">{description}</p>
      <Link
        href="/import"
        className="mt-6 inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-ink-inverse hover:bg-ink/90"
      >
        Import a CSV
      </Link>
      <p className="mt-3 text-[13px] text-ink-muted">
        Chase, Amex, Capital One, Bank of America, Apple Card and most other exports work out of the box.
      </p>
      <div className="mt-10 w-full">
        <PrivacyNote />
      </div>
    </div>
  );
}
