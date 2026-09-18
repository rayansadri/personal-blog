import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Stat } from "@/components/ui/Stat";
import { MerchantAvatar } from "@/components/ui/MerchantAvatar";
import { CategoryDonut } from "@/components/charts/CategoryDonut";
import { FixedVariableChart } from "@/components/charts/FixedVariableChart";
import { HorizontalBars } from "@/components/charts/HorizontalBars";
import { TrendChart } from "@/components/charts/TrendChart";
import { WeeklyChart } from "@/components/charts/WeeklyChart";
import { HeadsUpBanner } from "@/components/upcoming/HeadsUpBanner";
import { Greeting } from "@/components/home/Greeting";
import { HomeAsk } from "@/components/home/HomeAsk";
import { Disclosure } from "@/components/home/Disclosure";
import { ThreeThings } from "@/components/home/ThreeThings";
import { DemoHome } from "@/components/home/DemoHome";
import { latestMonth } from "@/lib/analytics/core";
import { buildDashboard } from "@/lib/analytics/summary";
import { buildUpcoming } from "@/lib/analytics/forecast";
import { buildHeadsUp } from "@/lib/analytics/headsUp";
import { buildTopThree } from "@/lib/analytics/topThree";
import { CATEGORY_COLORS } from "@/lib/categories";
import { formatDate, monthName } from "@/lib/dates";
import { getSettings } from "@/lib/db/settings";
import { listAccounts } from "@/lib/db/accounts";
import { money, moneyExact, percent, signedMoney } from "@/lib/format";
import { loadRules, loadTransactions } from "@/lib/server/data";
import { summarizeMonth } from "@/services/chat/summary";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ month?: string; demo?: string; name?: string }> }) {
  const sp = await searchParams;
  // Portfolio demo: fabricated, self-contained content. Never mixes with real data.
  if (sp.demo) return <DemoHome name={sp.name || "Rayan"} />;
  const txs = loadTransactions();
  const latest = latestMonth(txs);
  if (!latest) return <EmptyState />;

  const { month: requested } = sp;
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : latest;
  const rules = loadRules();
  const d = buildDashboard(txs, month, rules);
  const settings = getSettings();
  const name = settings.userName || listAccounts().find((a) => a.holder)?.holder?.split(" ")[0] || "";
  const [summary] = await Promise.all([summarizeMonth(txs, rules, month)]);
  const three = buildTopThree(txs, rules, month);
  // Home only surfaces upcoming charges when they matter: flagged to cancel, big, a renewal, or at least $25.
  const headsUp = buildHeadsUp(txs, rules).filter((h) => h.reason !== "reminder" || h.amount >= 25);
  const upcoming = buildUpcoming(txs, 30, undefined, rules);
  const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const changeText = d.previousSpending > 0 && d.changeRatio != null ? `You spent ${percent(Math.abs(d.changeRatio)).replace(/^[+−]/, "")} ${d.changeAmount < 0 ? "less" : "more"} in ${monthName(month)}.` : `You spent ${money(d.totalSpending)} in ${monthName(month)}.`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <Greeting name={name} />
        {d.availableMonths.length > 1 && <div className="mb-4 sm:mb-0 sm:mt-2 sm:shrink-0"><MonthPicker month={month} months={d.availableMonths} /></div>}
      </div>

      {/* 1. Conclusion + why */}
      <section className="mb-6">
        <p className="text-[24px] font-semibold leading-snug tracking-tight sm:text-[28px]">{changeText}</p>
        {summary && <p className="mt-3 text-[16px] leading-relaxed text-ink-secondary sm:text-[17px]">{summary.text}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[13.5px]">
          <Link href={`/changes?month=${month}`} className="font-medium text-accent hover:underline">See full breakdown →</Link>
          <span className="text-ink-muted">
            {money(d.totalSpending)} total{d.previousSpending > 0 ? ` · ${signedMoney(d.changeAmount)} vs last month` : ""} · {d.transactionCount} purchases
          </span>
        </div>
      </section>

      {/* 2. Ask */}
      <HomeAsk />

      {/* Only when something meaningful is about to hit */}
      <HeadsUpBanner items={headsUp} />

      {/* 3. Three things that matter */}
      <ThreeThings items={three} />

      {/* 4. One simple visual */}
      {d.trend.length > 1 && (
        <Card className="mb-8">
          <CardHeader title="Monthly spending" subtitle={`${d.trend.length} months`} />
          <TrendChart data={d.trend} highlight={month} />
          <Disclosure label="Show details" className="mt-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
                <Stat label="Fixed" value={money(d.fixedSpending)} hint="rent, bills, subscriptions" />
                <Stat label="Variable" value={money(d.variableSpending)} hint="everything else" />
                <Stat label="Recurring" value={money(d.recurringMonthly)} hint={`${d.recurringCount} payments`} />
                <Stat label="Income" value={money(d.income)} />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-[13px] font-semibold">By category</p>
                  <CategoryDonut data={d.byCategory} total={d.totalSpending} />
                </div>
                <div>
                  <p className="mb-3 text-[13px] font-semibold">Top merchants</p>
                  <HorizontalBars rows={d.byMerchant.map((m) => ({ label: m.merchant, value: m.amount, color: CATEGORY_COLORS[m.category], lead: <MerchantAvatar name={m.merchant} category={m.category} size={26} />, sublabel: `${m.count}×`, href: `/transactions?merchant=${encodeURIComponent(m.merchant)}` }))} />
                </div>
                <div>
                  <p className="mb-3 text-[13px] font-semibold">Weekly spending</p>
                  <WeeklyChart data={d.weekly} />
                </div>
                <div>
                  <p className="mb-3 text-[13px] font-semibold">Fixed vs variable</p>
                  <FixedVariableChart data={d.trend} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-[13px]">
                <Link href={`/insights?month=${month}`} className="font-medium text-accent hover:underline">All insights</Link>
                <Link href="/upcoming" className="font-medium text-accent hover:underline">Upcoming charges</Link>
                <Link href="/recurring" className="font-medium text-accent hover:underline">Subscriptions</Link>
                <Link href="/cards" className="font-medium text-accent hover:underline">Cards</Link>
              </div>
            </div>
          </Disclosure>
        </Card>
      )}

      {/* 5. Recent / important activity */}
      <Card padded={false} className="mb-4">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
          <CardHeader title="Recent activity" subtitle={upcoming.total > 0 ? `${money(upcoming.total)} expected in the next 30 days` : undefined} />
          <Link href="/transactions" className="text-[13px] font-medium text-accent hover:underline">All transactions</Link>
        </div>
        <ul className="divide-y divide-line">
          {recent.map((t) => {
            const muted = t.transactionType === "transfer" || t.transactionType === "payment";
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-[13.5px] sm:px-6">
                <MerchantAvatar name={t.merchant} category={t.transactionType === "expense" ? t.category : undefined} size={32} />
                <span className="min-w-0 flex-1">
                  <span className={clsx("block truncate font-medium", muted && "text-ink-muted")}>{t.merchant}</span>
                  <span className="block text-[12px] text-ink-muted">{formatDate(t.date)} · {t.transactionType === "expense" ? t.category : t.transactionType === "payment" ? "Card payment" : t.transactionType}</span>
                </span>
                <span className={clsx("tabular shrink-0 font-medium", t.amount > 0 && !muted && "text-positive", muted && "text-ink-muted")}>{t.amount < 0 ? moneyExact(Math.abs(t.amount)) : `+${moneyExact(t.amount)}`}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
