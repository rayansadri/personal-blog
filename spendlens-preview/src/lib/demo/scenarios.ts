import type { CardSpec, EvidenceItem } from "@/services/chat/tools";

/**
 * Portfolio demo mode. Everything here is invented for screenshots and is
 * never mixed with real data: it only plays when /ask is opened with ?demo=.
 */
export interface DemoTurn {
  question: string;
  statuses: string[];
  answer: string;
  cards: CardSpec[];
  evidence: EvidenceItem[];
  followups: string[];
}

const ev = (label: string, range: string, values: Array<[string, number | string]>): EvidenceItem => ({ tool: "demo", label, range: { start: "", end: "", label: range }, values: values.map(([metric, value]) => ({ metric, value })) });

export const DEMO_TURNS: Record<string, DemoTurn> = {
  august: {
    question: "Why was August expensive?",
    statuses: ["Checking your spending…", "Comparing August with July…", "Looking at what drove the change…"],
    answer: "August was expensive mainly because of travel and shopping.\n\nYou spent $1,240 more than July:\n- Travel: +$510\n- Shopping: +$420\n- Dining: +$190\n\nYour transaction count barely changed (61 vs 63), so the increase came from larger purchases rather than buying more often.",
    cards: [
      { type: "comparison", title: "August vs July", a: { label: "August", value: 5386 }, b: { label: "July", value: 4146 }, rows: [{ label: "Travel", a: 742, b: 232, delta: 510 }, { label: "Shopping", a: 1012, b: 592, delta: 420 }, { label: "Dining", a: 684, b: 494, delta: 190 }, { label: "Groceries", a: 512, b: 548, delta: -36 }, { label: "Utilities", a: 316, b: 301, delta: 15 }] },
      { type: "metric", label: "Average purchase", value: 88, unit: "usd", delta: { value: 31, label: "vs July" } },
    ],
    evidence: [ev("August explained", "August 2026", [["total", 5386], ["previous_month_total", 4146], ["change", 1240], ["transactions", 61], ["previous_month_transactions", 63]]), ev("Top changes", "August 2026 vs July 2026", [["change:Travel", 510], ["change:Shopping", 420], ["change:Dining", 190]])],
    followups: ["How does that compare with my usual month?", "Which merchants drove it?", "Was it more purchases or bigger ones?"],
  },
  habit: {
    question: "What habit is costing me the most?",
    statuses: ["Reading your spending patterns…", "Checking the last 14 months…"],
    answer: "Your strongest pattern is convenience spending.\n\nDelivery and ride-hailing have increased steadily for 14 months and now cost roughly $430/month more than they did at the start of that period. That increase is larger than your subscription growth or grocery inflation.\n\nMost of it is Uber Eats: 17 orders in August, up from 5 a month a year ago.",
    cards: [
      { type: "trend", title: "Delivery and rides by month", series: [["2025-07", 190], ["2025-08", 210], ["2025-09", 240], ["2025-10", 265], ["2025-11", 290], ["2025-12", 340], ["2026-01", 330], ["2026-02", 360], ["2026-03", 395], ["2026-04", 430], ["2026-05", 470], ["2026-06", 520], ["2026-07", 560], ["2026-08", 620]].map(([label, value]) => ({ label: String(label), value: Number(value) })), highlight: "2026-08" },
      { type: "breakdown", title: "Where the convenience money goes", kind: "merchant", rows: [{ label: "Uber Eats", value: 742, count: 17, category: "Delivery" }, { label: "Uber", value: 168, count: 9, category: "Transportation" }, { label: "DoorDash", value: 121, count: 3, category: "Delivery" }] },
    ],
    evidence: [ev("Behavior signals", "the last 14 months", [["convenience_spend_growth.convenience_spend", 620], ["convenience_spend_growth.convenience_spend_previous", 190], ["dining_delivery_growth", "+82%"]]), ev("Uber Eats spending", "August 2026", [["visits", 17], ["total", 742], ["visits_a_year_ago", 5]])],
    followups: ["When did that start?", "If I went back to last year's level, how much would I save?", "What do I order most?"],
  },
  weekend: {
    question: "Am I spending more on weekends?",
    statuses: ["Comparing weekends with weekdays…"],
    answer: "Yes, and the gap is widening.\n\nA weekend day now costs about 2.0× a weekday: $186 versus $91 on average, looking only at day-to-day spending, not bills. Twelve months ago the ratio was 1.5×.\n\nSaturdays carry most of it, mainly dining and shopping.",
    cards: [{ type: "trend", title: "Average spend per day of week", series: [["Mon", 84], ["Tue", 79], ["Wed", 96], ["Thu", 88], ["Fri", 108], ["Sat", 214], ["Sun", 158]].map(([label, value]) => ({ label: String(label), value: Number(value) })), highlight: "Sat" }],
    evidence: [ev("Weekend vs weekday", "the last 3 months", [["weekend_per_day", 186], ["weekday_per_day", 91], ["ratio", 2.04], ["ratio_12_months_ago", 1.5]])],
    followups: ["What do I buy on weekends?", "Which Saturday was the most expensive?", "Has this changed since spring?"],
  },
  whatif: {
    question: "If I spent like I did last year, how much would I save?",
    statuses: ["Running the what-if…", "Comparing with your 2025 pace…"],
    answer: "About $4,900 a year.\n\nYour day-to-day spending averages $2,438 a month now versus $2,030 in 2025. At last year's pace, the last 12 months would have cost $29,360 instead of $34,250.\n\nDining and delivery explain 46% of that gap. Fixed costs only moved 7%, so this is mostly choices, not bills.",
    cards: [
      { type: "comparison", title: "Actual vs at 2025 pace", a: { label: "Actual", value: 34250 }, b: { label: "At 2025 pace", value: 29360 }, rows: [{ label: "Dining", a: 6120, b: 3870, delta: 2250 }, { label: "Delivery", a: 4480, b: 2560, delta: 1920 }, { label: "Shopping", a: 5210, b: 4390, delta: 820 }, { label: "Groceries", a: 5840, b: 5920, delta: -80 }] },
      { type: "metric", label: "Potential yearly saving", value: 4890, unit: "usd" },
    ],
    evidence: [ev("What-if", "the last 12 months", [["baseline_monthly", 2030], ["actual_monthly", 2438], ["actual_total", 34250], ["hypothetical_total", 29360], ["difference", 4890]]), ev("Fixed vs variable", "the last 12 months", [["fixed_change_pct", 7], ["variable_change_pct", 20]])],
    followups: ["Which category would save the most?", "Is dining still growing?", "Show me the months that broke the pattern"],
  },
  attention: {
    question: "What should I actually pay attention to?",
    statuses: ["Ranking what matters…", "Checking upcoming charges…"],
    answer: "Three things.\n\n1. Uber Eats. 17 orders in August, $742. It's the fastest-growing line in your spending and the easiest to change.\n2. Your Verizon bill went up $19 in August. Over a year that's $228 for the same plan.\n3. Sweetgreen charged you $14.85 twice on August 12 and 13. Worth a message to support.\n\nEverything else looks like a normal month. Groceries and utilities are steady.",
    cards: [{ type: "transactions", title: "Possible double charge", rows: [{ date: "2026-08-12", merchant: "Sweetgreen", category: "Dining", amount: 14.85 }, { date: "2026-08-13", merchant: "Sweetgreen", category: "Dining", amount: 14.85 }] }],
    evidence: [ev("Insights ranked by impact", "August 2026", [["uber_eats_orders", 17], ["uber_eats_total", 742], ["verizon_increase", 19], ["double_charge_amount", 14.85]])],
    followups: ["How do I cancel Verizon's increase?", "What did Uber Eats cost me this year?", "Anything charging me this week?"],
  },
};

/** Follow-up question → the scenario that answers it, so chained demo turns feel continuous. */
export const DEMO_FOLLOWUPS: Record<string, string> = {
  "Which merchants drove it?": "habit",
  "How does that compare with my usual month?": "whatif",
  "Was it more purchases or bigger ones?": "weekend",
  "When did that start?": "weekend",
  "If I went back to last year's level, how much would I save?": "whatif",
  "What do I buy on weekends?": "attention",
  "Which category would save the most?": "attention",
};

export const DEMO_ORDER = ["august", "habit", "weekend", "whatif", "attention"];
