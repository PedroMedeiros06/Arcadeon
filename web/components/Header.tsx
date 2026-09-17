"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LoginModal } from "./LoginModal";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const { user, username, loading, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-4 border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[var(--fg)]">
          Arcadeon
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/leaderboard"
            className="hidden items-center gap-1.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-extrabold text-[var(--fg-muted)] transition hover:bg-[var(--bg)] sm:flex"
          >
            🏆 Leaderboard
          </Link>
          <ThemeToggle />

          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm font-bold text-[var(--fg)] sm:flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-extrabold text-white">
                  {(username ?? user.email ?? "?").charAt(0).toUpperCase()}
                </span>
                {username ?? user.email}
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
