"use client";

import { useState } from "react";
import { Search, Bell, Coins } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LoginModal } from "./LoginModal";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./Avatar";

export function Header() {
  const { user, username, coins, equippedAvatar, loading, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-4 px-6 py-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="search"
            placeholder="Buscar jogos..."
            className="w-full max-w-md rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] py-2.5 pl-11 pr-4 text-sm font-medium text-[var(--fg)] outline-none transition focus:border-[var(--primary)]"
          />
        </div>

        <nav className="flex items-center gap-3">
          <ThemeToggle />

          <button className="group flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)]">
            <Bell className="h-4 w-4 transition-transform duration-200 group-hover:animate-[wiggle_0.4s_ease-in-out]" />
          </button>

          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm font-bold text-[var(--fg)] sm:flex">
                <Avatar
                  emoji={equippedAvatar?.emoji}
                  bgColor={equippedAvatar?.bg_color}
                  imageUrl={equippedAvatar?.image_url}
                  fallbackLetter={(username ?? user.email ?? "?").charAt(0).toUpperCase()}
                  size="sm"
                />
                {username ?? user.email}
                <span className="flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs text-[var(--primary)]">
                  <Coins className="h-3 w-3" /> {coins}
                </span>
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-extrabold text-[var(--fg-muted)] transition hover:bg-[var(--bg)] active:translate-y-0.5"
              >
                Sair
              </button>
            </div>
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
