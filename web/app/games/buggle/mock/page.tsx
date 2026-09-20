"use client";

import { useMemo, useState } from "react";
import { GamePlayScreen } from "@/components/buggle/GamePlayScreen";
import type { BoggleBoard, BoggleCell, WordResult } from "@/lib/buggle/types";

const LETTERS = "AAAAEEEEIIOOUUBCDDFGHLMNNPQRRSSTTVZ";

function randomBoard(size: number): BoggleBoard {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      letter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
    }))
  );
}

export default function BuggleMockPage() {
  const [board, setBoard] = useState<BoggleBoard>(() => randomBoard(4));
  const [secondsLeft, setSecondsLeft] = useState(178);
  const [lastResult, setLastResult] = useState<WordResult | null>(null);
  const totalSeconds = 180;

  const boardSize = board.length;
  const boardSizes = useMemo(() => [4, 5, 6], []);

  function handleWordSubmit(word: string, _path: BoggleCell[]) {
    // no mock, aceita palavras com 3+ letras so pra simular feedback visual
    const accepted = word.length >= 3;
    setLastResult({
      word,
      accepted,
      points: accepted ? word.length * 10 : 0,
      isSecret: accepted && word.length >= 6,
      alreadyFound: false,
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b-2 border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">
          Mock (dev only) —
        </span>
        {boardSizes.map((s) => (
          <button
            key={s}
            onClick={() => setBoard(randomBoard(s))}
            className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition ${
              s === boardSize
                ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)] hover:bg-[var(--card)]"
            }`}
          >
            {s}x{s}
          </button>
        ))}
        <button
          onClick={() => setBoard(randomBoard(boardSize))}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-bold text-[var(--fg-muted)] transition hover:bg-[var(--card)]"
        >
          Novo board
        </button>
        <button
          onClick={() => setSecondsLeft((s) => Math.max(0, s - 10))}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-bold text-[var(--fg-muted)] transition hover:bg-[var(--card)]"
        >
          -10s (testar isEnding)
        </button>
        <button
          onClick={() => setSecondsLeft(totalSeconds)}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-bold text-[var(--fg-muted)] transition hover:bg-[var(--card)]"
        >
          Resetar timer
        </button>
      </div>

      <GamePlayScreen
        board={board}
        secondsLeft={secondsLeft}
        totalSeconds={totalSeconds}
        lastResult={lastResult}
        onWordSubmit={handleWordSubmit}
        onLeaveRoom={() => alert("Sair (mock, sem sala real)")}
      />
    </div>
  );
}
