import type { Category, SubscriptionRule, Transaction } from "../types";
import { formatDate, monthLabel } from "../dates";
import { analyzeChanges } from "../analytics/changes";
import { countBy, inMonth, inRange, spend, spendingTransactions, sum, sumBy, topEntries } from "../analytics/core";
import { detectRecurring } from "../analytics/recurring";
import { buildUpcoming } from "../analytics/forecast";
import { buildHabits } from "../analytics/habits";
import { generateInsights } from "../analytics/insights";
import * as M from "../analytics/metrics";
import { buildBehaviorReport } from "../behavior";
import { interpretDeterministically } from "../../services/ai/deterministic";
import { buildInterpreterInput } from "../../services/ai/inputBuilder";
import type { Answer, QueryPlan, TimeRange } from "./types";

const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const fmtExact = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function subject(plan: { merchant?: string; category?: Category; categories?: Category[] }): string {
  if (plan.merchant) return `at ${plan.merchant}`;
  if (plan.categories && plan.categories.length > 1) return `on ${plan.categories.map((c) => c.toLowerCase()).join(" and ")}`;
  if (plan.category) return `on ${plan.category.toLowerCase()}`;
  return "in total";
}

function filterSubject(txs: Transaction[], plan: { merchant?: string; category?: Category; categories?: Category[] }) {
  return txs.filter((t) => {
    if (plan.merchant && t.merchant !== plan.merchant) return false;
    if (plan.categories?.length && !plan.categories.includes(t.category)) return false;
    if (plan.category && !plan.categories?.length && t.category !== plan.category) return false;
    return true;
  });
}

const HELP_EXAMPLES = [
  "How much did I spend on Uber Eats this year?",
  "Why was August expensive?",
  "How much do I spend eating out?",
  "What are my biggest recurring expenses?",
  "What changed over the last three months?",
  "What's coming up next?",
];

