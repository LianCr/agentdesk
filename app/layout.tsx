import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentDesk — Insurance Agent Knowledge Assistant",
  description:
    "中文提问，检索英文保险资料，并返回可验证的原文引用与页码。Ask in Chinese, get answers grounded in English insurance documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
