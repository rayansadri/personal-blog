import type { Category } from "@/lib/types";
import { CATEGORY_COLORS, CATEGORY_ICON_PATHS } from "@/lib/categories";
import { clsx } from "@/lib/clsx";

/** Colored circle with a category glyph. Color follows the category everywhere. */
export function CategoryIcon({ category, size = 40, className }: { category: Category; size?: number; className?: string }) {
  const color = CATEGORY_COLORS[category];
  return (
    <span
      className={clsx("flex shrink-0 items-center justify-center rounded-full", className)}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 16%, var(--surface))`, color }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d={CATEGORY_ICON_PATHS[category]} />
      </svg>
    </span>
  );
}
