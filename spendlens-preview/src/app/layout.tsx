import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SpendLens",
    template: "%s · SpendLens",
  },
  description: "Understand where your money went. Local-first, from your own CSV exports.",
  manifest: "/manifest.webmanifest",
  applicationName: "SpendLens",
  appleWebApp: {
    capable: true,
    title: "SpendLens",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Resolves the saved theme before first paint so there is no flash. */
const themeBootstrap = `(function(){try{var qs=new URLSearchParams(location.search).get("theme");if(qs==="dark"||qs==="light"){localStorage.setItem("spendlens-theme",qs);}var p=localStorage.getItem("spendlens-theme")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");document.documentElement.setAttribute("data-theme-pref",p);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-theme="light" suppressHydrationWarning>
      <head>
        <Script id="spendlens-theme" strategy="beforeInteractive">{themeBootstrap}</Script>
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
