"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "./navItems";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t-2 border-[var(--border)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold transition ${
              isActive ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"
            }`}
          >
            <span
              className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                isActive ? "bg-[var(--primary-tint)]" : ""
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
