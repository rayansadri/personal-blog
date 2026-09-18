"use client";

import { useState } from "react";
import { ACCOUNT_KINDS, CARD_THEMES, type Account, type AccountKind, type CardTheme } from "@/lib/types";
import { clsx } from "@/lib/clsx";
import { Button } from "../ui/Button";
import { CardTile, KIND_LABEL, THEME_STYLES } from "./CardTile";

export function CardForm({
  initial,
  onSaved,
  onCancel,
  onDelete,
}: {
  initial?: Account;
  onSaved: (a: Account) => void;
  onCancel: () => void;
  onDelete?: (deleteTransactions: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [last4, setLast4] = useState(initial?.last4 ?? "");
  const [holder, setHolder] = useState(initial?.holder ?? "");
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? "credit");
  const [theme, setTheme] = useState<CardTheme>(initial?.theme ?? "graphite");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const preview: Account = {
    name: name || "New card",
    nickname: nickname || null,
    last4: last4.replace(/\D/g, "").slice(-4) || null,
    holder: holder || null,
    kind,
    theme,
    network: null,
    createdAt: initial?.createdAt ?? "",
  };

  const save = async () => {
    if (!name.trim()) return setError("Give the card a name. It should match the account name you use when importing.");
    setBusy(true);
    setError(null);
    try {
      const res = initial
        ? await fetch(`/api/accounts/${encodeURIComponent(initial.name)}`, { method: "PATCH", body: JSON.stringify({ name, nickname, last4, holder, kind, theme }) })
        : await fetch("/api/accounts", { method: "POST", body: JSON.stringify({ name, nickname, last4, holder, kind, theme }) });
      const data = (await res.json()) as { account?: Account; error?: string };
      if (!res.ok || !data.account) throw new Error(data.error ?? "Could not save");
      onSaved(data.account);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] outline-none focus:border-ink";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col items-start gap-3">
        <CardTile account={preview} size="lg" />
        <p className="text-[12.5px] text-ink-muted">Live preview. Only the last four digits are stored; never the full number.</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Account name (matches imports)">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amex Gold" className={input} />
          </Field>
          <Field label="Nickname (optional)">
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Travel card" className={input} />
          </Field>
          <Field label="Last 4 digits">
            <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="7481" className={clsx(input, "tabular tracking-widest")} />
          </Field>
          <Field label="Card holder (optional)">
            <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Name on the card" className={input} />
          </Field>
        </div>
        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={clsx("rounded-full border px-3.5 py-1.5 text-[13px] font-medium", kind === k ? "border-ink bg-ink text-ink-inverse" : "border-line hover:bg-surface-2")}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2.5">
            {CARD_THEMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-label={THEME_STYLES[t].label}
                className={clsx("h-8 w-8 rounded-full border-2 transition-transform", theme === t ? "scale-110 border-ink" : "border-transparent hover:scale-105")}
                style={{ background: THEME_STYLES[t].bg, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
              />
            ))}
          </div>
        </Field>
        {error && <p className="text-[13.5px] text-negative">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Add card"}</Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          {initial && onDelete && (
            <div className="ml-auto">
              {confirmDelete ? (
                <span className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-ink-secondary">Remove card…</span>
                  <Button variant="secondary" size="sm" onClick={() => onDelete(false)}>Keep transactions</Button>
                  <Button variant="danger" size="sm" onClick={() => onDelete(true)}>Delete its transactions too</Button>
                  <button className="text-ink-muted" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="text-[13px] text-ink-muted hover:text-negative">Remove card</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-secondary">{label}</span>
      {children}
    </label>
  );
}
