"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Joystick } from "lucide-react";
import { NAV_ITEMS, isNavActive } from "./navItems";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r-2 border-[var(--border)] bg-[var(--sidebar)] px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0c0b16] transition-transform duration-300 hover:rotate-6 hover:scale-105">
          <Image src="/Logo@4x.png" alt="" width={44} height={44} className="h-6 w-6 object-contain" priority />
        </span>
        <span className="font-display text-xl font-extrabold tracking-tight text-[var(--fg)]">Arcadeon</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 ${
                isActive
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--fg-muted)] hover:translate-x-1 hover:bg-[var(--bg)] hover:text-[var(--fg)]"
              }`}
            >
              <Icon className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-4 text-center">
        <Joystick className="animate-float-slow mx-auto mb-2 h-7 w-7 text-[var(--primary)]" />
        <p className="text-xs font-bold text-[var(--fg-muted)]">Jogue, evolua, descubra novos mundos.</p>
      </div>
    </aside>
  );
}
