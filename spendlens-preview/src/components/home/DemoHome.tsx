import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { MerchantAvatar } from "@/components/ui/MerchantAvatar";
import { TrendChart } from "@/components/charts/TrendChart";
import { HomeAsk } from "./HomeAsk";
import { ThreeThings } from "./ThreeThings";
import type { MonthPoint } from "@/lib/analytics/summary";
import { moneyExact } from "@/lib/format";
import { clsx } from "@/lib/clsx";

/**
 * Portfolio demo Home. Every figure is invented; it renders only at /?demo=1.
 * Mirrors the real Home layout exactly so screenshots represent the product.
 */
const TREND: MonthPoint[] = [
  ["2025-10", 3980], ["2025-11", 4210], ["2025-12", 4870], ["2026-01", 3760], ["2026-02", 3690], ["2026-03", 3920],
  ["2026-04", 4140], ["2026-05", 4020], ["2026-06", 4480], ["2026-07", 4146], ["2026-08", 4018], ["2026-09", 3787],
].map(([m, t]) => ({ month: String(m), label: new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), total: Number(t), fixed: 2450, variable: Number(t) - 2450, count: 60 }));

const RECENT = [
  { merchant: "Delta Air Lines", category: "Travel", date: "Sep 12", amount: -412.6 },
  { merchant: "Whole Foods", category: "Groceries", date: "Sep 11", amount: -63.18 },
  { merchant: "Uber Eats", category: "Delivery", date: "Sep 10", amount: -31.47 },
  { merchant: "Netflix", category: "Subscriptions", date: "Sep 9", amount: -17.99 },
  { merchant: "Blue Bottle Coffee", category: "Dining", date: "Sep 9", amount: -9.5 },
  { merchant: "Amazon", category: "Shopping", date: "Sep 7", amount: 64.99 },
] as const;

export function DemoHome({ name = "Rayan" }: { name?: string }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-[30px] font-semibold tracking-[-0.02em] sm:text-[36px]">{greet}, {name}.</h1>

      <section className="mb-6">
        <p className="text-[24px] font-semibold leading-snug tracking-tight sm:text-[28px]">You spent 6% less this month.</p>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-secondary sm:text-[17px]">Most of the savings came from utilities and entertainment, while a new $413 travel purchase offset part of those gains. Your normal day-to-day spending stayed relatively stable.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[13.5px]">
          <Link href="/changes" className="font-medium text-accent hover:underline">See full breakdown →</Link>
          <span className="text-ink-muted">$3,787 total · −$231 vs last month · 58 purchases</span>
        </div>
      </section>

      <HomeAsk />

      <ThreeThings
        items={[
          { slot: "change", kicker: "Biggest change", title: "Utilities disappeared", value: "−$316", tone: "down", category: "Utilities", href: "/ask?demo=august", askQuestion: "" },
          { slot: "habit", kicker: "Habit getting stronger", title: "Weekend spending", value: "2.1× weekday spend", tone: "up", category: "Entertainment", href: "/ask?demo=weekend", askQuestion: "" },
          { slot: "watch", kicker: "Something to watch", title: "Travel reappeared", value: "+$413", tone: "up", category: "Travel", merchant: "Delta Air Lines", href: "/ask?demo=attention", askQuestion: "" },
        ]}
      />

      <Card className="mb-8">
        <CardHeader title="Monthly spending" subtitle="12 months" />
        <TrendChart data={TREND} highlight="2026-09" />
        <p className="mt-4 text-[13.5px] font-medium text-accent">Show details</p>
      </Card>

      <Card padded={false} className="mb-4">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
          <CardHeader title="Recent activity" subtitle="$2,144 expected in the next 30 days" />
          <span className="text-[13px] font-medium text-accent">All transactions</span>
        </div>
        <ul className="divide-y divide-line">
          {RECENT.map((t) => (
            <li key={t.merchant + t.date} className="flex items-center gap-3 px-5 py-2.5 text-[13.5px] sm:px-6">
              <MerchantAvatar name={t.merchant} category={t.category} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.merchant}</span>
                <span className="block text-[12px] text-ink-muted">{t.date} · {t.amount > 0 ? "Refund" : t.category}</span>
              </span>
              <span className={clsx("tabular shrink-0 font-medium", t.amount > 0 && "text-positive")}>{t.amount < 0 ? moneyExact(-t.amount) : `+${moneyExact(t.amount)}`}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
