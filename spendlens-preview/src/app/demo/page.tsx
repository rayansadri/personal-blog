import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demo" };

/**
 * Portfolio screenshot studio: the app rendered inside an iPhone frame with
 * scripted, fabricated content. Not linked from navigation.
 */
const SCREENS: Array<{ key: string; label: string; src: string }> = [
  { key: "home", label: "Home", src: "/?demo=1" },
  { key: "ask", label: "Ask · Why was August expensive?", src: "/ask?demo=august" },
  { key: "habit", label: "Ask · Costliest habit", src: "/ask?demo=habit" },
  { key: "weekend", label: "Ask · Weekends", src: "/ask?demo=weekend" },
  { key: "whatif", label: "Ask · What if", src: "/ask?demo=whatif" },
  { key: "attention", label: "Ask · Pay attention to", src: "/ask?demo=attention" },
  { key: "empty", label: "Ask · Empty state", src: "/ask?demo=august&q=" },
  { key: "dna", label: "Money DNA (real data)", src: "/money-dna" },
];

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ screen?: string; theme?: string; frame?: string; name?: string }> }) {
  const sp = await searchParams;
  const theme = sp.theme === "light" ? "light" : "dark";
  const screen = SCREENS.find((s) => s.key === sp.screen) ?? SCREENS[0];
  const src = `${screen.src}${screen.src.includes("?") ? "&" : "?"}theme=${theme}${sp.name ? `&name=${encodeURIComponent(sp.name)}` : ""}`;
  const frame = sp.frame !== "0";
  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams({ screen: screen.key, theme, ...(frame ? {} : { frame: "0" }), ...(sp.name ? { name: sp.name } : {}) });
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return `/demo?${q.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 py-4 md:flex-row md:items-start md:gap-12">
      {/* Controls */}
      <aside className="w-full md:w-64 md:shrink-0">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Screenshot studio</p>
        <p className="mt-1 text-[13px] text-ink-secondary">Scripted demo content for portfolio shots. Fabricated figures; nothing here reads your data except Money DNA.</p>
        <ul className="mt-4 flex flex-wrap gap-1.5 md:flex-col md:gap-1">
          {SCREENS.map((s) => (
            <li key={s.key}>
              <Link href={link({ screen: s.key })} className={`block rounded-xl px-3 py-2 text-[13.5px] ${s.key === screen.key ? "bg-ink text-ink-inverse" : "bg-surface text-ink-secondary hover:text-ink"}`}>{s.label}</Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
          <Link href={link({ theme: theme === "dark" ? "light" : "dark" })} className="rounded-full bg-surface px-3 py-1.5 font-medium">Theme: {theme}</Link>
          <Link href={link({ frame: frame ? "0" : undefined })} className="rounded-full bg-surface px-3 py-1.5 font-medium">{frame ? "Hide phone frame" : "Show phone frame"}</Link>
          <a href={src} target="_blank" rel="noreferrer" className="rounded-full bg-surface px-3 py-1.5 font-medium">Open screen alone ↗</a>
        </div>
        <p className="mt-4 text-[12px] text-ink-muted">Tip: use the browser&apos;s device toolbar at 390×844, or screenshot the frame as is. Add <code>&name=Yourname</code> to change the greeting.</p>
      </aside>

      {/* Phone */}
      <div className="relative shrink-0" style={{ width: frame ? 430 : 390 }}>
        {frame ? (
          <div className="relative rounded-[58px] bg-[#0b0b0c] p-[10px] shadow-[0_30px_80px_rgba(0,0,0,0.35)] ring-1 ring-black/40">
            <div className="absolute left-[-3px] top-[120px] h-8 w-[3px] rounded-l bg-[#2a2a2d]" />
            <div className="absolute left-[-3px] top-[170px] h-14 w-[3px] rounded-l bg-[#2a2a2d]" />
            <div className="absolute left-[-3px] top-[240px] h-14 w-[3px] rounded-l bg-[#2a2a2d]" />
            <div className="absolute right-[-3px] top-[190px] h-20 w-[3px] rounded-r bg-[#2a2a2d]" />
            <div className="relative overflow-hidden rounded-[48px]" style={{ width: 410, height: 890, background: theme === "dark" ? "#000" : "#f5f5f7" }}>
              {/* status bar */}
              <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[54px] items-center justify-between px-8 text-[15px] font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>
                <span>9:41</span>
                <span className="flex items-center gap-1.5">
                  <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="0.5" /><rect x="5" y="5.5" width="3" height="6.5" rx="0.5" /><rect x="10" y="3" width="3" height="9" rx="0.5" /><rect x="15" y="0" width="3" height="12" rx="0.5" /></svg>
                  <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.5c2.6 0 5 1 6.8 2.7l1.2-1.3A11.6 11.6 0 0 0 8 .5 11.6 11.6 0 0 0 0 3.9l1.2 1.3A9.7 9.7 0 0 1 8 2.5zm0 3.4c1.7 0 3.2.6 4.4 1.7l1.2-1.3A8 8 0 0 0 8 4.1a8 8 0 0 0-5.6 2.2l1.2 1.3A6.3 6.3 0 0 1 8 5.9zm0 3.4c.8 0 1.5.3 2 .8L8 12l-2-1.9c.5-.5 1.2-.8 2-.8z" /></svg>
                  <svg width="27" height="13" viewBox="0 0 27 13" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" /><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" stroke="none" /><path d="M25 4.5v4" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </span>
              </div>
              {/* dynamic island */}
              <div className="pointer-events-none absolute left-1/2 top-[14px] z-30 h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
              {/* The app renders below the status bar and above the home indicator, like a real app. */}
              <iframe title={screen.label} src={src} className="absolute inset-x-0 border-0" style={{ top: 54, height: 890 - 54 - 22, width: "100%" }} />
              {/* home indicator */}
              <div className={`pointer-events-none absolute bottom-2 left-1/2 z-30 h-[5px] w-[140px] -translate-x-1/2 rounded-full ${theme === "dark" ? "bg-white/90" : "bg-black/90"}`} />
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl ring-1 ring-line" style={{ width: 390, height: 844 }}>
            <iframe title={screen.label} src={src} className="h-full w-full border-0" />
          </div>
        )}
      </div>
    </div>
  );
}
