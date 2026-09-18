import type { Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { clsx } from "@/lib/clsx";

/**
 * Deterministic monogram for a merchant: initials on a tinted disc in the
 * merchant's category color. No network, no logo fetching, works offline.
 */
export function MerchantAvatar({ name, category, size = 40, className }: { name: string; category?: Category; size?: number; className?: string }) {
  const color = category ? CATEGORY_COLORS[category] : PALETTE[hash(name) % PALETTE.length];
  const initials = name
    .replace(/[^A-Za-z0-9 &]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={clsx("flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight", className)}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 18%, var(--surface))`, color, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials || "•"}
    </span>
  );
}

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
