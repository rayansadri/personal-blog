"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Person, Split, Transaction } from "@/lib/types";
import { computeShares, paymentLinks, splitMessage, type ShareInput } from "@/lib/splits";
import { formatDate } from "@/lib/dates";
import { moneyExact } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { Button } from "../ui/Button";
import { MerchantAvatar } from "../ui/MerchantAvatar";

interface Props {
  tx: Transaction;
  onClose: () => void;
  onSaved: (split: Split) => void;
}

/**
 * Bottom sheet (phone) / dialog (desktop) to split one transaction with
 * people, preview the iMessage text, and send or copy it.
 */
export function SplitSheet({ tx, onClose, onSaved }: Props) {
  const total = Math.abs(tx.amount);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeMe, setIncludeMe] = useState(true);
  const [custom, setCustom] = useState<Record<string, string>>({}); // personId|me -> amount string
  const [note, setNote] = useState("");
  const [newName, setNewName] = useState("");
  const [newVenmo, setNewVenmo] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/splits?transactionId=${encodeURIComponent(tx.id)}`)
      .then((r) => r.json())
      .then((d: { split: Split | null; people: Person[] }) => {
        setPeople(d.people);
        if (d.split) {
          setSelected(d.split.shares.filter((s) => s.personId).map((s) => s.personId!));
          setIncludeMe(d.split.shares.some((s) => s.personId === null));
          setNote(d.split.note ?? "");
        } else if (d.people.length === 1) {
          setSelected([d.people[0].id]);
        }
      });
  }, [tx.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const inputs: ShareInput[] = useMemo(() => {
    const list: ShareInput[] = [];
    if (includeMe) list.push({ personId: null, name: "You", amount: custom.me ? Number(custom.me) : undefined });
    for (const id of selected) {
      const p = people.find((x) => x.id === id);
      if (p) list.push({ personId: id, name: p.name, amount: custom[id] ? Number(custom[id]) : undefined });
    }
    return list;
  }, [includeMe, selected, people, custom]);

  const shares = useMemo(() => computeShares(total, inputs), [total, inputs]);
  const sum = shares.reduce((a, s) => a + s.amount, 0);
  const balanced = Math.abs(sum - total) < 0.02;
  const others = shares.filter((s) => s.personId !== null);
  const dateLabel = formatDate(tx.date);
  const message = useMemo(() => splitMessage({ merchant: tx.merchant, dateLabel, total, shares, people, note: note || null }), [tx.merchant, dateLabel, total, shares, people, note]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const addPerson = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/people", { method: "POST", body: JSON.stringify({ name: newName, venmo: newVenmo }) });
    const d = (await res.json()) as { person?: Person };
    if (d.person) {
      setPeople((p) => [...p, d.person!].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected((s) => [...s, d.person!.id]);
    }
    setNewName("");
    setNewVenmo("");
    setAdding(false);
  };

  const save = async (): Promise<Split | null> => {
    if (!others.length) {
      setError("Pick at least one person to split with.");
      return null;
    }
    if (!balanced) {
      setError("Shares don't add up to the total.");
      return null;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/splits", { method: "POST", body: JSON.stringify({ transactionId: tx.id, shares: inputs, note: note || null }) });
    const d = (await res.json()) as { split?: Split; error?: string };
    setBusy(false);
    if (!d.split) {
      setError(d.error ?? "Could not save");
      return null;
    }
    onSaved(d.split);
    return d.split;
  };

  const share = async () => {
    const saved = await save();
    if (!saved) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: message });
        onClose();
        return;
      } catch {
        /* user cancelled: fall through to copy */
      }
    }
    await copy();
    setTimeout(onClose, 900);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Select the text and copy it manually.");
    }
  };

  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const input = "h-9 rounded-lg border border-line bg-surface px-2.5 text-[16px] outline-none focus:border-ink sm:text-[13.5px]";

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Split ${tx.merchant}`}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.25)] motion-safe:animate-[sheetup_220ms_ease-out] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:motion-safe:animate-[popin_180ms_ease-out]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          <MerchantAvatar name={tx.merchant} category={tx.category} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[17px] font-semibold tracking-tight">Split {tx.merchant}</h3>
            <p className="text-[12.5px] text-ink-muted">{dateLabel} · {moneyExact(total)} · {tx.account}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2" aria-label="Close">×</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {/* People */}
          <p className="mb-2 text-[12.5px] font-medium text-ink-secondary">Who&apos;s in</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={includeMe} onClick={() => setIncludeMe((v) => !v)}>You</Chip>
            {people.map((p) => (
              <Chip key={p.id} active={selected.includes(p.id)} onClick={() => toggle(p.id)}>
                {p.name}
                {p.venmo && <span className="ml-1 opacity-60">· venmo</span>}
              </Chip>
            ))}
            <button onClick={() => setAdding((v) => !v)} className="rounded-full border border-dashed border-line-strong px-3 py-1.5 text-[13px] text-ink-secondary hover:bg-surface-2">+ Add person</button>
          </div>
          {adding && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className={clsx(input, "w-36")} autoFocus />
              <input value={newVenmo} onChange={(e) => setNewVenmo(e.target.value)} placeholder="Venmo @handle (optional)" className={clsx(input, "w-52")} />
              <Button size="sm" onClick={addPerson} disabled={!newName.trim()}>Add</Button>
              <span className="w-full text-[11.5px] text-ink-muted">Cash App and PayPal handles can be added on the Splits page. Stored only on this computer.</span>
            </div>
          )}

          {/* Shares */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-ink-secondary">Shares</p>
            <button onClick={() => setCustom({})} className="text-[12px] text-ink-muted hover:text-ink">Reset to equal</button>
          </div>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
            {shares.map((s) => {
              const key = s.personId ?? "me";
              return (
                <li key={key} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-[14px] font-medium">{s.name}</span>
                  <span className="text-[13px] text-ink-muted">$</span>
                  <input
                    value={custom[key] ?? s.amount.toFixed(2)}
                    onChange={(e) => setCustom((c) => ({ ...c, [key]: e.target.value }))}
                    inputMode="decimal"
                    className={clsx(input, "tabular w-24 text-right", custom[key] && "border-ink")}
                  />
                </li>
              );
            })}
            {shares.length === 0 && <li className="px-3 py-3 text-[13px] text-ink-muted">Pick who was there.</li>}
          </ul>
          <p className={clsx("mt-1.5 text-[12px]", balanced ? "text-ink-muted" : "text-negative")}>
            {balanced ? `${shares.length} ways · adds up to ${moneyExact(total)}` : `Off by ${moneyExact(Math.abs(sum - total))}`}
          </p>

          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. birthday dinner)" className={clsx(input, "mt-4 w-full")} />

          {/* Message */}
          <p className="mb-2 mt-5 text-[12.5px] font-medium text-ink-secondary">Message</p>
          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-surface-2 px-4 py-3 font-sans text-[13.5px] leading-relaxed">{message}</pre>

          {/* Per-person request links */}
          {others.some((s) => people.find((p) => p.id === s.personId)?.venmo || people.find((p) => p.id === s.personId)?.cashapp || people.find((p) => p.id === s.personId)?.paypal) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((s) => {
                const person = people.find((p) => p.id === s.personId);
                const links = paymentLinks(person, s.amount, `${tx.merchant} ${dateLabel}`);
                return (
                  <span key={s.personId} className="flex flex-wrap gap-1.5">
                    {links.venmo && <a href={links.venmo} target="_blank" rel="noreferrer" className="rounded-full bg-[#008CFF]/15 px-3 py-1 text-[12.5px] font-medium text-[#0074d4] dark:text-[#5eb5ff]">Request {s.name} on Venmo</a>}
                    {links.cashapp && <a href={links.cashapp} target="_blank" rel="noreferrer" className="rounded-full bg-[#00D632]/15 px-3 py-1 text-[12.5px] font-medium text-[#00892a] dark:text-[#4fe07a]">Cash App</a>}
                    {links.paypal && <a href={links.paypal} target="_blank" rel="noreferrer" className="rounded-full bg-[#003087]/15 px-3 py-1 text-[12.5px] font-medium text-[#003087] dark:text-[#7aa7ff]">PayPal</a>}
                  </span>
                );
              })}
            </div>
          )}
          {error && <p className="mt-3 text-[13px] text-negative">{error}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button onClick={share} disabled={busy || !others.length} className="flex-1">
            {canShare ? "Send…" : copied ? "Copied!" : "Save & copy message"}
          </Button>
          {canShare && (
            <Button variant="secondary" onClick={async () => (await save()) && copy()} disabled={busy || !others.length}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={clsx("rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors", active ? "border-ink bg-ink text-ink-inverse" : "border-line bg-surface hover:bg-surface-2")}>
      {children}
    </button>
  );
}
