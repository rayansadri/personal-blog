"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, type Category, type Transaction, type TransactionType } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { formatDate, monthRange } from "@/lib/dates";
import { moneyExact } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { Badge } from "../ui/Badge";
import { MerchantAvatar } from "../ui/MerchantAvatar";
import { CategoryIcon } from "../ui/CategoryIcon";
import { SplitSheet } from "../splits/SplitSheet";
import type { Split } from "@/lib/types";
import { Button } from "../ui/Button";

const PAGE = 100;
const TYPES: Array<{ value: TransactionType | ""; label: string }> = [
  { value: "", label: "All types" },
  { value: "expense", label: "Spending" },
  { value: "income", label: "Income" },
  { value: "refund", label: "Refunds" },
  { value: "transfer", label: "Transfers" },
  { value: "payment", label: "Card payments" },
];

export function TransactionExplorer({ accounts }: { accounts: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  // Filters live in the URL so insights/charts can deep-link here.
  const get = (k: string) => params.get(k) ?? "";
  const month = get("month");
  const range = month ? monthRange(month) : null;
  const filters = useMemo(
    () => ({
      search: get("search"),
      account: get("account"),
      merchant: get("merchant"),
      category: get("category"),
      type: get("type"),
      from: get("from") || range?.from || "",
      to: get("to") || range?.to || "",
      minAmount: get("minAmount"),
      maxAmount: get("maxAmount"),
      recurring: get("recurring"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  );

  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [showFilters, setShowFilters] = useState(false);
  const [splitting, setSplitting] = useState<Transaction | null>(null);

  const onSplitSaved = (split: Split) => {
    const others = split.shares.filter((sh) => sh.personId !== null).reduce((a, sh) => a + sh.amount, 0);
    setItems((prev) => prev.map((t) => (t.id === split.transactionId ? { ...t, splitOthers: others } : t)));
    router.refresh();
  };

  const setFilter = useCallback(
    (patch: Record<string, string>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      setLoading(true);
      router.replace(`/transactions?${p.toString()}`);
    },
    [params, router],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== filters.search) setFilter({ search: searchDraft });
    }, 250);
    return () => clearTimeout(t);
  }, [searchDraft, filters.search, setFilter]);

  const buildQuery = useCallback(
    (off: number) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
      q.set("limit", String(PAGE));
      q.set("offset", String(off));
      return q.toString();
    },
    [filters],
  );

  // Fetch the first page whenever filters change. State updates happen in the
  // fetch callback, never synchronously inside the effect body.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transactions?${buildQuery(0)}`)
      .then((r) => r.json())
      .then((data: { items: Transaction[]; total: number }) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setOffset(data.items.length);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildQuery]);

  const loadMore = async () => {
    setLoading(true);
    const res = await fetch(`/api/transactions?${buildQuery(offset)}`);
    const data = (await res.json()) as { items: Transaction[]; total: number };
    setItems((prev) => [...prev, ...data.items]);
    setTotal(data.total);
    setOffset(offset + data.items.length);
    setLoading(false);
  };

  const activeChips: Array<[string, string]> = [
    ["merchant", filters.merchant],
    ["category", filters.category],
    ["account", filters.account],
    ["month", month],
    ["from", get("from")],
    ["to", get("to")],
    ["minAmount", filters.minAmount && `≥ $${filters.minAmount}`],
    ["maxAmount", filters.maxAmount && `≤ $${filters.maxAmount}`],
    ["recurring", filters.recurring === "true" ? "Recurring only" : ""],
  ].filter((c): c is [string, string] => Boolean(c[1]));

  const spendingTotal = items.filter((t) => t.transactionType === "expense").reduce((a, t) => a + Math.abs(t.amount), 0);

  const updateCategory = async (tx: Transaction, category: Category, applyToMerchant: boolean) => {
    setItems((prev) => prev.map((t) => (applyToMerchant ? (t.merchant === tx.merchant ? { ...t, category } : t) : t.id === tx.id ? { ...t, category } : t)));
    await fetch(`/api/transactions/${tx.id}`, { method: "PATCH", body: JSON.stringify({ category, applyToMerchant }) });
    router.refresh();
  };

  const input = "h-9 rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-ink";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["All", {}],
            ["Subscriptions", { recurring: "true", type: "expense" }],
            ["Refunds", { type: "refund" }],
            ["Large purchases", { minAmount: "200", type: "expense" }],
            ["Income", { type: "income" }],
          ] as Array<[string, Record<string, string>]>
        ).map(([label, f]) => {
          const active = Object.keys(f).length ? Object.entries(f).every(([k, v]) => get(k) === v) : !activeChips.length && !filters.type && !filters.recurring;
          return (
            <button key={label} onClick={() => (Object.keys(f).length ? router.replace(`/transactions?${new URLSearchParams(f).toString()}`) : router.replace("/transactions"))} className={clsx("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", active ? "bg-ink text-ink-inverse" : "bg-surface text-ink-secondary shadow-[var(--shadow-card)] hover:text-ink")}>
              {label}
            </button>
          );
        })}
        <span className="ml-auto flex gap-3 text-[12.5px]">
          <Link href="/recurring" className="font-medium text-accent hover:underline">Manage subscriptions</Link>
          <Link href="/splits" className="font-medium text-accent hover:underline">Splits</Link>
        </span>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search merchants or descriptions"
          className={clsx(input, "min-w-0 flex-1 sm:w-72 sm:flex-none")}
        />
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={clsx("flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13.5px] font-medium md:hidden", showFilters && "bg-surface-2")}
          aria-expanded={showFilters}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Filters{activeChips.length ? ` · ${activeChips.length}` : ""}
        </button>
      </div>
      <div className={clsx("mb-3 flex-wrap items-center gap-2", showFilters ? "flex" : "hidden md:flex")}>
        <select value={filters.account} onChange={(e) => setFilter({ account: e.target.value })} className={input}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.category} onChange={(e) => setFilter({ category: e.target.value })} className={input}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.type} onChange={(e) => setFilter({ type: e.target.value })} className={input}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="date" value={get("from")} onChange={(e) => setFilter({ from: e.target.value, month: "" })} className={input} aria-label="From date" />
        <input type="date" value={get("to")} onChange={(e) => setFilter({ to: e.target.value, month: "" })} className={input} aria-label="To date" />
        <input type="number" inputMode="decimal" value={filters.minAmount} onChange={(e) => setFilter({ minAmount: e.target.value })} placeholder="Min $" className={clsx(input, "w-24")} />
        <input type="number" inputMode="decimal" value={filters.maxAmount} onChange={(e) => setFilter({ maxAmount: e.target.value })} placeholder="Max $" className={clsx(input, "w-24")} />
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13.5px]">
          <input type="checkbox" checked={filters.recurring === "true"} onChange={(e) => setFilter({ recurring: e.target.checked ? "true" : "" })} className="h-4 w-4 accent-ink" />
          Recurring
        </label>
      </div>

      {activeChips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {activeChips.map(([k, v]) => (
            <button key={k} onClick={() => setFilter({ [k]: "" })} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium hover:bg-surface-3">
              {v}
              <span aria-hidden className="text-ink-muted">×</span>
            </button>
          ))}
          <button onClick={() => router.replace("/transactions")} className="text-[12.5px] text-ink-muted hover:text-ink">Clear all</button>
        </div>
      )}

      <p className="mb-3 text-[13px] text-ink-muted">
        {loading && items.length === 0 ? "Loading…" : `${total.toLocaleString()} transactions${items.length < total ? ` · showing ${items.length}` : ""} · ${moneyExact(spendingTotal)} spending shown`}
      </p>

      {/* Phone: touch-friendly list */}
      <ul className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-card)] md:hidden">
        {items.map((t) => (
          <MobileRow key={t.id} tx={t} onCategory={updateCategory} onMerchantClick={() => setFilter({ merchant: t.merchant })} onSplit={() => setSplitting(t)} />
        ))}
        {!loading && items.length === 0 && <li className="px-4 py-10 text-center text-[13.5px] text-ink-muted">No transactions match these filters.</li>}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-card)] md:block">
        <table className="w-full text-left text-[13.5px]">
          <thead className="bg-surface-2 text-[12px] text-ink-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Merchant</th>
              <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Account</th>
              <th className="px-3 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <Row key={t.id} tx={t} onCategory={updateCategory} onMerchantClick={() => setFilter({ merchant: t.merchant })} onSplit={() => setSplitting(t)} />
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">No transactions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {splitting && <SplitSheet tx={splitting} onClose={() => setSplitting(null)} onSaved={onSplitSaved} />}
      {items.length < total && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={loading}>{loading ? "Loading…" : "Load more"}</Button>
        </div>
      )}
    </div>
  );
}

