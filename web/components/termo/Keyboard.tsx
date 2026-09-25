"use client";

import type { BoardCount, LetterState } from "@/lib/termo/logic";

export const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Enter", "Z", "X", "C", "V", "B", "N", "M", "Back"],
];

const keySliceBg: Record<LetterState, string> = {
  correct: "bg-[var(--termo-correct)]",
  present: "bg-[var(--termo-present)]",
  absent: "bg-[var(--key-absent)]",
  empty: "bg-[var(--border)]",
};

const keyClasses: Record<LetterState, string> = {
  correct: "bg-[var(--termo-correct)] text-white shadow-[0_3px_0_var(--termo-correct-dark)]",
  present: "bg-[var(--termo-present)] text-white shadow-[0_3px_0_var(--termo-present-dark)]",
  absent: "bg-[var(--key-absent)] text-[var(--key-absent-fg)]",
  empty: "bg-[var(--border)] text-[var(--fg)] hover:bg-[var(--border-hover)]",
};

interface KeyboardProps {
  boardCount: BoardCount;
  keyStates: Record<string, LetterState[]>;
  onKey: (key: string) => void;
}

export function Keyboard({ boardCount, keyStates, onKey }: KeyboardProps) {
  return (
    <div className={`flex shrink-0 flex-col items-center sm:gap-2.5 lg:gap-1.5 ${boardCount === 4 ? "gap-1" : "gap-1.5"}`}>
      {KEY_ROWS.map((row, i) => (
        <div key={i} className="flex gap-1 sm:gap-2 lg:gap-1.5">
          {row.map((key) => {
            const isWide = key === "Enter" || key === "Back";
            const boardStates = isWide ? null : (keyStates[key.toLowerCase()] ?? Array(boardCount).fill("empty"));

            // Duplo/Quádruplo: tecla dividida em fatias, uma cor por tabuleiro (igual term.ooo)
            if (boardStates && boardCount > 1) {
              return (
                <button
                  key={key}
                  aria-label={key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onKey(key)}
                  className={`relative min-w-8 overflow-hidden rounded-lg text-xs font-extrabold uppercase text-white transition active:scale-95 sm:h-14 sm:min-w-11 sm:text-sm lg:h-11 lg:min-w-9 ${boardCount === 4 ? "h-9" : "h-11"}`}
                >
                  <div className={`absolute inset-0 grid ${boardCount === 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-2"}`}>
                    {boardStates.map((s, b) => (
                      <div key={b} className={keySliceBg[s]} />
                    ))}
                  </div>
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">{key}</span>
                </button>
              );
            }

            const state = boardStates ? boardStates[0] : "empty";
            return (
              <button
                key={key}
                aria-label={key === "Back" ? "Apagar" : key === "Enter" ? "Enviar" : key}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onKey(key)}
                className={`rounded-lg text-xs font-extrabold uppercase transition active:scale-95 sm:text-sm ${keyClasses[state]} ${
                  isWide
                    ? `px-3 sm:px-5 sm:py-4 lg:py-3 ${boardCount === 4 ? "py-2" : "py-3"}`
                    : `min-w-8 px-2 sm:min-w-11 sm:px-3 sm:py-4 lg:min-w-9 lg:py-3 ${boardCount === 4 ? "py-2" : "py-3"}`
                }`}
              >
                {key === "Back" ? "⌫" : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
