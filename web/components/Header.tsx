"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Coins, LogOut, ShoppingBag, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LoginModal } from "./LoginModal";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./Avatar";

function AccountMenu() {
  const { user, username, coins, equippedAvatar, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const name = username ?? user.email ?? "";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menu da conta"
        className="flex h-10 items-center gap-2 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] pl-0.5 pr-0.5 transition hover:border-[var(--border-hover)] sm:pr-3"
      >
        <Avatar
          emoji={equippedAvatar?.emoji}
          bgColor={equippedAvatar?.bg_color}
          imageUrl={equippedAvatar?.image_url}
          fallbackLetter={name.charAt(0).toUpperCase() || "?"}
          size="md"
        />
        <span className="hidden max-w-[10rem] truncate text-sm font-bold text-[var(--fg)] sm:block">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-2 shadow-xl shadow-black/10 animate-[scaleIn_0.15s_ease-out]"
        >
          <div className="px-3 pb-2 pt-1">
            <p className="truncate text-sm font-extrabold text-[var(--fg)]">{name}</p>
            <p className="flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)]">
              <Coins className="h-3.5 w-3.5 text-[var(--primary)]" /> {coins} moedas
            </p>
          </div>
          <div className="my-1 border-t-2 border-[var(--border)]" />
          {[
            { href: "/profile", label: "Perfil e inventário", Icon: UserRound },
            { href: "/shop", label: "Loja", Icon: ShoppingBag },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[var(--fg)] transition hover:bg-[var(--bg)]"
            >
              <Icon className="h-4 w-4 text-[var(--fg-muted)]" /> {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold text-[var(--danger)] transition hover:bg-[var(--danger-bg)]"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, coins, loading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--border)] bg-[var(--card)]">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* no PC a marca fica na sidebar */}
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0c0b16]">
            <Image src="/Logo@4x.png" alt="" width={40} height={40} className="h-5 w-5 object-contain" priority />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Arcadeon</span>
        </Link>

        <div className="flex-1" />

        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {loading ? null : user ? (
            <>
              <span
                className="flex items-center gap-1.5 rounded-full bg-[var(--primary-tint)] px-3 py-1.5 text-sm font-bold tabular-nums text-[var(--primary)]"
                title="Moedas"
              >
                <Coins className="h-4 w-4" /> {coins}
              </span>
              <AccountMenu />
            </>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              className="rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-2 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
            >
              Entrar
            </button>
          )}
        </nav>

        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    </header>
  );
}
