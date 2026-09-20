"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoundEndedPayload } from "@/lib/buggle/types";
import { scoreForWord } from "@/lib/buggle/score";

interface ResultsScreenProps {
  result: RoundEndedPayload;
  isHost: boolean;
  onPlayAgain: () => void;
}

const LENGTH_COLORS: Record<number, string> = {
  3: "#8a8fa8",
  4: "#1cb0f6",
  5: "#22c55e",
  6: "#f59e0b",
  7: "#ef4444",
};
function colorForLength(len: number) {
  return LENGTH_COLORS[len] ?? "#a855f7"; // 8+ = roxo
}

export function ResultsScreen({ result, isHost, onPlayAgain }: ResultsScreenProps) {
  const words = useMemo(
    () => [...result.allWords].sort((a, b) => a.word.length - b.word.length),
    [result.allWords]
  );

  const [revealIndex, setRevealIndex] = useState(-1);
  const [phase, setPhase] = useState<"entering" | "leaving" | "idle">("idle");
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(result.room.players.map((p) => [p.socketId, 0]))
  );
  const [secretRevealed, setSecretRevealed] = useState(false);

  const secretFound = result.foundBy.some((p) =>
    result.secretWord ? p.foundWords.includes(result.secretWord.word) : false
  );

  useEffect(() => {
    if (revealIndex >= words.length - 1) {
      if (revealIndex === words.length - 1) {
        const timeout = setTimeout(() => setSecretRevealed(true), 800);
        return () => clearTimeout(timeout);
      }
      return;
    }

    const next = revealIndex + 1;
    const showTimer = setTimeout(() => setPhase("entering"), 100);
    const leaveTimer = setTimeout(() => setPhase("leaving"), 1400);
    const advanceTimer = setTimeout(() => {
      const word = words[next];
      const finders = result.foundBy.filter((p) => p.foundWords.includes(word.word));
      if (finders.length > 0) {
        setScores((prev) => {
          const updated = { ...prev };
          for (const f of finders) {
            updated[f.socketId] = (updated[f.socketId] ?? 0) + scoreForWord(word.word.length);
          }
          return updated;
        });
      }
      setRevealIndex(next);
      setPhase("idle");
    }, 1800);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(leaveTimer);
      clearTimeout(advanceTimer);
    };
  }, [revealIndex, words, result.foundBy]);

  useEffect(() => {
    setRevealIndex(0);
  }, []);

  const maxScore = Math.max(1, ...Object.values(scores));
  const currentWord = revealIndex >= 0 && revealIndex < words.length ? words[revealIndex] : null;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-6">
      <h2 className="text-2xl font-extrabold text-[var(--fg)]">Fim de rodada</h2>

      <div className="flex h-40 items-end gap-4">
        {result.room.players.map((p) => {
          const score = scores[p.socketId] ?? 0;
          return (
            <div key={p.socketId} className="flex flex-col items-center gap-1">
              <span className="text-sm font-extrabold text-[var(--fg)] transition-all">{score}</span>
              <div
                className="w-12 rounded-t-lg bg-[var(--primary)] transition-all duration-500"
                style={{ height: `${Math.max(4, (score / maxScore) * 120)}px` }}
              />
              <span className="text-xs font-semibold text-[var(--fg-muted)]">{p.name}</span>
            </div>
          );
        })}
      </div>

      <div className="flex h-16 items-center justify-center">
        {currentWord && (
          <span
            key={currentWord.word}
            className={`text-3xl font-extrabold ${
              phase === "entering" ? "animate-[scaleIn_0.3s_ease]" : phase === "leaving" ? "animate-[fadeOut_0.4s_ease]" : ""
            }`}
            style={{ color: colorForLength(currentWord.word.length) }}
          >
            {currentWord.word}
          </span>
        )}
      </div>

      {secretRevealed && result.secretWord && (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary-tint)] p-4">
          <p className="font-bold text-[var(--fg)]">
            {secretFound ? "🔒 Palavra secreta encontrada!" : "🔒 Ninguem encontrou a palavra secreta"}
          </p>
          <p className="text-2xl font-extrabold" style={{ color: "var(--primary)" }}>
            {result.secretWord.word}
          </p>
          {!secretFound && (
            <p className="text-xs text-[var(--fg-muted)]">
              Caminho: {result.secretWord.path.map((c) => `(${c.row},${c.col})`).join(" → ")}
            </p>
          )}
        </div>
      )}

      {isHost && secretRevealed && (
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
