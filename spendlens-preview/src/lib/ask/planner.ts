import type { Category } from "../types";
import { CATEGORIES } from "../types";
import { addMonths, monthLabel, monthRange } from "../dates";
import type { PlannerContext, QueryPlan, QueryPlanner, TimeRange } from "./types";

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12,
};

/** Phrases that map to a category (or a group of categories). */
const CATEGORY_SYNONYMS: Array<{ pattern: RegExp; categories: Category[]; label: string }> = [
  { pattern: /eating out|dining out|restaurants?|dining|food|eat(ing)?\b|meals?/i, categories: ["Dining", "Delivery"], label: "eating out" },
  { pattern: /take ?out|delivery|ordering (in|food)|food delivery/i, categories: ["Delivery"], label: "food delivery" },
  { pattern: /groceries|grocery|supermarket/i, categories: ["Groceries"], label: "groceries" },
  { pattern: /coffee/i, categories: ["Dining"], label: "coffee" },
  { pattern: /rent|housing|mortgage/i, categories: ["Housing"], label: "housing" },
  { pattern: /transport(ation)?|commut(e|ing)|gas|rides?|ride ?shar(e|ing)/i, categories: ["Transportation"], label: "transportation" },
  { pattern: /shopping|clothes|clothing/i, categories: ["Shopping"], label: "shopping" },
  { pattern: /travel|trips?|flights?|hotels?|vacation/i, categories: ["Travel"], label: "travel" },
  { pattern: /entertainment|movies|concerts?|fun/i, categories: ["Entertainment"], label: "entertainment" },
  { pattern: /health|medical|doctor|pharmacy|gym|fitness/i, categories: ["Health"], label: "health" },
  { pattern: /subscriptions?|streaming/i, categories: ["Subscriptions"], label: "subscriptions" },
  { pattern: /utilities|bills|phone bill|internet/i, categories: ["Utilities"], label: "utilities" },
];

/**
 * Deterministic natural-language planner. Pattern-matches common question
 * shapes and resolves merchants, categories and time ranges.
 */
export class RuleBasedPlanner implements QueryPlanner {
  plan(question: string, ctx: PlannerContext): QueryPlan {
    const q = question.trim().toLowerCase().replace(/[?!.]+$/, "");
    if (!q) return { kind: "help" };

    // "What should I pay attention to?" → top insights for the latest month
    if (/pay attention|should i (actually )?(look at|focus on|worry about|care about|know)|what matters|top (3|three) things|most important/.test(q)) {
      return { kind: "attention", month: resolveRelativeMonth(q, ctx) ?? ctx.latestMonth };
    }
    // "Am I spending more often or more each time?"
    if (/more often|each time|per purchase|more frequently|frequency|bigger purchases|larger purchases|purchase size/.test(q)) {
      return { kind: "frequency_vs_size", range: resolveRange(q.replace(/more often|each time/g, ""), ctx) };
    }
    // "If I spent like I did last year, how much would I save?"
    if (/(spent|spend|spending) (like|as|the way) i did last year|back to (my )?(last year|20\d{2}) (spending|habits|levels?)|last year'?s? (habits|levels?|pace)/.test(q)) {
      const merchant = resolveMerchant(q, ctx.merchants) ?? undefined;
      const cat = merchant ? undefined : resolveCategoryGroup(q);
      return { kind: "hypothetical_reversion", merchant, category: cat?.categories[0], toMonth: addMonths(ctx.latestMonth, -12), range: { ...monthRange(ctx.latestMonth), from: monthRange(addMonths(ctx.latestMonth, -11)).from, label: "the last 12 months" } };
    }
    // "What's changed compared with last year?" → this year vs last year
    if (/(changed|different|compare[sd]?).*(compared (with|to)|vs\.?|versus|against|since) last year|last year.*(compared|vs|versus)/.test(q)) {
      const y = ctx.latestMonth.slice(0, 4);
      const ly = String(Number(y) - 1);
      return { kind: "compare_periods", a: { from: `${y}-01-01`, to: `${y}-12-31`, label: y }, b: { from: `${ly}-01-01`, to: `${ly}-12-31`, label: ly } };
    }

    // Hypothetical reversion: "what if my dining went back to January levels"
    const hyp = q.match(/(what if|if i|suppose|had i|imagine).*?(back to|at|like|to)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|last year|\d{4}-\d{2})/);
    if (hyp) {
      const merchant = resolveMerchant(q, ctx.merchants) ?? undefined;
      const cat = merchant ? undefined : resolveCategoryGroup(q);
      const toMonth = /last year/.test(hyp[3]) ? addMonths(ctx.latestMonth, -12) : /^\d{4}-\d{2}$/.test(hyp[3]) ? hyp[3] : resolveMonthWord(hyp[3], undefined, ctx) ?? addMonths(ctx.latestMonth, -6);
      return { kind: "hypothetical_reversion", merchant, category: cat?.categories[0], toMonth, range: resolveRange(q, ctx) };
    }

