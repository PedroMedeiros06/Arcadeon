"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Coins, Flame, Play, Trophy, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBlockTransition } from "@/lib/transition/TransitionProvider";
import { fetchDailyStatus, type DailyModeStatus, type DailyStatus } from "@/lib/termo/daily";
import { modeLabel, type BoardCount } from "@/lib/termo/logic";

const BOARD_COUNTS: BoardCount[] = [1, 2, 4];

const MODE_CHIP: Record<DailyModeStatus, { label: string; className: string }> = {
  not_started: { label: "a jogar", className: "border-[var(--border)] text-[var(--fg-muted)]" },
  playing: { label: "em andamento", className: "border-[var(--game-termo)] text-[var(--game-termo)]" },
  won: { label: "venceu", className: "border-transparent bg-[var(--game-termo)] text-white" },
  lost: { label: "não foi hoje", className: "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]" },
};

// letras de exemplo com as cores do Letrado (verde = lugar certo, amarelo = existe em outro lugar)
const SAMPLE: { letter: string; state: "correct" | "present" | "absent" }[] = [
  { letter: "J", state: "absent" },
  { letter: "O", state: "correct" },
  { letter: "G", state: "absent" },
  { letter: "A", state: "present" },
  { letter: "R", state: "correct" },
];

const TILE: Record<(typeof SAMPLE)[number]["state"], string> = {
  correct: "bg-[#8bbf6f] text-white",
  present: "bg-[#e0c26e] text-white",
  absent: "bg-[var(--key-absent)] text-[var(--key-absent-fg)]",
};

export function DailyTermoCard() {
  const { user, coins, loading } = useAuth();
  const { navigate } = useBlockTransition();
  // null enquanto carrega ou se a RPC ainda nao existe no banco: o card fica no modo estatico
  const [status, setStatus] = useState<DailyStatus | null>(null);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    fetchDailyStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [loading, user?.id]);

  const modes = status ? BOARD_COUNTS.map((c) => ({ count: c, state: status.modes[c] ?? "not_started" })) : [];
  const allDone = modes.length > 0 && modes.every((m) => m.state === "won" || m.state === "lost");
  const anyStarted = modes.some((m) => m.state !== "not_started");
  const title = allDone ? "Você fechou o dia!" : anyStarted ? "Continue de onde parou" : "Palavra nova todo dia";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section
        className="relative overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
        style={{ borderTopColor: "var(--game-termo)", borderTopWidth: 6 }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--game-termo)]">Letrado diário</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--fg)] sm:text-3xl">
              {title}
            </h2>
            <p className="max-w-md text-sm text-[var(--fg-muted)]">
              {allDone
                ? "Volte amanhã pra uma palavra nova."
                : user || loading
                  ? "Acerte e ganhe 10 moedas por modo (15 no difícil): Letrado, Duplo e Quádruplo."
                  : "Entre com sua conta pra ganhar moedas e aparecer nos placares."}
            </p>
            {modes.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {modes.map(({ count, state }) => (
                  <span
                    key={count}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold ${MODE_CHIP[state].className}`}
                  >
                    {state === "won" && <Check className="h-3 w-3" />}
                    {state === "lost" && <X className="h-3 w-3" />}
                    {modeLabel(count)} · {MODE_CHIP[state].label}
                  </span>
                ))}
                {status?.currentStreak ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-tint)] px-2.5 py-0.5 text-xs font-bold text-[var(--primary)]">
                    <Flame className="h-3 w-3" /> {status.currentStreak} {status.currentStreak === 1 ? "dia" : "dias"}
                  </span>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {SAMPLE.map((t, i) => (
              <span
                key={i}
                className={`flex h-10 w-10 items-center justify-center rounded-lg font-display text-lg font-extrabold sm:h-12 sm:w-12 sm:text-xl ${TILE[t.state]}`}
              >
                {t.letter}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/games/termo")}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--game-termo)] px-6 py-3 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98] sm:w-auto"
        >
          <Play className="h-4 w-4 fill-current" /> {allDone ? "Ver resultado" : anyStarted ? "Continuar" : "Jogar agora"}
        </button>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
        <div className="flex flex-col justify-center gap-1 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4">
          <span className="text-xs font-medium text-[var(--fg-muted)]">Suas moedas</span>
          <span className="flex items-center gap-2 font-display text-2xl font-extrabold tabular-nums text-[var(--fg)]">
            <Coins className="h-5 w-5 text-[var(--primary)]" /> {user ? coins : "—"}
          </span>
        </div>
        <Link
          href="/leaderboard"
          className="flex flex-col justify-center gap-1 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--border-hover)] active:scale-[0.98]"
        >
          <span className="text-xs font-medium text-[var(--fg-muted)]">Placares</span>
          <span className="flex items-center gap-2 font-display text-lg font-extrabold text-[var(--fg)]">
            <Trophy className="h-5 w-5 text-[var(--primary)]" /> Ver ranking
          </span>
        </Link>
      </div>
    </div>
  );
}
