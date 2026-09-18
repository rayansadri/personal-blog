"use client";

import type { Account, CardTheme } from "@/lib/types";
import { clsx } from "@/lib/clsx";

/** Flat, restrained card colors. Text color chosen per theme for contrast. */
export const THEME_STYLES: Record<CardTheme, { bg: string; fg: string; muted: string; label: string }> = {
  graphite: { bg: "#1c1c1f", fg: "#ffffff", muted: "rgba(255,255,255,0.55)", label: "Graphite" },
  midnight: { bg: "#14213d", fg: "#ffffff", muted: "rgba(255,255,255,0.55)", label: "Midnight" },
  forest: { bg: "#1b3a2f", fg: "#ffffff", muted: "rgba(255,255,255,0.55)", label: "Forest" },
  plum: { bg: "#3b2140", fg: "#ffffff", muted: "rgba(255,255,255,0.55)", label: "Plum" },
  sand: { bg: "#e9e2d3", fg: "#1c1c1f", muted: "rgba(0,0,0,0.5)", label: "Sand" },
  slate: { bg: "#dfe3e8", fg: "#1c1c1f", muted: "rgba(0,0,0,0.5)", label: "Slate" },
};

export const KIND_LABEL: Record<Account["kind"], string> = {
  credit: "Credit card",
  debit: "Debit card",
  checking: "Checking",
  savings: "Savings",
};

export function displayName(a: Account): string {
  return a.nickname?.trim() || a.name;
}

export function CardTile({
  account,
  size = "md",
  selected = false,
  onClick,
  className,
}: {
  account: Account;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const t = THEME_STYLES[account.theme] ?? THEME_STYLES.graphite;
  const dims = size === "lg" ? "h-[190px] w-[300px]" : size === "md" ? "h-[150px] w-[240px]" : "h-[64px] w-[104px]";
  const isBank = account.kind === "checking" || account.kind === "savings";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "relative shrink-0 overflow-hidden rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.12)] outline-none transition-transform duration-300 ease-out",
        dims,
        onClick && "cursor-pointer hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        className,
      )}
      style={{ background: t.bg, color: t.fg }}
    >
      {/* Subtle geometric texture, no gradients. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 190" preserveAspectRatio="xMidYMid slice">
        <path d="M150 0 L300 0 L300 120 Z" fill={t.fg} opacity="0.045" />
        <path d="M190 190 L300 70 L300 190 Z" fill={t.fg} opacity="0.035" />
        <circle cx="236" cy="52" r="70" fill="none" stroke={t.fg} strokeOpacity="0.07" strokeWidth="1" />
      </svg>

      {size === "sm" ? (
        <div className="absolute inset-0 flex flex-col justify-between p-2.5">
          <span className="truncate text-[10px] font-medium" style={{ color: t.muted }}>{displayName(account)}</span>
          <span className="text-[11px] font-semibold tracking-wider">{account.last4 ? `•••• ${account.last4}` : KIND_LABEL[account.kind]}</span>
        </div>
      ) : (
        <div className={clsx("absolute inset-0 flex flex-col justify-between", size === "lg" ? "p-5" : "p-4")}>
          <div className="flex items-start justify-between gap-3">
            <span className={clsx("font-medium", size === "lg" ? "text-[14px]" : "text-[12.5px]")} style={{ color: t.muted }}>
              {KIND_LABEL[account.kind]}
            </span>
            {!isBank && (
              <span className="flex gap-0.5" aria-hidden>
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.fg, opacity: 0.85 }} />
                <span className="-ml-1.5 h-3.5 w-3.5 rounded-full" style={{ background: t.fg, opacity: 0.45 }} />
              </span>
            )}
          </div>
          <div>
            <p className={clsx("truncate font-semibold tracking-tight", size === "lg" ? "text-[19px]" : "text-[15px]")}>{displayName(account)}</p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <span className={clsx("tracking-[0.12em]", size === "lg" ? "text-[14px]" : "text-[12.5px]")}>
                {account.last4 ? `•••• ${account.last4}` : "•••• ••••"}
              </span>
              {account.holder && (
                <span className={clsx("truncate", size === "lg" ? "text-[12.5px]" : "text-[11px]")} style={{ color: t.muted }}>
                  {account.holder}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </button>
  );
}
