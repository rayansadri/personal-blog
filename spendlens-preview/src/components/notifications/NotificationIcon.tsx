import type { NotificationIcon as IconKind, NotificationTone } from "@/lib/analytics/notifications";
import { clsx } from "@/lib/clsx";

const TONE: Record<NotificationTone, string> = {
  neutral: "bg-surface-2 text-ink-secondary",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
};

export function NotificationIcon({ icon, tone, size = 40 }: { icon: IconKind; tone: NotificationTone; size?: number }) {
  return (
    <span className={clsx("flex shrink-0 items-center justify-center rounded-full", TONE[tone])} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[icon]}
      </svg>
    </span>
  );
}

const PATHS: Record<IconKind, React.ReactNode> = {
  "trend-up": <path d="M4 17l6-6 4 4 6-7M14 8h6v6" />,
  "trend-down": <path d="M4 7l6 6 4-4 6 7M14 16h6v-6" />,
  repeat: <path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />,
  alert: (
    <>
      <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h4" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />,
  upload: <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4M12 14h.01M8 18h.01M12 18h.01M16 14h.01" />
    </>
  ),
  refund: <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2" />,
  star: <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9 6.1 21l1.2-6.5L2.5 9.9 9.1 9z" />,
  compare: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  fork: <path d="M7 3v8a3 3 0 0 0 3 3v7M7 3v5a3 3 0 0 0 3 3M11 3v5M17 3v6a3 3 0 0 1-3 3h0v9" />,
};
