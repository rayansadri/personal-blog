"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Person, Split } from "@/lib/types";
import { paymentLinks } from "@/lib/splits";
import { formatDate } from "@/lib/dates";
import { moneyExact } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { Card, CardHeader } from "../ui/Card";
import { Stat } from "../ui/Stat";
import { Button } from "../ui/Button";
import { MerchantAvatar } from "../ui/MerchantAvatar";

export function SplitsBoard({ initialSplits, initialPeople }: { initialSplits: Split[]; initialPeople: Person[] }) {
  const router = useRouter();
  const [splits, setSplits] = useState(initialSplits);
  const [people, setPeople] = useState(initialPeople);
  const [editing, setEditing] = useState<Person | null>(null);

  const open = splits.flatMap((s) => s.shares.filter((sh) => sh.personId && !sh.settledAt).map((sh) => ({ ...sh, split: s })));
  const owed = open.reduce((a, s) => a + s.amount, 0);
  const byPerson = new Map<string, { name: string; amount: number; count: number }>();
  for (const o of open) {
    const cur = byPerson.get(o.personId!) ?? { name: o.name, amount: 0, count: 0 };
    byPerson.set(o.personId!, { name: o.name, amount: cur.amount + o.amount, count: cur.count + 1 });
  }

  const settle = async (split: Split, personId: string | null, settled: boolean) => {
    setSplits((prev) => prev.map((s) => (s.id === split.id ? { ...s, shares: s.shares.map((sh) => (sh.personId === personId ? { ...sh, settledAt: settled ? new Date().toISOString() : null } : sh)) } : s)));
    await fetch(`/api/splits/${split.id}`, { method: "PATCH", body: JSON.stringify({ personId, settled }) });
  };
  const remove = async (split: Split) => {
    setSplits((prev) => prev.filter((s) => s.id !== split.id));
    await fetch(`/api/splits/${split.id}`, { method: "DELETE" });
    router.refresh();
  };
  const savePerson = async (p: Person) => {
    const res = await fetch("/api/people", { method: "POST", body: JSON.stringify(p) });
    const d = (await res.json()) as { person?: Person };
    if (d.person) setPeople((prev) => prev.map((x) => (x.id === d.person!.id ? d.person! : x)));
    setEditing(null);
  };

  return (
    <div>
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_1fr_1fr] [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
          <Stat size="lg" label="Owed to you" value={moneyExact(owed)} hint={`${open.length} open ${open.length === 1 ? "share" : "shares"}`} />
          <Stat label="People" value={String(people.length)} />
          <Stat label="Splits" value={String(splits.length)} hint={`${splits.filter((s) => s.shares.every((sh) => !sh.personId || sh.settledAt)).length} fully settled`} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="By person" subtitle="Open balances" />
            {byPerson.size ? (
              <ul className="flex flex-col gap-2.5">
                {[...byPerson.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([id, p]) => {
                  const person = people.find((x) => x.id === id);
                  const links = paymentLinks(person, p.amount, "SpendLens splits");
                  const link = links.venmo ?? links.cashapp ?? links.paypal;
                  return (
                    <li key={id} className="flex items-center gap-3 text-[14px]">
                      <MerchantAvatar name={p.name} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="text-[12px] text-ink-muted">{p.count} open</span>
                      </span>
                      <span className="tabular font-semibold">{moneyExact(p.amount)}</span>
                      {link && <a href={link} target="_blank" rel="noreferrer" className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent">Request all</a>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13.5px] text-ink-muted">Nobody owes you anything. Suspicious, but nice.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="People" subtitle="Handles are used only to build payment links" />
            <ul className="divide-y divide-line">
              {people.map((p) => (
                <li key={p.id} className="py-2.5">
                  {editing?.id === p.id ? (
                    <PersonForm person={editing} onChange={setEditing} onSave={() => savePerson(editing)} onCancel={() => setEditing(null)} />
                  ) : (
                    <div className="flex items-center gap-3 text-[13.5px]">
                      <MerchantAvatar name={p.name} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.name}</span>
                        <span className="block truncate text-[12px] text-ink-muted">
                          {[p.venmo && `venmo @${p.venmo}`, p.cashapp && `cash $${p.cashapp}`, p.paypal && `paypal.me/${p.paypal}`].filter(Boolean).join(" · ") || "no payment handles yet"}
                        </span>
                      </span>
                      <button onClick={() => setEditing(p)} className="text-[12.5px] font-medium text-accent hover:underline">Edit</button>
                    </div>
                  )}
                </li>
              ))}
              {!people.length && <li className="py-2 text-[13.5px] text-ink-muted">Add people from the split sheet on any transaction.</li>}
            </ul>
          </Card>
        </div>

        <Card padded={false}>
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardHeader title="All splits" action={<Link href="/transactions" className="text-[13px] font-medium text-accent hover:underline">Split a purchase</Link>} />
          </div>
          <ul className="divide-y divide-line">
            {splits.map((s) => {
              const othersTotal = s.shares.filter((sh) => sh.personId).reduce((a, sh) => a + sh.amount, 0);
              const done = s.shares.every((sh) => !sh.personId || sh.settledAt);
              return (
                <li key={s.id} className={clsx("px-5 py-3 sm:px-6", done && "opacity-60")}>
                  <div className="flex items-center gap-3">
                    <MerchantAvatar name={s.merchant} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium">{s.merchant}{s.note ? <span className="font-normal text-ink-muted"> · {s.note}</span> : null}</p>
                      <p className="text-[12px] text-ink-muted">{formatDate(s.date, { year: "numeric" })} · {moneyExact(s.total)} total · your share {moneyExact(s.total - othersTotal)}</p>
                    </div>
                    <button onClick={() => remove(s)} className="text-[12px] text-ink-muted hover:text-negative">Remove</button>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-2 pl-[50px]">
                    {s.shares.filter((sh) => sh.personId).map((sh) => (
                      <li key={sh.personId}>
                        <button
                          onClick={() => settle(s, sh.personId, !sh.settledAt)}
                          className={clsx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors", sh.settledAt ? "border-positive/30 bg-positive-soft text-positive" : "border-line hover:bg-surface-2")}
                          title={sh.settledAt ? "Mark unpaid" : "Mark paid"}
                        >
                          <span className={clsx("flex h-4 w-4 items-center justify-center rounded-full text-[10px]", sh.settledAt ? "bg-positive text-white" : "border border-line-strong")}>{sh.settledAt ? "✓" : ""}</span>
                          {sh.name} · {moneyExact(sh.amount)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
            {!splits.length && <li className="px-6 py-10 text-center text-[13.5px] text-ink-muted">No splits yet. Open Transactions, find the dinner, tap the people icon.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function PersonForm({ person, onChange, onSave, onCancel }: { person: Person; onChange: (p: Person) => void; onSave: () => void; onCancel: () => void }) {
  const input = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[16px] outline-none focus:border-ink sm:text-[13.5px]";
  return (
    <div className="grid grid-cols-2 gap-2">
      <input value={person.name} onChange={(e) => onChange({ ...person, name: e.target.value })} placeholder="Name" className={clsx(input, "col-span-2")} />
      <input value={person.venmo ?? ""} onChange={(e) => onChange({ ...person, venmo: e.target.value })} placeholder="Venmo handle" className={input} />
      <input value={person.cashapp ?? ""} onChange={(e) => onChange({ ...person, cashapp: e.target.value })} placeholder="Cash App $cashtag" className={input} />
      <input value={person.paypal ?? ""} onChange={(e) => onChange({ ...person, paypal: e.target.value })} placeholder="PayPal.me name" className={input} />
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
