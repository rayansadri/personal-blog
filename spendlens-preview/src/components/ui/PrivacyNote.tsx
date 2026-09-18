export function PrivacyNote({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[13px] text-ink-muted">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-positive align-middle" />
        Local only. Your data never leaves this computer.
      </p>
    );
  }
  return (
    <div className="rounded-3xl bg-surface px-5 py-4 text-left shadow-[var(--shadow-card)]">
      <p className="text-[14px] font-medium leading-snug text-ink">
        “Your financial data should not need to leave your computer just to understand your spending.”
      </p>
      <p className="mt-1.5 text-[13px] text-ink-secondary">
        SpendLens runs entirely on your machine. Files are parsed locally and stored in a SQLite database in the project
        folder. There is no account, no cloud and no telemetry.
      </p>
    </div>
  );
}
