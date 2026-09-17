"use client";

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
      <div className="relative flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] shadow-[0_10px_0_var(--border)] animate-[scaleIn_0.25s_ease-out]">
        <div className="shrink-0 p-8 pb-0 text-center">
          <div className="mb-3 text-5xl">{won ? "🎉" : "😔"}</div>

          <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-[var(--fg)]">
            {won ? "Você acertou!" : "Fim de jogo"}
          </h2>
          <p className="mb-6 text-sm font-medium text-[var(--fg-muted)]">
            {won ? feedback : `A palavra era: ${targetWord.toUpperCase()}`}
          </p>

          <div className="mb-6 flex justify-center gap-3">
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
              <span className="text-2xl font-extrabold text-[var(--primary)]">{attempts}</span>
              <span className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">Tentativas</span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
              <span className="text-2xl font-extrabold text-[var(--accent)]">{timeString}</span>
              <span className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">Tempo</span>
            </div>
            {currentStreak !== undefined && (
              <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
                <span className="text-2xl font-extrabold text-orange-500">🔥{currentStreak}</span>
                <span className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">Sequência</span>
              </div>
            )}
          </div>
        </div>

        {showLeaderboard && (
          <div className="flex-1 overflow-y-auto px-8">
            <Leaderboard refreshKey={leaderboardRefresh} boardCount={boardCount} />
          </div>
        )}

        <div className="shrink-0 p-8 pt-4">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPlayAgain}
            className="w-full rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-3 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
          >
            Jogar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