function Row({ tx, onCategory, onMerchantClick, onSplit }: { tx: Transaction; onCategory: (tx: Transaction, c: Category, all: boolean) => void; onMerchantClick: () => void; onSplit: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Category | null>(null);
  const isOut = tx.amount < 0;
  const muted = tx.transactionType === "transfer" || tx.transactionType === "payment";

  return (
    <tr className={clsx("group border-t border-line align-top hover:bg-surface-2", muted && "text-ink-muted")}>
      <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">{formatDate(tx.date)}</td>
      <td className="max-w-[260px] px-3 py-3">
        <button onClick={onMerchantClick} className={clsx("block truncate text-left font-medium hover:underline", !muted && "text-ink")}>{tx.merchant}</button>
        <span className="block truncate text-[12px] text-ink-muted">{tx.description}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          {tx.recurring && <Badge>Recurring</Badge>}
          {(tx.splitOthers ?? 0) > 0 && <Badge tone="accent">Split · your share {moneyExact(Math.abs(tx.amount) - (tx.splitOthers ?? 0))}</Badge>}
          {tx.flags.includes("possible_double_charge") && <Badge tone="warning">Possible double charge</Badge>}
          {tx.transactionType === "refund" && <Badge tone="positive">Refund</Badge>}
          {tx.transactionType === "payment" && <Badge>Card payment</Badge>}
          {tx.transactionType === "transfer" && <Badge>Transfer</Badge>}
          {tx.transactionType === "income" && <Badge tone="positive">Income</Badge>}
        </span>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-3 text-ink-secondary lg:table-cell">{tx.account}</td>
      <td className="whitespace-nowrap px-3 py-3">
        {tx.transactionType === "expense" || tx.transactionType === "refund" ? (
          editing ? (
            <span className="flex flex-col gap-1.5">
              <select
                autoFocus
                value={pending ?? tx.category}
                onChange={(e) => setPending(e.target.value as Category)}
                className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] outline-none"
              >
                {CATEGORIES.filter((c) => c !== "Income" && c !== "Transfer").map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="flex gap-1">
                <button className="rounded-md bg-ink px-2 py-1 text-[11.5px] font-medium text-ink-inverse" onClick={() => { onCategory(tx, pending ?? tx.category, false); setEditing(false); }}>This one</button>
                <button className="rounded-md border border-line px-2 py-1 text-[11.5px] font-medium" onClick={() => { onCategory(tx, pending ?? tx.category, true); setEditing(false); }}>All {tx.merchant}</button>
                <button className="px-1.5 text-[11.5px] text-ink-muted" onClick={() => setEditing(false)}>Cancel</button>
              </span>
            </span>
          ) : (
            <button onClick={() => { setPending(tx.category); setEditing(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-1 py-0.5 hover:border-line">
              <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[tx.category] }} />
              {tx.category}
            </button>
          )
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </td>
      <td className={clsx("tabular whitespace-nowrap px-4 py-3 text-right font-medium", !isOut && !muted && "text-positive")}>
        {isOut ? moneyExact(Math.abs(tx.amount)) : `+${moneyExact(tx.amount)}`}
        {tx.transactionType === "expense" && (
          <button onClick={onSplit} className="mt-1 block w-full text-right text-[11.5px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={`Split ${tx.merchant}`}>
            {(tx.splitOthers ?? 0) > 0 ? "Edit split" : "Split"}
          </button>
        )}
      </td>
    </tr>
  );
}


function MobileRow({ tx, onCategory, onMerchantClick, onSplit }: { tx: Transaction; onCategory: (tx: Transaction, c: Category, all: boolean) => void; onMerchantClick: () => void; onSplit: () => void }) {
  const [editing, setEditing] = useState(false);
  const isOut = tx.amount < 0;
  const muted = tx.transactionType === "transfer" || tx.transactionType === "payment";
  const editable = tx.transactionType === "expense" || tx.transactionType === "refund";
  return (
    <li className="border-b border-line last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onMerchantClick} className="shrink-0">
          <MerchantAvatar name={tx.merchant} category={editable ? tx.category : undefined} size={40} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={clsx("truncate text-[14.5px] font-medium", muted && "text-ink-muted")}>{tx.merchant}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span>{formatDate(tx.date)}</span>
            <span aria-hidden>·</span>
            {editable ? (
              <button onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1">
                <CategoryIcon category={tx.category} size={14} />
                {tx.category}
              </button>
            ) : (
              <span className="capitalize">{tx.transactionType === "payment" ? "Card payment" : tx.transactionType}</span>
            )}
            {tx.flags.includes("possible_double_charge") && <Badge tone="warning">Double?</Badge>}
            {tx.recurring && <Badge>Recurring</Badge>}
            {(tx.splitOthers ?? 0) > 0 && <Badge tone="accent">Split</Badge>}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className={clsx("tabular block text-[15px] font-semibold", !isOut && !muted && "text-positive", muted && "text-ink-muted")}>
            {isOut ? moneyExact(Math.abs(tx.amount)) : `+${moneyExact(tx.amount)}`}
          </span>
          {(tx.splitOthers ?? 0) > 0 && <span className="tabular block text-[11px] text-ink-muted">you {moneyExact(Math.abs(tx.amount) - (tx.splitOthers ?? 0))}</span>}
        </span>
        {editable && (
          <button onClick={onSplit} aria-label={`Split ${tx.merchant}`} className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><path d="M2 20c0-3 2.5-5 5-5s5 2 5 5M12 20c0-3 2.5-5 5-5s5 2 5 5" /></svg>
          </button>
        )}
      </div>
      {editing && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
          {CATEGORIES.filter((c) => c !== "Income" && c !== "Transfer").map((c) => (
            <button
              key={c}
              onClick={() => { onCategory(tx, c, false); setEditing(false); }}
              className={clsx("flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium", c === tx.category ? "border-ink bg-ink text-ink-inverse" : "border-line")}
            >
              <CategoryIcon category={c} size={16} />
              {c}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
