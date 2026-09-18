import Link from "next/link";
import type { Category } from "@/lib/types";
import { money, signedMoney } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { Badge } from "../ui/Badge";
import { CategoryIcon } from "../ui/CategoryIcon";
import { MerchantAvatar } from "../ui/MerchantAvatar";

interface Row {
  label: string;
  current: number;
  previous: number;
  delta: number;
  isNew?: boolean;
  disappeared?: boolean;
  href?: string;
  category?: Category;
}

/** Iconized rows with diverging bars: increases extend right, decreases left. */
export function ContributionList({ rows, kind }: { rows: Row[]; kind: "category" | "merchant" }) {
  if (!rows.length) return <p className="text-[13.5px] text-ink-muted">No differences worth noting.</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.delta)), 1);
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((r) => {
        const pct = (Math.abs(r.delta) / max) * 50;
        const up = r.delta > 0;
        const ratio = r.previous > 0 ? Math.round((r.delta / r.previous) * 100) : null;
        const body = (
          <div className="flex items-center gap-3 py-3">
            {kind === "category" ? <CategoryIcon category={r.label as Category} size={40} /> : <MerchantAvatar name={r.label} category={r.category} size={40} />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-medium">{r.label}</span>
                {r.isNew && <Badge tone="accent">New</Badge>}
                {r.disappeared && <Badge>Gone</Badge>}
              </div>
              <div className="relative mt-1.5 h-1.5 w-full rounded-full bg-surface-3">
                <span className="absolute left-1/2 top-[-2px] h-[10px] w-px bg-line-strong" />
                <div className={clsx("absolute top-0 h-full rounded-full", up ? "bg-negative" : "bg-positive")} style={up ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11.5px] text-ink-muted">{money(r.previous)} → {money(r.current)}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className={clsx("tabular block text-[15px] font-semibold", up ? "text-negative" : "text-positive")}>{signedMoney(r.delta)}</span>
              {ratio != null && !r.isNew && <span className="tabular text-[11.5px] text-ink-muted">{ratio > 0 ? "+" : ""}{ratio}%</span>}
            </div>
          </div>
        );
        return <li key={r.label}>{r.href ? <Link href={r.href} className="block hover:opacity-85">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}
