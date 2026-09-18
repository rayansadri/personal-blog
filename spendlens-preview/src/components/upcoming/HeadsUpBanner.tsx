import Link from "next/link";
import type { HeadsUp } from "@/lib/analytics/headsUp";
import { headsUpTitle } from "@/lib/analytics/headsUp";
import { money } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { MerchantAvatar } from "../ui/MerchantAvatar";

/** Compact "charges about to hit" strip for the Overview. */
export function HeadsUpBanner({ items }: { items: HeadsUp[] }) {
  if (!items.length) return null;
  const total = items.reduce((a, i) => a + i.amount, 0);
  const urgent = items.some((i) => i.reason === "cancel");
  return (
    <section className={clsx("mb-4 rounded-3xl p-4 shadow-[var(--shadow-card)] sm:p-5", urgent ? "bg-warning-soft" : "bg-accent-soft")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={clsx("text-[13px] font-semibold uppercase tracking-wide", urgent ? "text-warning" : "text-accent")}>Heads up</p>
          <p className="mt-0.5 text-[16px] font-semibold tracking-tight">
            {items.length === 1 ? "1 charge" : `${items.length} charges`} coming in the next few days · {money(total)}
          </p>
        </div>
        <Link href="/recurring" className="shrink-0 rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-medium shadow-[var(--shadow-card)] hover:opacity-90">
          Manage
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {items.slice(0, 4).map((h) => (
          <li key={h.id}>
            <Link href={`/recurring?focus=${encodeURIComponent(h.merchant)}`} className="flex items-center gap-3 rounded-2xl bg-surface/70 px-3 py-2 text-[13.5px] hover:bg-surface">
              <MerchantAvatar name={h.merchant} category={h.category} size={30} />
              <span className="min-w-0 flex-1 truncate">{headsUpTitle(h)}</span>
              {h.status === "cancel" && <span className="shrink-0 rounded-full bg-warning px-2 py-0.5 text-[11px] font-semibold text-white">Cancel?</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
