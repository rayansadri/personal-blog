"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

const ITEMS: Array<{ href: string; label: string; short: string; icon: React.ReactNode }> = [
  { href: "/", label: "Home", short: "Home", icon: <IconHome /> },
  { href: "/ask", label: "Ask", short: "Ask", icon: <IconChat /> },
  { href: "/money-dna", label: "Money DNA", short: "DNA", icon: <IconDna /> },
  { href: "/transactions", label: "Transactions", short: "Activity", icon: <IconList /> },
  { href: "/import", label: "Import", short: "Import", icon: <IconUpload /> },
];

/** Drill-down routes that are reachable from context but not from the main nav. */
const HIDDEN_PARENT: Record<string, string> = { "/changes": "/", "/insights": "/", "/upcoming": "/", "/recurring": "/transactions", "/splits": "/transactions", "/cards": "/import", "/habits": "/money-dna", "/timeline": "/money-dna", "/patterns": "/money-dna" };

export function Nav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const parent = Object.entries(HIDDEN_PARENT).find(([k]) => pathname.startsWith(k))?.[1];
  const effective = parent ?? pathname;
  const isActive = (href: string) => (href === "/" ? effective === "/" : effective.startsWith(href));

  if (mobile) {
    return (
      <nav className="grid grid-cols-5 items-stretch px-1">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className={clsx("flex flex-col items-center gap-1 px-1 py-2.5 text-[10.5px] font-medium", isActive(it.href) ? "text-accent" : "text-ink-muted")}>
            <span className="[&>svg]:h-5 [&>svg]:w-5">{it.icon}</span>
            <span className="whitespace-nowrap">{it.short}</span>
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={clsx(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
            isActive(it.href) ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-secondary hover:bg-surface/70 hover:text-ink",
          )}
        >
          <span className="text-ink-muted [&>svg]:h-[18px] [&>svg]:w-[18px]">{it.icon}</span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function IconDna() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M6 3c0 6 12 6 12 12M18 3c0 6-12 6-12 12M6 21c0-2 1-3.5 3-4.5M18 21c0-2-1-3.5-3-4.5M8 8h8M8 16h8" />
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
    </svg>
  );
}
