"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Flame, LogIn, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getDailyStatusShared } from "@/lib/home/dailyStatus";
import { rankFor } from "@/lib/home/rank";
import { LoginModal } from "@/components/LoginModal";

const CARD = "flex flex-col justify-center gap-1 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4";

/** Coluna ao lado do destaque: convite pra quem nao entrou, progresso pra quem entrou. */
export function HomeAside() {
  const { user, username, coins, loading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    getDailyStatusShared(user.id)
      .then((s) => alive && setStreak(s.currentStreak))
      .catch(() => alive && setStreak(null));
    // ranking do Letrado (1 palavra) por menos tentativas, o mesmo padrao da pagina de placares
    createClient()
      .from("termo_leaderboard")
      .select("username")
      .eq("board_count", 1)
      .order("attempts", { ascending: true })
      .order("time_seconds", { ascending: true })
      .limit(100)
      .then(({ data }) => alive && setRank(rankFor(data ?? [], username)));
    return () => {
      alive = false;
    };
  }, [loading, user, username]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1" aria-hidden>
        <div className={`${CARD} skeleton h-20`} />
        <div className={`${CARD} skeleton h-20`} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-3 self-start rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5">
        <p className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Guarde seu progresso</p>
        <p className="text-sm text-[var(--fg-muted)]">
          Com uma conta você ganha moedas, troca por avatares na loja e aparece nos placares.
        </p>
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          <LogIn className="h-4 w-4" /> Entrar
        </button>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1">
      <Link href="/shop" className={`${CARD} transition hover:border-[var(--border-hover)] active:scale-[0.98]`}>
        <span className="text-xs font-medium text-[var(--fg-muted)]">Suas moedas</span>
        <span className="flex items-center gap-2 font-display text-2xl font-extrabold tabular-nums text-[var(--fg)]">
          <Coins className="h-5 w-5 text-[var(--primary)]" /> {coins}
        </span>
      </Link>
      <Link
        href="/leaderboard"
        className={`${CARD} transition hover:border-[var(--border-hover)] active:scale-[0.98]`}
      >
        <span className="text-xs font-medium text-[var(--fg-muted)]">Letrado</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-lg font-extrabold text-[var(--fg)]">
          {streak ? (
            <span className="inline-flex items-center gap-1">
              <Flame className="h-5 w-5 text-[var(--primary)]" /> {streak} {streak === 1 ? "dia" : "dias"}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-5 w-5 text-[var(--primary)]" /> {rank ? `#${rank}` : "Ver ranking"}
          </span>
        </span>
      </Link>
    </div>
  );
}
