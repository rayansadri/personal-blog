import Link from "next/link";
import type { ThingThatMatters } from "@/lib/analytics/topThree";
import { clsx } from "@/lib/clsx";
import { CategoryIcon } from "../ui/CategoryIcon";
import { MerchantAvatar } from "../ui/MerchantAvatar";

export function ThreeThings({ items }: { items: ThingThatMatters[] }) {
  if (!items.length) return null;
  return (
    <section className="mb-8">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Three things that matter</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((t) => (
          <Link key={t.slot + t.title} href={t.href} className="flex flex-col rounded-3xl bg-surface p-5 shadow-[var(--shadow-card)] transition-opacity hover:opacity-90">
            <div className="mb-4">{t.merchant ? <MerchantAvatar name={t.merchant} category={t.category} size={44} /> : t.category ? <CategoryIcon category={t.category} size={44} /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-6 4 4 6-7M14 8h6v6" /></svg></span>}</div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{t.kicker}</p>
            <p className="mt-1 text-[16px] font-semibold leading-snug tracking-tight">{t.title}</p>
            <p className={clsx("tabular mt-2 text-[22px] font-semibold tracking-tight", t.tone === "up" ? "text-negative" : t.tone === "down" ? "text-positive" : "text-ink")}>{t.value}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
