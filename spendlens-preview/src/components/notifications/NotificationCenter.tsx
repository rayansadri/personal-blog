"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/analytics/notifications";
import { timeAgo } from "@/lib/analytics/notifications";
import { clsx } from "@/lib/clsx";
import { NotificationIcon } from "./NotificationIcon";

const POLL_MS = 60_000;

export function NotificationCenter({ align = "left" }: { align?: "left" | "right" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [pulse, setPulse] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevUnread = useRef<number | null>(null);
  // Anchor for the desktop popover. The panel is portaled to <body> so blurred
  // headers (which create containing blocks) cannot trap it.
  const [anchor, setAnchor] = useState<{ top: number; left: number; right: number } | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const toggle = () => {
    if (!open) {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.bottom + 8, left: r.left, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as { notifications: Notification[]; unread: number };
      setItems(data.notifications);
      if (prevUnread.current != null && data.unread > prevUnread.current) {
        setPulse(true);
        setTimeout(() => setPulse(false), 1200);
      }
      prevUnread.current = data.unread;
    } catch {
      /* offline is fine: local app */
    }
  }, []);

  useEffect(() => {
    // Initial fetch is scheduled, not run synchronously in the effect body.
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const unread = items?.filter((n) => !n.read).length ?? 0;

  // Mirror the unread count in the tab title so a parked tab still nags you.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread]);

  const markRead = async (ids: string[], read = true) => {
    setItems((prev) => prev?.map((n) => (ids.includes(n.id) ? { ...n, read } : n)) ?? prev);
    await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ ids, read }) });
  };
  const markAll = async () => {
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ all: true }) });
  };

  const openItem = (n: Notification) => {
    if (!n.read) markRead([n.id]);
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  const visible = (items ?? []).filter((n) => filter === "all" || !n.read);
  const groups = ["Today", "This week", "Earlier"] as const;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={toggle}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        className={clsx(
          "relative flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface hover:text-ink",
          open && "bg-surface text-ink shadow-[var(--shadow-card)]",
        )}
      >
        <svg viewBox="0 0 24 24" className={clsx("h-[19px] w-[19px] origin-top", pulse && "motion-safe:animate-[ring_1s_ease-in-out]")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 0 1 12 0v4l1.7 2.6a1 1 0 0 1-.8 1.4H5.1a1 1 0 0 1-.8-1.4L6 13z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-negative px-1 text-[10.5px] font-semibold text-white ring-2 ring-bg">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] sm:hidden" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            style={
              {
                "--top": `${anchor?.top ?? 56}px`,
                "--left": align === "left" ? `${anchor?.left ?? 16}px` : "auto",
                "--right": align === "right" ? `${anchor?.right ?? 16}px` : "auto",
              } as React.CSSProperties
            }
            className={clsx(
              "fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-line motion-safe:animate-[popin_180ms_ease-out]",
              "sm:inset-auto sm:top-[var(--top)] sm:left-[var(--left)] sm:right-[var(--right)] sm:h-auto sm:max-h-[min(72vh,640px)] sm:w-[400px]",
            )}
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
              <h3 className="text-[17px] font-semibold tracking-tight">Notifications</h3>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button onClick={markAll} className="text-[12.5px] font-medium text-accent hover:underline">
                    Mark all as read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 sm:hidden" aria-label="Close">
                  ×
                </button>
              </div>
            </div>
            <div className="flex gap-1 px-5 pb-3">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    "rounded-full px-3 py-1 text-[12.5px] font-medium capitalize transition-colors",
                    filter === f ? "bg-ink text-ink-inverse" : "text-ink-secondary hover:bg-surface-2",
                  )}
                >
                  {f}
                  {f === "unread" && unread > 0 && <span className="ml-1 opacity-70">{unread}</span>}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
              {items == null ? (
                <p className="px-5 py-8 text-center text-[13.5px] text-ink-muted">Loading…</p>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
                  </span>
                  <p className="text-[14px] font-medium">{filter === "unread" ? "You're all caught up" : "Nothing yet"}</p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    {filter === "unread" ? "New activity will show up here as you import statements." : "Import a CSV and SpendLens will start noticing things."}
                  </p>
                </div>
              ) : (
                groups.map((g) => {
                  const rows = visible.filter((n) => n.group === g);
                  if (!rows.length) return null;
                  return (
                    <section key={g}>
                      <h4 className="sticky top-0 bg-surface/95 px-5 pb-1.5 pt-3 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted backdrop-blur">{g}</h4>
                      <ul>
                        {rows.map((n) => (
                          <li key={n.id}>
                            <button
                              onClick={() => openItem(n)}
                              className={clsx("flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2", !n.read && "bg-accent-soft/40")}
                            >
                              <NotificationIcon icon={n.icon} tone={n.tone} />
                              <span className="min-w-0 flex-1">
                                <span className={clsx("block text-[13.5px] leading-snug tracking-tight", n.read ? "font-medium text-ink-secondary" : "font-semibold text-ink")}>{n.title}</span>
                                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">{n.body}</span>
                                <span className="mt-1 block text-[11.5px] text-ink-faint">{timeAgo(n.at)}</span>
                              </span>
                              {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })
              )}
            </div>
            <div className="border-t border-line px-5 py-2.5 text-center">
              <Link href="/insights" onClick={() => setOpen(false)} className="text-[12.5px] font-medium text-accent hover:underline">
                See all insights
              </Link>
            </div>
          </div>
        </>,
        document.body,
        )}
    </div>
  );
}
