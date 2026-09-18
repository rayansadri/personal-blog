"use client";

import { useEffect, useSyncExternalStore } from "react";
import { clsx } from "@/lib/clsx";

export type ThemePreference = "system" | "light" | "dark";
const KEY = "spendlens-theme";
const SYNC_EVENT = "spendlens-theme-change";

/** Apply a preference to <html>. Mirrors the inline bootstrap script in layout.tsx. */
export function applyTheme(pref: ThemePreference) {
  const resolved = pref === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-pref", pref);
}

function readPref(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {}
  return "system";
}

/** External store: localStorage + a window event so every toggle instance stays in sync. */
function subscribe(cb: () => void) {
  window.addEventListener(SYNC_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SYNC_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePreference);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPref() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const set = (p: ThemePreference) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {}
    applyTheme(p);
    window.dispatchEvent(new CustomEvent<ThemePreference>(SYNC_EVENT, { detail: p }));
  };

  const options: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
    { value: "light", label: "Light", icon: <IconSun /> },
    { value: "dark", label: "Dark", icon: <IconMoon /> },
    { value: "system", label: "Auto", icon: <IconAuto /> },
  ];

  return (
    <div role="radiogroup" aria-label="Appearance" className={clsx("inline-flex rounded-full bg-surface-3/70 p-0.5", compact ? "gap-0" : "gap-0.5")}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => set(o.value)}
          title={o.label}
          className={clsx(
            "flex items-center justify-center gap-1.5 rounded-full text-[12px] font-medium transition-colors",
            compact ? "h-7 w-7" : "h-7 px-2.5",
            pref === o.value ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-ink-muted hover:text-ink",
          )}
        >
          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{o.icon}</span>
          {!compact && o.label}
        </button>
      ))}
    </div>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconSun() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}
function IconAuto() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}
