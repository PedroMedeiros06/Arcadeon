"use client";

import { Flame, Target, Clock, RotateCcw } from "lucide-react";
import { Leaderboard } from "./Leaderboard";

interface WinModalProps {
  open: boolean;
  won: boolean;
  attempts: number;
  timeString: string;
  targetWord: string;
  leaderboardRefresh: number;
  currentStreak?: number;
  showLeaderboard?: boolean;
  boardCount: number;
  onPlayAgain: () => void;
}

export function WinModal({
  open,
  won,
  attempts,
  timeString,
  targetWord,
  leaderboardRefresh,
  currentStreak,
  showLeaderboard = true,
  boardCount,
  onPlayAgain,
}: WinModalProps) {
  if (!open) return null;

  const WIN_PHRASES: Record<number, string> = {
    1: "Impossível! Você é um gênio!",
    2: "Extraordinário! Mandou muito bem!",
    3: "Excelente! Ótima jogada!",
    4: "Muito bom! Mandou bem!",
    5: "Ufa, quase! Bom trabalho!",
    6: "Ufa! Por muito pouco!",
  };

  const feedback = won ? (WIN_PHRASES[attempts] ?? "Você acertou!") : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.4)] animate-[scaleIn_0.25s_ease-out]">
        <div
          className={`relative shrink-0 overflow-hidden px-8 pb-8 pt-9 text-center ${
            won
              ? "bg-gradient-to-br from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)]"
              : "bg-gradient-to-br from-[var(--fg-muted)] to-[var(--border-hover)]"
          }`}
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

          <div className="animate-pop-in mb-3 text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
            {won ? "🎉" : "😔"}
          </div>

          <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-white">
            {won ? "Você acertou!" : "Fim de jogo"}
          </h2>
          <p className="text-sm font-semibold text-white/85">
            {won ? feedback : `A palavra era: ${targetWord.toUpperCase()}`}
          </p>
        </div>

        <div className="shrink-0 px-8 pt-5">
          <div className="flex justify-center gap-3">
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
              <span className="flex items-center gap-1 text-xl font-extrabold text-[var(--primary)]">
                <Target className="h-4 w-4" />
                {attempts}
              </span>
              <span className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">Tentativas</span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
              <span className="flex items-center gap-1 text-xl font-extrabold text-[var(--accent)]">
                <Clock className="h-4 w-4" />
                {timeString}
              </span>
              <span className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">Tempo</span>
            </div>
            {currentStreak !== undefined && (
              <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
                <span className="flex items-center gap-1 text-xl font-extrabold text-[var(--primary)]">
                  <Flame className="h-4 w-4 fill-current" />
                  {currentStreak}
                </span>
                <span className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">Sequência</span>
              </div>
            )}
          </div>
        </div>

        {showLeaderboard && (
          <div className="mt-5 flex-1 overflow-y-auto border-t-2 border-[var(--border)] px-8">
            <Leaderboard refreshKey={leaderboardRefresh} boardCount={boardCount} />
          </div>
        )}

        <div className="shrink-0 p-8 pt-4">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPlayAgain}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-3 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
          >
            <RotateCcw className="h-4 w-4" />
            Jogar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
