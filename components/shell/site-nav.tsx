"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// One product, three work surfaces. Deliberately a plain link bar rather than
// dashboard chrome: nothing here should compete with the page content.

const LINKS = [
  { href: "/", testId: "assistant", labelZh: "知识助手", labelEn: "Knowledge Assistant" },
  { href: "/compare", testId: "compare", labelZh: "产品比较", labelEn: "Product Comparison" },
  { href: "/review", testId: "review", labelZh: "审核队列", labelEn: "Review Queue" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav
      data-testid="site-nav"
      aria-label="主导航 Main navigation"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-0.5 px-2 sm:gap-1 sm:px-6">
        {/* Hidden on phones: at 390px the wordmark plus three links needs 429px,
            and the page's own h1 already says the product name. */}
        <span className="mr-4 hidden py-3 text-sm font-semibold text-[var(--brand)] sm:block">
          AgentDesk
        </span>
        {LINKS.map((link) => {
          const active =
            pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
          return (
            <Link
              key={link.href}
              href={link.href}
              data-testid={`nav-${link.testId}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-2 py-2.5 text-sm leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 sm:px-3 ${
                active
                  ? "border-[var(--brand)] font-medium text-[var(--brand)]"
                  : "border-transparent text-slate-600 hover:text-[var(--brand)]"
              }`}
            >
              {/* Two registers, the same split the queue table uses: Chinese to
                  scan, English beneath to confirm. On one line the three links
                  need 724px at 390px wide and the Chinese broke mid-word. */}
              <span data-register="zh" className="block whitespace-nowrap">
                {link.labelZh}
              </span>
              <span
                data-register="en"
                className="block whitespace-nowrap text-[11px] font-normal tracking-wide text-slate-500"
              >
                {link.labelEn}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
