import type { Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { money } from "@/lib/format";
import { CategoryIcon } from "../ui/CategoryIcon";

/**
 * One proportional bar showing where the month's extra (or saved) money went,
 * segmented by category. Reads at a glance, no table needed.
 */
export function ChangeBar({ rows, delta }: { rows: Array<{ key: Category; delta: number }>; delta: number }) {
  const same = rows.filter((r) => Math.sign(r.delta) === Math.sign(delta) && Math.abs(r.delta) >= 1);
  const total = same.reduce((a, r) => a + Math.abs(r.delta), 0) || 1;
  const top = same.slice(0, 6);
  if (!top.length) return null;
  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-secondary">
        Where the {delta > 0 ? "extra" : "saved"} <span className="font-semibold text-ink">{money(delta)}</span> {delta > 0 ? "went" : "came from"}
      </p>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {top.map((r) => (
          <div key={r.key} title={`${r.key} ${money(r.delta)}`} style={{ width: `${(Math.abs(r.delta) / total) * 100}%`, background: CATEGORY_COLORS[r.key] }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {top.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-[12.5px]">
            <CategoryIcon category={r.key} size={22} />
            <span className="truncate text-ink-secondary">{r.key}</span>
            <span className="tabular ml-auto font-medium">{Math.round((Math.abs(r.delta) / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