/** Execute a structured query against the transaction set. */
export function executePlan(plan: QueryPlan, txs: Transaction[], rules: SubscriptionRule[] = []): Answer {
  const spending = spendingTransactions(txs);

  switch (plan.kind) {
    case "spend-total": {
      const rows = filterSubject(inRange(spending, plan.range.from, plan.range.to), plan);
      const total = sum(rows);
      if (!rows.length) {
        return { text: `I couldn't find any spending ${subject(plan)} ${inLabel(plan.range)}.`, plan };
      }
      const perMonth = monthsIn(rows);
      const details = [
        `${rows.length} ${rows.length === 1 ? "transaction" : "transactions"}, averaging ${fmt(total / rows.length)} each.`,
      ];
      if (perMonth.length > 1) details.push(`That is about ${fmt(total / perMonth.length)} per month over ${perMonth.length} months.`);
      const byMonth = sumBy(rows, (t) => t.date.slice(0, 7));
      return {
        text: `You spent ${fmtExact(total)} ${subject(plan)} ${inLabel(plan.range)}.`,
        details,
        chart:
          perMonth.length > 1
            ? { type: "bar", data: [...byMonth.entries()].sort().map(([m, v]) => ({ label: monthLabel(m, "short"), value: v })) }
            : undefined,
        table: !plan.merchant
          ? {
              columns: ["Merchant", "Spent", "Count"],
              rows: topEntries(sumBy(rows, (t) => t.merchant), 6).map((e) => [
                e.key,
                fmt(e.value),
                countBy(rows, (t) => t.merchant).get(e.key) ?? 0,
              ]),
            }
          : undefined,
        plan,
      };
    }

    case "explain-month": {
      const c = analyzeChanges(txs, plan.month);
      if (c.currentTotal === 0) return { text: `There is no spending recorded for ${c.monthLabel}.`, plan };
      const details = c.narrative.slice(1);
      const topMerchants = c.merchants.filter((m) => m.delta > 0).slice(0, 4);
      if (topMerchants.length) {
        details.push(`Biggest merchant increases: ${topMerchants.map((m) => `${m.key} (+${fmt(m.delta)})`).join(", ")}.`);
      }
      return {
        text: `${c.narrative[0]} You spent ${fmt(c.currentTotal)} in ${c.monthLabel}${c.previousTotal ? ` vs ${fmt(c.previousTotal)} in ${c.previousLabel}` : ""}.`,
        details,
        chart: {
          type: "bar",
          data: c.categories.slice(0, 6).map((x) => ({ label: x.key, value: x.delta })),
        },
        plan,
      };
    }

    case "top-merchants": {
      const rows = inRange(spending, plan.range.from, plan.range.to);
      const top = topEntries(sumBy(rows, (t) => t.merchant), plan.limit);
      if (!top.length) return { text: `No spending found ${inLabel(plan.range)}.`, plan };
      return {
        text: `Your top merchant ${inLabel(plan.range)} was ${top[0].key} at ${fmt(top[0].value)}.`,
        chart: { type: "bar", data: top.map((e) => ({ label: e.key, value: e.value })) },
        table: { columns: ["Merchant", "Spent"], rows: top.map((e) => [e.key, fmt(e.value)]) },
        plan,
      };
    }

    case "top-categories": {
      const rows = inRange(spending, plan.range.from, plan.range.to);
      const total = sum(rows);
      const top = topEntries(sumBy(rows, (t) => t.category), plan.limit);
      if (!top.length) return { text: `No spending found ${inLabel(plan.range)}.`, plan };
      return {
        text: `${inLabel(plan.range, true)} you spent ${fmt(total)}. ${top[0].key} was the largest category at ${fmt(top[0].value)} (${Math.round((top[0].value / total) * 100)}%).`,
        chart: { type: "bar", data: top.map((e) => ({ label: e.key, value: e.value })) },
        table: { columns: ["Category", "Spent", "Share"], rows: top.map((e) => [e.key, fmt(e.value), `${Math.round((e.value / total) * 100)}%`]) },
        plan,
      };
    }

    case "recurring": {
      const rec = detectRecurring(txs, rules).filter((r) => r.confidence >= 0.5).slice(0, plan.limit);
      if (!rec.length) return { text: "I haven't detected any recurring payments yet. Import a few months of data and they will show up.", plan };
      const monthly = rec.reduce((a, r) => a + r.monthlyCost, 0);
      return {
        text: `You have ${rec.length} recurring payments costing about ${fmt(monthly)} a month (${fmt(monthly * 12)} a year).`,
        details: [`The largest is ${rec[0].merchant} at ${fmt(rec[0].monthlyCost)}/month.`],
        table: {
          columns: ["Merchant", "Cadence", "Typical", "Per month"],
          rows: rec.map((r) => [r.merchant, r.cadence, fmtExact(r.typicalAmount), fmt(r.monthlyCost)]),
        },
        chart: { type: "bar", data: rec.slice(0, 8).map((r) => ({ label: r.merchant, value: r.monthlyCost })) },
        plan,
      };
    }

    case "upcoming": {
      const r = buildUpcoming(txs, plan.days, undefined, rules);
      const up = r.items.filter((i) => i.status === "upcoming");
      if (!up.length) return { text: "I don't have enough history to predict charges yet. Two or more months of statements helps.", plan };
      const f = r.forecast;
      return {
        text: `About ${fmt(r.total)} across ${up.length} expected charges in the next ${r.horizonDays} days. ${f.label} ${f.isNextMonth ? "outlook" : "forecast"}: ${fmt(f.projected)}${f.lastMonth ? ` vs ${fmt(f.lastMonth)} last month` : ""}.`,
        details: [`First up: ${up.slice(0, 3).map((i) => `${i.merchant} ${fmtExact(i.amount)} on ${formatDate(i.expected)}`).join(", ")}.`],
        table: { columns: ["Date", "Merchant", "Amount", "Account"], rows: up.slice(0, 10).map((i) => [formatDate(i.expected), i.merchant, fmtExact(i.amount), i.account]) },
        plan,
      };
    }

    case "habits": {
      const h = buildHabits(txs, rules);
      if (!h) return { text: "Import some statements first and I'll read your habits.", plan };
      return {
        text: h.headline,
        details: [...h.personality.slice(0, 4).map((p) => `${p.title}: ${p.evidence}`), "Full breakdown on the Habits page."],
        chart: { type: "bar", data: h.merchants.slice(0, 8).map((m) => ({ label: m.merchant, value: m.total })) },
        table: { columns: ["Merchant", "Total", "Visits", "Per year at this pace"], rows: h.merchants.slice(0, 8).map((m) => [m.merchant, fmt(m.total), m.count, fmt(m.yearlyRunRate)]) },
        plan,
      };
    }

    case "attention": {
      const insights = generateInsights(txs, plan.month, rules).slice(0, 3);
      if (!insights.length) return { text: `Nothing stands out in ${monthLabel(plan.month)} yet.`, plan };
      return {
        text: `Three things worth your attention in ${monthLabel(plan.month)}:`,
        details: insights.map((i, n) => `${n + 1}. ${i.title}. ${i.detail}`),
        plan,
      };
    }

    case "frequency_vs_size": {
      let range: TimeRange = plan.range;
      if (range.label === "all time") {
        const whole = M.periodFromTransactions(spending);
        if (whole) {
          const months = M.monthsIn(whole);
          const half = Math.max(1, Math.floor(months.length / 2));
          range = { from: M.periodForMonth(months[months.length - half]).start, to: whole.end, label: `the last ${half} months` };
        }
      }
      const p = { start: range.from, end: range.to };
      const freq = M.getTransactionFrequency(txs, p, true);
      const avg = M.getAverageTransactionValue(txs, p, true);
      const total = M.getTotalSpend(txs, p, true);
      const fc = freq.comparison?.changePct;
      const ac = avg.comparison?.changePct;
      const verdict = fc == null || ac == null ? "There is no earlier period of the same length to compare with." : Math.abs(fc) < 8 && Math.abs(ac) >= 8 ? `Mostly spending more each time: purchases per month barely moved (${fc >= 0 ? "+" : ""}${fc}%) while the average purchase changed ${ac >= 0 ? "+" : ""}${ac}%.` : Math.abs(ac) < 8 && Math.abs(fc) >= 8 ? `Mostly buying more often: the average purchase barely moved (${ac >= 0 ? "+" : ""}${ac}%) while purchases per month changed ${fc >= 0 ? "+" : ""}${fc}%.` : `Both: purchases per month changed ${fc >= 0 ? "+" : ""}${fc}% and the average purchase changed ${ac >= 0 ? "+" : ""}${ac}%.`;
      return {
        text: verdict,
        details: [`${inLabel(range, true)}: ${freq.value.toFixed(1)} purchases per 30 days at ${fmt(avg.value)} each, ${fmt(total.value)} total${total.comparison?.changePct != null ? ` (${total.comparison.changePct >= 0 ? "+" : ""}${total.comparison.changePct}% vs the period before)` : ""}.`],
        chart: { type: "bar", data: [{ label: "Purchases/30d", value: freq.value }, { label: "Avg purchase", value: avg.value }] },
        plan: { ...plan, range },
      };
    }

    case "compare_periods": {
      const A = M.getTotalSpend(txs, { start: plan.a.from, end: plan.a.to }, false).value;
      const B = M.getTotalSpend(txs, { start: plan.b.from, end: plan.b.to }, false).value;
      const catsA = new Map(M.getSpendByCategory(txs, { start: plan.a.from, end: plan.a.to }).value.map((c) => [c.key, c.total]));
      const catsB = new Map(M.getSpendByCategory(txs, { start: plan.b.from, end: plan.b.to }).value.map((c) => [c.key, c.total]));
      const keys = [...new Set([...catsA.keys(), ...catsB.keys()])];
      const rows = keys.map((k) => ({ k, a: catsA.get(k) ?? 0, b: catsB.get(k) ?? 0, d: (catsA.get(k) ?? 0) - (catsB.get(k) ?? 0) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
      const chg = M.pct(A, B);
      return {
        text: `${plan.a.label}: ${fmt(A)}. ${plan.b.label}: ${fmt(B)}. That is ${chg == null ? "no comparison" : `${chg > 0 ? "+" : ""}${chg}%`}.`,
        details: rows.slice(0, 3).map((r) => `${r.k}: ${fmt(r.a)} vs ${fmt(r.b)} (${r.d >= 0 ? "+" : "−"}${fmt(r.d)}).`),
        chart: { type: "bar", data: rows.slice(0, 8).map((r) => ({ label: r.k, value: r.d })) },
        table: { columns: ["Category", plan.a.label, plan.b.label, "Change"], rows: rows.slice(0, 10).map((r) => [r.k, fmt(r.a), fmt(r.b), `${r.d >= 0 ? "+" : "−"}${fmt(r.d)}`]) },
        plan,
      };
    }

    case "explain_year": {
      const p = { start: `${plan.year}-01-01`, end: `${plan.year}-12-31` };
      const total = M.getTotalSpend(txs, p, false).value;
      if (!total) return { text: `There is no spending recorded for ${plan.year}.`, plan };
      const prevP = { start: `${Number(plan.year) - 1}-01-01`, end: `${Number(plan.year) - 1}-12-31` };
      const prev = M.getTotalSpend(txs, prevP, false).value;
      const cats = M.getSpendByCategory(txs, p).value.slice(0, 5);
      const monthly = M.getMonthlySpend(txs, p).value.filter((m) => m.value > 0);
      const peak = [...monthly].sort((a, b) => b.value - a.value)[0];
      const fv = M.getFixedVsVariableSpend(txs, p).value;
      return {
        text: `You spent ${fmt(total)} in ${plan.year}${prev ? ` vs ${fmt(prev)} in ${Number(plan.year) - 1} (${M.pct(total, prev)}%)` : ""}. ${cats[0]?.key ?? "Spending"} led at ${fmt(cats[0]?.total ?? 0)}.`,
        details: [
          `Fixed ${fmt(fv.fixed)} (${Math.round(fv.fixedShare * 100)}%), variable ${fmt(fv.variable)}.`,
          peak ? `Peak month: ${monthLabel(peak.month)} at ${fmt(peak.value)}.` : "",
          `Top categories: ${cats.map((c) => `${c.key} ${fmt(c.total)}`).join(", ")}.`,
        ].filter(Boolean),
        chart: { type: "bar", data: monthly.map((m) => ({ label: monthLabel(m.month, "short"), value: m.value })) },
        plan,
      };
    }

    case "detect_behavior_change":
    case "lifestyle_inflation": {
      const report = buildBehaviorReport(txs, rules);
      if (!report) return { text: "Not enough history to detect behavior changes yet.", plan };
      const interp = interpretDeterministically(buildInterpreterInput(report, txs));
      const wanted = plan.kind === "lifestyle_inflation" ? report.features.filter((f) => ["lifestyle_inflation", "discretionary_baseline_shift", "income_spend_decoupling", "savings_rate_shift"].includes(f.type)) : report.features.filter((f) => f.direction === "up" || f.direction === "down");
      if (!wanted.length) {
        return { text: plan.kind === "lifestyle_inflation" ? "No lifestyle inflation detected: discretionary spending has not grown faster than income across your history." : "No material behavior changes detected between the earlier and recent halves of your history.", details: interp.profile.archetypes.slice(0, 2).map((a) => `${a.name}: ${a.description}`), plan };
      }
      return {
        text: plan.kind === "lifestyle_inflation" ? `Yes: ${wanted[0].label.toLowerCase()}.` : `${wanted.length} behavior change${wanted.length === 1 ? "" : "s"} between ${monthLabel(report.comparisonPeriod.start.slice(0, 7), "short")}–${monthLabel(report.comparisonPeriod.end.slice(0, 7), "short")} and ${monthLabel(report.period.start.slice(0, 7), "short")}–${monthLabel(report.period.end.slice(0, 7), "short")}.`,
        details: wanted.slice(0, 5).map((f) => `${f.label}: ${f.evidence.map((e) => `${e.metric.replace(/_/g, " ")} ${typeof e.value === "number" ? (Math.abs(e.value) >= 100 ? fmt(e.value) : e.value) : e.value}`).join(", ")}.`),
        table: { columns: ["Signal", "Value", "Confidence"], rows: wanted.slice(0, 8).map((f) => [f.label, `${f.value}${f.unit === "%" ? "%" : f.unit === "x" ? "×" : ""}`, `${Math.round(f.confidence * 100)}%`]) },
        plan,
      };
    }

    case "weekend_spend": {
      const p = { start: plan.range.from, end: plan.range.to };
      const r = M.getWeekendWeekdayRatio(txs, p, true);
      const prof = M.getWeekdayProfile(txs, p).value;
      return {
        text: r.value ? `A weekend day costs ${r.value.toFixed(1)}× a weekday ${inLabel(plan.range)} (discretionary spending only).` : `Not enough discretionary spending ${inLabel(plan.range)} to compare weekends and weekdays.`,
        details: r.comparison ? [`Previous period: ${r.comparison.previousPeriodValue.toFixed(1)}×.`] : [],
        chart: { type: "bar", data: prof.map((d) => ({ label: d.day, value: d.perDay })) },
        plan,
      };
    }

    case "late_day_spend": {
      const m = M.getTimeOfDayDistribution(txs, { start: plan.range.from, end: plan.range.to });
      if (!m.value.available) return { text: "Your bank exports don't include a time of day, so late-day spending can't be measured from this data.", plan };
      return { text: `Late-day purchases are ${Math.round((m.value.buckets.find((b) => b.bucket === "late")?.share ?? 0) * 100)}% of spending ${inLabel(plan.range)}.`, chart: { type: "bar", data: m.value.buckets.map((b) => ({ label: b.bucket, value: b.share * 100 })) }, plan };
    }

    case "merchant_growth":
    case "category_growth": {
      // "Is X growing?" with no period named compares the recent half of the history with the half before.
      let range: TimeRange = plan.range;
      if (range.label === "all time") {
        const whole = M.periodFromTransactions(spending);
        if (whole) {
          const months = M.monthsIn(whole);
          const half = Math.max(1, Math.floor(months.length / 2));
          range = { from: M.periodForMonth(months[months.length - half]).start, to: whole.end, label: `the last ${half} months` };
        }
      }
      const p: M.Period = { start: range.from, end: range.to };
      const m = plan.kind === "merchant_growth" ? M.getMerchantGrowth(txs, p, plan.merchant) : M.getCategoryGrowth(txs, p, plan.category);
      const name = plan.kind === "merchant_growth" ? plan.merchant : plan.category;
      const c = m.comparison!;
      const monthly = M.getMonthlySpend(txs.filter((t) => (plan.kind === "merchant_growth" ? t.merchant === plan.merchant : t.category === plan.category)), p).value;
      return {
        text: c.changePct == null ? `${name}: ${fmt(m.value)} ${inLabel(range)}, nothing in the period before to compare.` : `${name} ${c.changePct >= 0 ? "grew" : "fell"} ${Math.abs(c.changePct)}%: ${fmt(m.value)} ${inLabel(range)} vs ${fmt(c.previousPeriodValue)} in the period before.`,
        chart: { type: "bar", data: monthly.map((x) => ({ label: monthLabel(x.month, "short"), value: x.value })) },
        plan: { ...plan, range },
      };
    }

    case "income_vs_spend": {
      const p = { start: plan.range.from, end: plan.range.to };
      const inc = M.getTotalIncome(txs, p, true);
      const sp = M.getTotalSpend(txs, p, true);
      if (!inc.value) return { text: `No income transactions ${inLabel(plan.range)}, so income can't be compared to spending.`, plan };
      const ratio = M.getIncomeToSpendRatio(txs, p, false).value;
      return {
        text: `${inLabel(plan.range, true)}: income ${fmt(inc.value)}, spending ${fmt(sp.value)}. You earned ${ratio.toFixed(2)}× what you spent.`,
        details: [inc.comparison?.changePct != null ? `Income ${inc.comparison.changePct >= 0 ? "+" : ""}${inc.comparison.changePct}% vs the period before; spending ${sp.comparison?.changePct != null ? `${sp.comparison.changePct >= 0 ? "+" : ""}${sp.comparison.changePct}%` : "n/a"}.` : ""].filter(Boolean),
        chart: { type: "bar", data: [{ label: "Income", value: inc.value }, { label: "Spending", value: sp.value }] },
        plan,
      };
    }

    case "savings_rate": {
      const p = { start: plan.range.from, end: plan.range.to };
      const sr = M.getSavingsRateIfIncomeExists(txs, p, true);
      if (sr.value == null) return { text: `No income transactions ${inLabel(plan.range)}, so a savings rate can't be computed.`, plan };
      return {
        text: `You kept ${Math.round(sr.value * 100)}% of your income ${inLabel(plan.range)}.`,
        details: sr.comparison?.previousPeriodValue != null ? [`Previous period: ${Math.round(sr.comparison.previousPeriodValue * 100)}%.`] : [],
        plan,
      };
    }

    case "hypothetical_reversion": {
      const p = { start: plan.range.from, end: plan.range.to };
      const filter = (t: Transaction) => (plan.merchant ? t.merchant === plan.merchant : plan.category ? t.category === plan.category : !M.isFixedTx(t));
      const subjectName = plan.merchant ?? plan.category ?? "discretionary spending";
      const toP = M.periodForMonth(plan.toMonth);
      const baseline = M.spendTxs(txs, toP).filter(filter).reduce((a, t) => a + M.spendAmount(t), 0);
      const months = M.monthsIn(p);
      const actual = months.map((m) => M.spendTxs(txs, M.periodForMonth(m)).filter(filter).reduce((a, t) => a + M.spendAmount(t), 0));
      const actualTotal = actual.reduce((a, b) => a + b, 0);
      const hypothetical = baseline * months.length;
      const diff = actualTotal - hypothetical;
      return {
        text: `If ${subjectName} had stayed at its ${monthLabel(plan.toMonth)} level (${fmt(baseline)}/month), you would have spent ${fmt(hypothetical)} ${inLabel(plan.range)} instead of ${fmt(actualTotal)}: ${diff >= 0 ? `${fmt(diff)} less` : `${fmt(-diff)} more`}.`,
        details: [`This is arithmetic on your own numbers, not a forecast: ${months.length} months × ${fmt(baseline)}.`],
        chart: { type: "bar", data: months.map((m, i) => ({ label: monthLabel(m, "short"), value: actual[i] - baseline })) },
        plan,
      };
    }

    case "trend": {
      if (plan.months.length < 2) return { text: "I need at least two months of data to describe a trend.", plan };
      const totals = plan.months.map((m) => ({ month: m, total: sum(inMonth(spending, m)) }));
      const first = totals[0];
      const last = totals[totals.length - 1];
      const delta = last.total - first.total;
      const c = analyzeChanges(txs, last.month);
      const movers = c.categories.slice(0, 3).map((x) => `${x.key} ${x.delta > 0 ? "+" : "−"}${fmt(x.delta)}`);
      return {
        text: `Spending went from ${fmt(first.total)} in ${monthLabel(first.month)} to ${fmt(last.total)} in ${monthLabel(last.month)}, ${delta >= 0 ? "up" : "down"} ${fmt(delta)}.`,
        details: movers.length ? [`Most recent month-over-month movers: ${movers.join(", ")}.`] : [],
        chart: { type: "bar", data: totals.map((t) => ({ label: monthLabel(t.month, "short"), value: t.total })) },
        plan,
      };
    }

    case "count": {
      const rows = filterSubject(inRange(spending, plan.range.from, plan.range.to), plan);
      const n = rows.length;
      return {
        text: `${n} ${n === 1 ? "purchase" : "purchases"} ${subject(plan)} ${inLabel(plan.range)}, totalling ${fmt(sum(rows))}.`,
        details: n ? [`Average ${fmt(sum(rows) / n)} per purchase.`] : [],
        plan,
      };
    }

    case "income": {
      const rows = inRange(txs, plan.range.from, plan.range.to).filter((t) => t.transactionType === "income");
      const total = rows.reduce((a, t) => a + t.amount, 0);
      const spent = sum(inRange(spending, plan.range.from, plan.range.to));
      return {
        text: `You received ${fmt(total)} in income ${inLabel(plan.range)} and spent ${fmt(spent)}.`,
        details: [total > 0 ? `That is a savings rate of about ${Math.round(((total - spent) / total) * 100)}%.` : "No income transactions were detected."],
        plan,
      };
    }

    case "largest": {
      const rows = [...inRange(spending, plan.range.from, plan.range.to)].sort((a, b) => spend(b) - spend(a)).slice(0, plan.limit);
      if (!rows.length) return { text: `No spending found ${inLabel(plan.range)}.`, plan };
      return {
        text: `Your largest purchase ${inLabel(plan.range)} was ${fmtExact(rows[0].amount)} at ${rows[0].merchant} on ${formatDate(rows[0].date, { year: "numeric" })}.`,
        table: { columns: ["Date", "Merchant", "Category", "Amount"], rows: rows.map((r) => [formatDate(r.date), r.merchant, r.category, fmtExact(r.amount)]) },
        plan,
      };
    }

    case "help":
    default:
      return {
        text: "I can answer questions about totals, merchants, categories, recurring payments and what changed between months. Try one of these:",
        details: HELP_EXAMPLES,
        plan: { kind: "help" },
      };
  }
}

function inLabel(range: TimeRange, capitalize = false): string {
  const s = range.label === "all time" ? "across all your data" : `in ${range.label}`;
  return capitalize ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function monthsIn(rows: Transaction[]): string[] {
  return [...new Set(rows.map((t) => t.date.slice(0, 7)))];
}
