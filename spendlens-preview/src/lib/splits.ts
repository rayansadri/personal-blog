import type { Person } from "./types";

/**
 * Pure helpers for bill splitting: share math, payment links and the
 * iMessage-ready text. No I/O, so they run on both server and client.
 */

export interface ShareInput {
  personId: string | null; // null = you
  name: string;
  /** Custom amount; when omitted the remainder is split equally among such shares. */
  amount?: number;
}

/** Split `total` across shares. Fixed amounts first, remainder equally, cents balanced to the total. */
export function computeShares(total: number, inputs: ShareInput[]): Array<ShareInput & { amount: number }> {
  const cents = Math.round(total * 100);
  const fixed = inputs.filter((s) => typeof s.amount === "number");
  const flexible = inputs.filter((s) => typeof s.amount !== "number");
  const fixedCents = fixed.reduce((a, s) => a + Math.round((s.amount ?? 0) * 100), 0);
  const remaining = Math.max(0, cents - fixedCents);
  const base = flexible.length ? Math.floor(remaining / flexible.length) : 0;
  let leftover = flexible.length ? remaining - base * flexible.length : 0;
  return inputs.map((s) => {
    if (typeof s.amount === "number") return { ...s, amount: s.amount };
    const extra = leftover > 0 ? 1 : 0;
    leftover -= extra;
    return { ...s, amount: (base + extra) / 100 };
  });
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function paymentLinks(person: Person | null | undefined, amount: number, note: string) {
  const amt = amount.toFixed(2);
  const n = encodeURIComponent(note.slice(0, 80));
  return {
    venmo: person?.venmo ? `https://venmo.com/${encodeURIComponent(person.venmo)}?txn=charge&amount=${amt}&note=${n}` : null,
    cashapp: person?.cashapp ? `https://cash.app/$${encodeURIComponent(person.cashapp)}/${amt}` : null,
    paypal: person?.paypal ? `https://paypal.me/${encodeURIComponent(person.paypal)}/${amt}` : null,
  };
}

/** The text you paste into iMessage. Short, no transaction ids, only what the other person needs. */
export function splitMessage(opts: {
  merchant: string;
  dateLabel: string;
  total: number;
  shares: Array<{ name: string; amount: number; personId: string | null }>;
  people: Person[];
  note?: string | null;
}): string {
  const others = opts.shares.filter((s) => s.personId !== null);
  const ways = opts.shares.length;
  const lines: string[] = [];
  lines.push(`${opts.merchant} on ${opts.dateLabel} was ${money(opts.total)}${opts.note ? ` (${opts.note})` : ""}.`);
  if (!others.length) {
    lines.push("Pick who to split with.");
    return lines.join("\n");
  }
  const equal = others.every((s) => Math.abs(s.amount - others[0].amount) < 0.01) && opts.shares.every((s) => Math.abs(s.amount - opts.shares[0].amount) < 0.011);
  if (equal && others.length === 1) lines.push(`Split ${ways} ways, your half is ${money(others[0].amount)}.`);
  else if (equal) lines.push(`Split ${ways} ways, ${money(others[0].amount)} each.`);
  for (const s of others) {
    const person = opts.people.find((p) => p.id === s.personId);
    const links = paymentLinks(person, s.amount, `${opts.merchant} ${opts.dateLabel}`);
    const link = links.venmo ?? links.cashapp ?? links.paypal;
    if (!equal || others.length > 1) lines.push(`${s.name}: ${money(s.amount)}${link ? ` · ${link}` : ""}`);
    else if (link) lines.push(link);
  }
  return lines.join("\n");
}
