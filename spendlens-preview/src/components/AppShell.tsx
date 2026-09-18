import Link from "next/link";
import { Nav } from "./Nav";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./notifications/NotificationCenter";
import { Logo } from "./ui/Logo";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col px-5 py-7 md:flex">
        <div className="flex items-center justify-between pl-2">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">SpendLens</span>
          </Link>
          <NotificationCenter align="left" />
        </div>
        <div className="mt-8">
          <Nav />
        </div>
        <div className="mt-auto flex flex-col gap-4 pt-8">
          <ThemeToggle />
          <p className="px-1 text-[12px] leading-relaxed text-ink-muted">
            Fictional sample data. Changes last until you reset the demo.
          </p>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="safe-top sticky top-0 z-20 flex items-center justify-between bg-bg/85 px-4 py-3 backdrop-blur-xl md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">SpendLens</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationCenter align="right" />
          <ThemeToggle compact />
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-4 sm:px-8 md:px-10 md:pb-16 md:pt-9">{children}</main>

      {/* Bottom nav (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <Nav mobile />
      </div>
    </div>
  );
}
