import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "../components/shell/site-nav";

export const metadata: Metadata = {
  title: "AgentDesk — Insurance Agent Knowledge Assistant",
  description:
    "中文提问，检索英文保险资料，并返回可验证的原文引用与页码。Ask in Chinese, get answers grounded in English insurance documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteNav />
        {children}
        {/* Quiet site-wide attribution. slate-500, not 400 -- word-bearing text
            holds the 4.5:1 contrast floor; the link's padding keeps the tap
            target at the 24px floor. */}
        <footer className="border-t border-slate-200 bg-slate-50 py-5 text-center text-xs text-slate-500">
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
