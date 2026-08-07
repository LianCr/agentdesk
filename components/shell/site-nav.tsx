"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// One product, two work surfaces. Deliberately a plain link bar rather than a
// dashboard chrome: nothing here should compete with the page content.

const LINKS = [
  { href: "/", labelZh: "知识助手", labelEn: "Knowledge Assistant" },
  { href: "/compare", labelZh: "产品比较", labelEn: "Product Comparison" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav
      data-testid="site-nav"
      aria-label="主导航 Main navigation"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 sm:px-6">
        <span className="mr-4 py-3 text-sm font-semibold text-[var(--brand)]">AgentDesk</span>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              data-testid={`nav-${link.href === "/" ? "assistant" : "compare"}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 ${
                active
                  ? "border-[var(--brand)] font-medium text-[var(--brand)]"
                  : "border-transparent text-slate-600 hover:text-[var(--brand)]"
              }`}
            >
              {link.labelZh} <span className="text-slate-400">·</span> {link.labelEn}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
