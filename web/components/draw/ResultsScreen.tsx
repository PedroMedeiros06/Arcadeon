"use client";

import { Crown, Trophy } from "lucide-react";
import type { GameEndedPayload } from "@/lib/draw/types";

interface ResultsScreenProps {
  result: GameEndedPayload;
  isHost: boolean;
  onPlayAgain: () => void;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function ResultsScreen({ result, isHost, onPlayAgain }: ResultsScreenProps) {
  const ranking = [...result.players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col items-center gap-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)] text-white sm:h-16 sm:w-16">
          <Trophy className="h-7 w-7 sm:h-8 sm:w-8" />
        </span>
        <h1 className="text-xl font-extrabold text-[var(--fg)] sm:text-2xl">Fim de jogo!</h1>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        {ranking.map((p, i) => (
          <div
            key={p.socketId}
            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
              i === 0
                ? "border-[var(--primary)] bg-[var(--primary-tint)]"
                : "border-[var(--border)] bg-[var(--card)]"
            }`}
          >
            <span className="w-5 text-sm font-extrabold text-[var(--fg-muted)]">{i + 1}</span>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
              style={{ backgroundColor: colorFor(p.socketId) }}
            >
              {p.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className="flex-1 truncate font-bold text-[var(--fg)]">{p.name}</span>
            {i === 0 && <Crown size={16} className="fill-yellow-400 text-yellow-400" />}
            <span className="font-extrabold text-[var(--primary)]">{p.score}</span>
          </div>
        ))}
      </div>

      {isHost && (
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
