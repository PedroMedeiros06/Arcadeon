"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import type { DrawPlayerPublic } from "@/lib/draw/types";

interface FeedItem {
  id: string;
  kind: "correct" | "own-correct" | "wrong";
  text: string;
}

interface GuessPanelProps {
  isDrawer: boolean;
  hasGuessed: boolean;
  players: DrawPlayerPublic[];
  mySocketId: string;
  feed: FeedItem[];
  onSubmitGuess: (guess: string) => void;
}

export function GuessPanel({ isDrawer, hasGuessed, players, mySocketId, feed, onSubmitGuess }: GuessPanelProps) {
  const [guess, setGuess] = useState("");
  const sorted = [...players].sort((a, b) => b.score - a.score);

  function submit() {
    if (!guess.trim()) return;
    onSubmitGuess(guess.trim());
    setGuess("");
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 sm:gap-3 lg:w-72 lg:flex-none">
      <div className="flex shrink-0 gap-1.5 overflow-x-auto rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-2 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:p-3">
        {sorted.map((p) => (
          <div
            key={p.socketId}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs sm:text-sm lg:justify-between lg:gap-0 lg:px-2 lg:py-1.5 ${
              p.socketId === mySocketId ? "bg-[var(--primary-tint)]" : ""
            } ${p.hasGuessedThisTurn ? "opacity-70" : ""}`}
          >
            <span className="font-bold whitespace-nowrap text-[var(--fg)]">
              {p.name}
              {p.hasGuessedThisTurn && " ✓"}
            </span>
            <span className="font-extrabold text-[var(--primary)]">{p.score}</span>
          </div>
        ))}
      </div>

      <div className="flex h-24 min-h-0 flex-1 flex-col-reverse gap-1 overflow-y-auto rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-2 sm:h-auto sm:p-3">
        {[...feed].reverse().map((item) => (
          <p
            key={item.id}
            className={`text-xs font-semibold sm:text-sm ${
              item.kind === "wrong"
                ? "text-[var(--fg-muted)]"
                : item.kind === "own-correct"
                  ? "text-[var(--primary)]"
                  : "text-[var(--success-fg)]"
            }`}
          >
            {item.text}
          </p>
        ))}
      </div>

      {!isDrawer && (
        <div className="flex shrink-0 gap-2">
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            disabled={hasGuessed}
            placeholder={hasGuessed ? "Voce ja acertou!" : "Digite seu palpite..."}
            className="min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--fg)] outline-none focus:border-[var(--primary)] disabled:opacity-60"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            disabled={hasGuessed || !guess.trim()}
            className="flex shrink-0 items-center justify-center rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-3 text-white disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