    // Behavior change / lifestyle inflation / income vs spend / savings rate / weekend / late-day
    if (/lifestyle (inflation|creep)|living (beyond|above) my means/.test(q)) return { kind: "lifestyle_inflation" };
    if (/(how|what|has|did).*(behavio|habit).*(change|shift|different)|what('s| is) (new|different) (about|in) (my|the way i)/.test(q)) return { kind: "detect_behavior_change" };
    if (/savings? rate|how much (do|did|am) i (sav|keep)|percent(age)? (of|saved)/.test(q)) return { kind: "savings_rate", range: resolveRange(q, ctx) };
    if (/(income|earn(ings)?|paycheck).*(vs|versus|compared|against|and).*(spend|expenses)|spend.*(vs|versus|compared|against).*(income|earn)|am i (spending|living) (more than i (earn|make)|beyond my means)/.test(q)) return { kind: "income_vs_spend", range: resolveRange(q, ctx) };
    if (/weekend/.test(q)) return { kind: "weekend_spend", range: resolveRange(q, ctx) };
    if (/late[- ]?(at )?night|evening|after (9|10|11)|time of day|late[- ]day/.test(q)) return { kind: "late_day_spend", range: resolveRange(q, ctx) };

    // Growth of a merchant or category: "is my Amazon spending growing", "how is dining trending"
    if (/(grow|growing|trend|trending|rising|increas|climb|going up|going down|shrink|declin)/.test(q)) {
      const merchant = resolveMerchant(q, ctx.merchants);
      if (merchant) return { kind: "merchant_growth", merchant, range: resolveRange(q, ctx) };
      const cat = resolveCategoryGroup(q);
      if (cat) return { kind: "category_growth", category: cat.categories[0], range: resolveRange(q, ctx) };
    }

    // Explain a whole year: "why was 2025 expensive", "how was last year". Not "how much did I spend this year".
    const yearQ = q.match(/^(?:why|explain|what happened|how (?:was|did)).*?(20\d{2}|last year|this year)/);
    if (yearQ && !/month|how much|spend|spent|\d{4}-\d{2}/.test(q)) {
      const y = yearQ[1] === "last year" ? String(Number(ctx.latestMonth.slice(0, 4)) - 1) : yearQ[1] === "this year" ? ctx.latestMonth.slice(0, 4) : yearQ[1];
      return { kind: "explain_year", year: y };
    }

    // Compare two named months/years: "compare August and July", "March vs June"
    const cmp = q.match(/(?:compare|vs\.?|versus)/);
    if (cmp) {
      const words = [...q.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/g)].map((m) => m[1]);
      const years = [...q.matchAll(/\b(20\d{2})\b/g)].map((m) => m[1]);
      const pick = (w?: string) => (w ? resolveMonthWord(w, undefined, ctx) : null);
      let a: TimeRange | null = null;
      let b: TimeRange | null = null;
      if (words.length >= 2) {
        const m1 = pick(words[0])!;
        const m2 = pick(words[1])!;
        a = { ...monthRange(m1), label: monthLabel(m1) };
        b = { ...monthRange(m2), label: monthLabel(m2) };
      } else if (years.length >= 2) {
        a = { from: `${years[0]}-01-01`, to: `${years[0]}-12-31`, label: years[0] };
        b = { from: `${years[1]}-01-01`, to: `${years[1]}-12-31`, label: years[1] };
      } else if (/this month.*last month|last month.*this month/.test(q)) {
        const m1 = ctx.latestMonth;
        const m2 = addMonths(ctx.latestMonth, -1);
        a = { ...monthRange(m1), label: monthLabel(m1) };
        b = { ...monthRange(m2), label: monthLabel(m2) };
      }
      if (a && b) return { kind: "compare_periods", a, b };
    }


    // "Why was August expensive?" / "explain July" / "what happened in June"
    const explain = q.match(/(why|what happened|explain|what changed)\b.*?\b(in |was |during )?([a-z]{3,9})(?:\s+(\d{4}))?\s*(so )?(expensive|high|different|costly|much|changed|happen)?/);
    if (explain && (/why|explain|what happened/.test(q) || /expensive|costly|high/.test(q))) {
      const month = resolveMonthWord(explain[3], explain[4], ctx) ?? resolveRelativeMonth(q, ctx) ?? ctx.latestMonth;
      return { kind: "explain-month", month };
    }

    // "What changed over the last three months?" / "trend"
    if (/(what'?s? changed|how has .* changed|trend|over time|month by month|monthly)/.test(q) && !/subscription|recurring/.test(q)) {
      const n = parseNumberWord(q.match(/last (\w+) months?/)?.[1]) ?? 3;
      const months = Array.from({ length: n + 1 }, (_, i) => addMonths(ctx.latestMonth, -(n - i))).filter((m) =>
        ctx.availableMonths.includes(m),
      );
      return { kind: "trend", months };
    }

    // Habits / personality / all-time analysis
    if (/(habits?|personality|analy[sz]e me|who am i|patterns?|all[- ]time|since (the start|january|i started)|over(all)? (the )?(year|months))/.test(q) && !/last (\w+) months/.test(q)) {
      return { kind: "habits" };
    }

    // Upcoming charges / forecast
    if (/(coming up|upcoming|due (soon|next)|next (charges?|bills?|payments?)|what('s| is| am i) (paying|charged) (for )?(next|soon)|forecast|end (of|the) month|on pace|renew)/.test(q)) {
      const n = parseNumberWord(q.match(/next (\w+) days/)?.[1]) ?? 30;
      return { kind: "upcoming", days: n };
    }

    // Recurring / subscriptions
    if (/(recurring|subscriptions?|biggest bills|monthly bills|what am i paying for every month)/.test(q)) {
      return { kind: "recurring", limit: 10 };
    }

    const range = resolveRange(q, ctx);
    const merchant = resolveMerchant(q, ctx.merchants);
    const cat = merchant ? undefined : resolveCategoryGroup(q);

    // Income
    if (/(income|earn(ed)?|paid|salary|make)\b/.test(q) && !/spend|spent/.test(q)) {
      return { kind: "income", range };
    }

    // Counts: "how many times did I order Uber Eats"
    if (/how many( times)?|how often|number of (times|orders|purchases|transactions)/.test(q)) {
      return { kind: "count", range, merchant: merchant ?? undefined, categories: cat?.categories, category: cat?.categories.length === 1 ? cat.categories[0] : undefined };
    }

    // Largest purchases
    if (/(largest|biggest|most expensive)\s+(unusual |odd |strange |weird |one-off |single )?(purchase|transaction|charge|expense)s?|unusual purchases|anomal|outlier/.test(q)) {
      return { kind: "largest", range, limit: 5 };
    }

    // Top merchants / categories
    if (/(top|biggest|largest|most)\b.*\b(merchants?|stores?|places|companies|vendors?)/.test(q) || /where (did|does|is) (my )?money go/.test(q) && /merchant|store/.test(q)) {
      return { kind: "top-merchants", range, limit: 8 };
    }
    if (/(top|biggest|largest|most)\b.*\bcategor/.test(q) || /where (did|does|is|has) .*money (go|going|gone)|breakdown|what did i spend (my money )?on/.test(q)) {
      return { kind: "top-categories", range, limit: 8 };
    }

    // Spending totals (default when a merchant or category is mentioned, or "how much")
    if (merchant || cat || /how much|total|spend|spent|cost/.test(q)) {
      return {
        kind: "spend-total",
        range,
        merchant: merchant ?? undefined,
        categories: cat?.categories,
        category: cat && cat.categories.length === 1 ? cat.categories[0] : undefined,
      };
    }

    return { kind: "help" };
  }
}

function parseNumberWord(w?: string): number | null {
  if (!w) return null;
  const map: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twelve: 12, few: 3, couple: 2 };
  if (map[w] != null) return map[w];
  const n = Number(w);
  return Number.isFinite(n) ? n : null;
}

function resolveMonthWord(word: string | undefined, year: string | undefined, ctx: PlannerContext): string | null {
  if (!word) return null;
  const m = MONTHS[word];
  if (!m) return null;
  const mm = String(m).padStart(2, "0");
  if (year) return `${year}-${mm}`;
  // Pick the most recent year in the data that has this month.
  const match = [...ctx.availableMonths].reverse().find((k) => k.endsWith(`-${mm}`));
  return match ?? `${ctx.latestMonth.slice(0, 4)}-${mm}`;
}

function resolveRelativeMonth(q: string, ctx: PlannerContext): string | null {
  if (/last month|previous month/.test(q)) return addMonths(ctx.latestMonth, -1);
  if (/this month|current month/.test(q)) return ctx.latestMonth;
  const ym = q.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  if (ym) return `${ym[1]}-${ym[2]}`;
  return null;
}

export function resolveRange(q: string, ctx: PlannerContext): TimeRange {
  const latest = ctx.latestMonth;
  const year = latest.slice(0, 4);

  const rel = resolveRelativeMonth(q, ctx);
  if (rel) {
    const r = monthRange(rel);
    return { ...r, label: monthLabel(rel) };
  }
  const lastN = q.match(/(?:last|past) (\w+) months?/);
  if (lastN) {
    const n = parseNumberWord(lastN[1]) ?? 3;
    const start = addMonths(latest, -(n - 1));
    return { from: monthRange(start).from, to: monthRange(latest).to, label: `the last ${n} months` };
  }
  if (/this year|year to date|ytd/.test(q)) return { from: `${year}-01-01`, to: `${year}-12-31`, label: `${year}` };
  if (/last year/.test(q)) {
    const y = String(Number(year) - 1);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: y };
  }
  const yr = q.match(/\b(20\d{2})\b/);
  const monthWord = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/);
  if (monthWord) {
    const key = resolveMonthWord(monthWord[1], yr?.[1], ctx);
    if (key) return { ...monthRange(key), label: monthLabel(key) };
  }
  if (yr) return { from: `${yr[1]}-01-01`, to: `${yr[1]}-12-31`, label: yr[1] };
  if (/all ?time|ever|in total|overall|so far/.test(q)) {
    return { from: "1970-01-01", to: "2100-12-31", label: "all time" };
  }
  // Default: all available data.
  const first = ctx.availableMonths[0] ?? latest;
  return { from: monthRange(first).from, to: monthRange(latest).to, label: "all time" };
}

export function resolveMerchant(q: string, merchants: string[]): string | null {
  // Longest merchant name that appears in the question wins.
  const sorted = [...merchants].sort((a, b) => b.length - a.length);
  for (const m of sorted) {
    const needle = m.toLowerCase();
    if (needle.length < 3) continue;
    if (q.includes(needle)) return m;
  }
  // Loose match: strip punctuation/possessives ("trader joes" vs "Trader Joe's")
  const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const lq = loose(q);
  for (const m of sorted) {
    const needle = loose(m);
    if (needle.length >= 4 && lq.includes(needle)) return m;
  }
  return null;
}

export function resolveCategoryGroup(q: string): { categories: Category[]; label: string } | null {
  for (const c of CATEGORIES) {
    if (new RegExp(`\\b${c.toLowerCase()}\\b`).test(q)) return { categories: [c], label: c.toLowerCase() };
  }
  for (const s of CATEGORY_SYNONYMS) if (s.pattern.test(q)) return { categories: s.categories, label: s.label };
  return null;
}
