import type { Insight } from "./insights";

/**
 * Short, playful one-liners attached to insights. Deterministic per insight id
 * so the same insight always gets the same quip. Teasing, never mean.
 */
const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

type Ctx = { i: Insight; pct: string; n: number; merchant: string; amount: string; category: string };

const QUIPS: Record<Insight["kind"], Array<(c: Ctx) => string>> = {
  "total-change": [
    ({ i }) => (i.tone === "up" ? "Spicy month. Your wallet is still recovering." : "Look at you, spending less like a functioning adult."),
    ({ i, pct }) => (i.tone === "up" ? `${pct} more than last month. Main character energy.` : `${pct} less than last month. Quiet luxury.`),
    ({ i }) => (i.tone === "up" ? "August said “treat yourself” and you said “say less.”" : "Less spending, same life. That's the dream."),
  ],
  "vs-average": [
    ({ i }) => (i.tone === "up" ? "Above your usual. Chaos era, respectfully." : "Below your usual. Who is she?"),
    ({ i, pct }) => (i.tone === "up" ? `${pct} over your average. The vibes were expensive.` : `${pct} under your average. Frugal arc unlocked.`),
  ],
  "category-change": [
    ({ category, i, pct }) =>
      i.tone === "up"
        ? `${category} up ${pct}. ${CATEGORY_ROAST[category] ?? "Bold choices were made."}`
        : `${category} down ${pct}. Discipline? In this economy?`,
    ({ category, i }) => (i.tone === "up" ? `${category} is having a moment. So is your card.` : `${category} chilled out this month. Respect.`),
  ],
  "merchant-change": [
    ({ merchant, i, pct }) => (i.tone === "up" ? `${merchant} up ${pct}. ${MERCHANT_ROAST(merchant)}` : `${merchant} down ${pct}. They miss you.`),
    ({ merchant, i }) => (i.tone === "up" ? `${merchant} knows you by name at this point.` : `You and ${merchant} are on a break.`),
  ],
  frequency: [
    ({ n }) => `Bruh. ${n} times. The stove is right there.`,
    ({ n }) => `${n} orders. The delivery drivers know your door better than your friends do.`,
    ({ n }) => `${n} times. Your kitchen has filed a missing persons report.`,
  ],
  subscriptions: [
    ({ n }) => `${n} subscriptions. You're basically a venture fund for streaming.`,
    ({ n }) => `${n} things renew without asking. Freeloaders.`,
    () => "Every month, quietly, they take a little piece of you.",
  ],
  weekend: [
    () => "Weekdays: monk. Weekends: main character.",
    () => "Saturday you is a different person with a different budget.",
    () => "The weekend hits and suddenly money is a social construct.",
  ],
  "bill-increase": [
    ({ merchant }) => `${merchant} slid in a price hike and hoped you wouldn't notice. You noticed.`,
    ({ merchant, amount }) => `${merchant} wants ${amount} more a month. For what, exactly?`,
  ],
  "double-charge": [
    ({ merchant }) => `${merchant}, twice, same amount, a day apart. Someone owes you a refund.`,
    () => "Déjà vu on your statement. Worth a message to support.",
  ],
  "new-merchant": [
    ({ merchant, amount }) => `New in town: ${merchant}. First date and it's already ${amount}.`,
    ({ merchant }) => `${merchant} just entered the chat. Loudly.`,
  ],
  "large-transaction": [
    ({ amount }) => `One tap, ${amount} gone. Hope it sparks joy.`,
    ({ merchant }) => `${merchant} got the big one this month. No notes.`,
  ],
  refunds: [
    () => "Money came back. Frame it.",
    ({ amount }) => `${amount} returned to sender. A rare W.`,
  ],
};

const CATEGORY_ROAST: Record<string, string> = {
  Shopping: "Retail therapy is still therapy, technically.",
  Dining: "Chef's kiss, mostly other people's chefs.",
  Delivery: "You really not cooking, eh?",
  Entertainment: "Living, laughing, spending.",
  Travel: "Passport: happy. Balance: less so.",
  Transportation: "Places to be, apparently.",
  Groceries: "At least it's food you'll cook. Right?",
  Health: "Investing in the vessel. Fair.",
  Subscriptions: "Another thing that renews forever.",
  Utilities: "Blame the weather.",
  Housing: "Rent doesn't do sales.",
};

function MERCHANT_ROAST(merchant: string): string {
  const m = merchant.toLowerCase();
  if (/uber eats|doordash|grubhub|postmates|deliveroo/.test(m)) return "You really not cooking, eh? Just Uber Eats.";
  if (/amazon/.test(m)) return "The boxes are multiplying.";
  if (/starbucks|coffee|philz|blue bottle/.test(m)) return "Caffeine is a lifestyle, not a habit.";
  if (/uber|lyft/.test(m)) return "Walking is free. Just saying.";
  if (/apple/.test(m)) return "Tim Cook says thanks.";
  if (/target|costco|walmart/.test(m)) return "Went in for one thing. Came out with a lifestyle.";
  return "Bold choices were made.";
}

export function quipFor(i: Insight): string {
  const list = QUIPS[i.kind];
  if (!list?.length) return "";
  const pctMatch = i.title.match(/(\d+)%/);
  const nMatch = i.title.match(/(\d+)\s+(times|visits|recurring|purchase|orders)/) ?? i.detail.match(/(\d+) (charges|refunds)/);
  const amtMatch = i.title.match(/\$[\d,]+/);
  const ctx: Ctx = {
    i,
    pct: pctMatch ? `${pctMatch[1]}%` : "a lot",
    n: nMatch ? Number(nMatch[1]) : 0,
    merchant: i.merchant ?? "That merchant",
    amount: amtMatch ? amtMatch[0] : fmt(i.impact),
    category: i.category ?? "That category",
  };
  const idx = hash(i.id) % list.length;
  return list[idx](ctx);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
