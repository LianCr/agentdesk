import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { SiteNav } from "../components/shell/site-nav";

export const metadata: Metadata = {
  title: "AgentDesk — Insurance Agent Knowledge Assistant",
  description:
    "中文提问，从英文保险资料中查出答案，并附原文引用与页码。Ask in Chinese; every answer comes from English insurance documents with page references.",
};

// Self-hosted at build time by next/font: no runtime request to Google.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <SiteNav />
        {children}
        {/* Quiet site-wide attribution. slate-500, not 400 -- word-bearing text
            holds the 4.5:1 contrast floor; the link's padding keeps the tap
            target at the 24px floor. */}
        <footer className="border-t border-slate-200 bg-slate-100 py-5 text-center font-mono text-[11px] text-slate-500">
          Built by Chunren Lian · 2026 ·{" "}
          <a
            href="https://github.com/LianCr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-2 underline decoration-slate-300 underline-offset-2 hover:text-[var(--brand)]"
          >
            github.com/LianCr
          </a>
        </footer>
      </body>
    </html>
  );
}
