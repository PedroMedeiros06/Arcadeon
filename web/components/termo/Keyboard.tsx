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
  // Quádruplo precisa de cada pixel de altura pros 36 quadradinhos
  const KEY_HEIGHT = boardCount === 4 ? "h-11 sm:h-14 lg:h-11" : "h-12 sm:h-14 lg:h-12";
  return (
    // teclas esticam pra ocupar a largura no celular (alvo maior pro dedo); no desktop param em max-w-xl
    <div className="flex w-full max-w-xl shrink-0 flex-col items-stretch gap-1.5 sm:gap-2 lg:gap-1.5">
      {KEY_ROWS.map((row, i) => (
        <div key={i} className={`flex gap-1 sm:gap-1.5 ${i === 1 ? "px-[4.5%]" : ""}`}>
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
                  className={`relative min-w-0 flex-1 overflow-hidden rounded-lg text-sm font-extrabold uppercase text-white transition active:scale-95 ${KEY_HEIGHT}`}
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
                className={`flex min-w-0 items-center justify-center rounded-lg font-extrabold uppercase transition active:scale-95 ${KEY_HEIGHT} ${keyClasses[state]} ${
                  isWide ? "flex-[1.6] text-[11px] sm:text-xs" : "flex-1 text-sm"
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
