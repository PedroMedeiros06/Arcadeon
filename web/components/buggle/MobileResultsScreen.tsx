"use client";

import { Tv } from "lucide-react";

interface MobileResultsScreenProps {
  isHost: boolean;
  fast: boolean;
  onChangeFast: (fast: boolean) => void;
  revealDone: boolean;
  onPlayAgain: () => void;
}

export function MobileResultsScreen({ isHost, fast, onChangeFast, revealDone, onPlayAgain }: MobileResultsScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-[var(--card)] bg-[var(--primary-tint)] shadow-[0_6px_0_var(--border)]">
        <Tv size={56} className="text-[var(--primary)]" />
      </div>

      <p className="max-w-xs rounded-2xl bg-[var(--bg)] px-6 py-4 text-lg font-extrabold text-[var(--fg-muted)]">
        Confira a tela principal
      </p>

      {isHost && !revealDone && (
        <div className="flex overflow-hidden rounded-2xl border-2 border-[var(--border)] shadow-[0_4px_0_var(--border)]">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChangeFast(false)}
            className={`px-6 py-3 text-sm font-extrabold transition ${
              !fast ? "bg-[var(--primary)] text-white" : "bg-[var(--card)] text-[var(--fg-muted)]"
            }`}
          >
            Normal
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChangeFast(true)}
            className={`px-6 py-3 text-sm font-extrabold transition ${
              fast ? "bg-[#f59e0b] text-white" : "bg-[var(--card)] text-[var(--fg-muted)]"
            }`}
          >
            Rápido
          </button>
        </div>
      )}

      {isHost && revealDone && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPlayAgain}
          className="rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-8 py-3 font-bold text-white shadow-[0_4px_0_var(--primary-dark)]"
        >
          Jogar novamente
        </button>
      )}
    </div>
  );
}
