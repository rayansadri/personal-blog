export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0 text-ink">
      <rect x="1" y="1" width="22" height="22" rx="7" fill="currentColor" />
      <circle cx="12" cy="12" r="5.25" fill="none" stroke="var(--ink-inverse)" strokeWidth="2" />
      <path d="M15.8 15.8 19 19" stroke="var(--ink-inverse)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
