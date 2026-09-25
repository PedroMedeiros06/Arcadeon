"use client";

import { buildBoardRows, maxAttemptsFor, WORD_LENGTH, type BoardCount, type Cell, type LetterState } from "@/lib/termo/logic";
import type { Hint } from "@/lib/termo/daily";

// cores via variaveis (globals.css) pra o modo daltonico trocar tudo de uma vez
export const cellClasses: Record<LetterState, string> = {
  correct: "bg-[var(--termo-correct)] border-[var(--termo-correct-dark)] text-white shadow-[0_4px_0_var(--termo-correct-dark)]",
  present: "bg-[var(--termo-present)] border-[var(--termo-present-dark)] text-white shadow-[0_4px_0_var(--termo-present-dark)]",
  absent: "bg-[var(--fg-muted)] border-[var(--border-hover)] text-white",
  empty: "border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
};

const STATE_LABEL: Record<LetterState, string> = {
  correct: "lugar certo",
  present: "em outro lugar",
  absent: "não está na palavra",
  empty: "",
};

function sizeClasses(boardCount: BoardCount) {
  if (boardCount === 4)
    return "h-[min(8vw,3.7vh)] w-[min(8vw,3.7vh)] text-[10px] sm:h-12 sm:w-12 sm:text-xl lg:h-[var(--cell)] lg:w-[var(--cell)] lg:text-lg";
  if (boardCount === 2)
    return "h-[7.8vw] w-[7.8vw] text-sm sm:h-14 sm:w-14 sm:text-2xl lg:h-[var(--cell)] lg:w-[var(--cell)] lg:text-xl";
  return "h-12 w-12 text-2xl sm:h-16 sm:w-16 sm:text-3xl lg:h-[var(--cell)] lg:w-[var(--cell)] lg:text-2xl";
}

/** Tamanho de celula p/ caber board + teclado sem scroll no desktop (usado via --cell). */
export function cellStyle(boardCount: BoardCount) {
  const cellVh = boardCount === 4 ? 4.2 : boardCount === 2 ? 5.2 : 6.1;
  const cellVw = boardCount === 4 ? 4.4 : boardCount === 2 ? 6.5 : 9.5;
  return { "--cell": `clamp(2.25rem, min(${cellVw}vw, ${cellVh}vh), 4rem)` } as React.CSSProperties;
}

function cellLabel(cell: Cell) {
  if (!cell.letter) return "vazio";
  return cell.state === "empty" ? cell.letter.toUpperCase() : `${cell.letter.toUpperCase()}, ${STATE_LABEL[cell.state]}`;
}

interface BoardsProps {
  boardCount: BoardCount;
  guesses: string[];
  evals: LetterState[][][];
  currentLetters: string[];
  cursor: number;
  revealRowIndex: number | null;
  shakeRow: boolean;
  editable: boolean;
  onCellClick: (index: number) => void;
  /** letras reveladas por dica, mostradas apagadinhas na linha atual */
  hints?: Hint[];
  /** palavra sem acento -> com acento, so pra exibir (SAUDE -> SAÚDE) */
  accents?: Record<string, string>;
  /** linha que resolveu o jogo: pula em onda depois de virar */
  bounceRowIndex?: number | null;
  /** quantas linhas desenhar (padrao: tentativas do modo) */
  rowCount?: number;
}

export function Boards({
  boardCount,
  guesses,
  evals,
  currentLetters,
  cursor,
  revealRowIndex,
  shakeRow,
  editable,
  onCellClick,
  hints = [],
  accents = {},
  bounceRowIndex = null,
  rowCount,
}: BoardsProps) {
  const totalRows = rowCount ?? maxAttemptsFor(boardCount);
  const size = sizeClasses(boardCount);

  return (
    <div
      className={
        boardCount === 4
          ? "grid grid-cols-2 gap-x-2 gap-y-1 sm:flex sm:justify-center sm:gap-8 lg:gap-4"
          : "flex justify-center gap-4 sm:gap-8 lg:gap-4"
      }
    >
      {Array.from({ length: boardCount }, (_, boardIndex) => {
        const { rows, solved } = buildBoardRows(guesses, evals, boardIndex);
        const boardHints = hints.filter((h) => h.board === boardIndex);
        return (
          <div
            key={boardIndex}
            role="group"
            aria-label={`Tabuleiro ${boardIndex + 1}${solved ? ", resolvido" : ""}`}
            className={`flex shrink-0 flex-col transition-opacity sm:gap-2.5 lg:gap-1.5 ${boardCount === 4 ? "gap-[3px]" : "gap-1.5"} ${solved && bounceRowIndex === null ? "opacity-60" : ""}`}
          >
            {Array.from({ length: totalRows }, (_, rowIndex) => {
              const isCurrentRow = rowIndex === guesses.length && !solved;
              const submitted = rows[rowIndex];
              // palavra enviada aparece com acento; a comparacao continua sem
              const shown = submitted ? (accents[guesses[rowIndex]] ?? guesses[rowIndex]) : "";
              const rowCells: Cell[] = submitted
                ? submitted.map((c, i) => ({ ...c, letter: shown[i] ?? c.letter }))
                : isCurrentRow
                  ? currentLetters.map((letter) => ({ letter, state: "empty" as LetterState }))
                  : Array.from({ length: WORD_LENGTH }, () => ({ letter: "", state: "empty" as LetterState }));
              const bounce = bounceRowIndex === rowIndex && !!submitted && submitted.every((c) => c.state === "correct");

              return (
                <div
                  key={rowIndex}
                  className={`flex gap-1 sm:gap-2 lg:gap-1.5 ${isCurrentRow && shakeRow ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
                >
                  {rowCells.map((cell, i) => {
                    const isRevealing = rowIndex === revealRowIndex && cell.state !== "empty";

                    if (isRevealing) {
                      return (
                        <div
                          key={i}
                          aria-label={cellLabel(cell)}
                          className={`relative ${size} ${bounce ? "termo-tile-bounce" : ""}`}
                          style={{ perspective: "400px", animationDelay: bounce ? `${WORD_LENGTH * 200 + 300 + i * 100}ms` : undefined }}
                        >
                          <div
                            aria-hidden
                            className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 font-extrabold uppercase ${cellClasses.empty}`}
                            style={{ animation: "flipRevealFront 0.5s ease-in both", animationDelay: `${i * 200}ms`, backfaceVisibility: "hidden" }}
                          >
                            {cell.letter}
                          </div>
                          <div
                            aria-hidden
                            className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 font-extrabold uppercase ${cellClasses[cell.state]}`}
                            style={{ animation: "flipRevealBack 0.5s ease-out both", animationDelay: `${i * 200}ms`, backfaceVisibility: "hidden" }}
                          >
                            {cell.letter}
                          </div>
                        </div>
                      );
                    }

                    const clickable = isCurrentRow && editable;
                    const hint = isCurrentRow && !cell.letter ? boardHints.find((h) => h.pos === i) : undefined;
                    return (
                      <div
                        // chave muda com a letra: remonta e toca o "salto" a cada tecla
                        key={`${i}-${cell.letter}`}
                        aria-label={hint ? `vazio, dica: ${hint.letter.toUpperCase()}` : cellLabel(cell)}
                        onClick={() => clickable && onCellClick(i)}
                        className={`flex items-center justify-center rounded-xl border-2 font-extrabold uppercase transition-all duration-200 ${size} ${cellClasses[cell.state]} ${
                          isCurrentRow && cursor === i ? "scale-105 border-[var(--accent)] ring-2 ring-[var(--accent)]/40" : ""
                        } ${cell.letter && cell.state === "empty" ? "termo-tile-pop scale-105 border-[var(--fg-muted)]" : ""} ${
                          clickable ? "cursor-pointer" : ""
                        } ${bounce ? "termo-tile-bounce" : ""}`}
                        style={bounce ? { animationDelay: `${i * 100}ms` } : undefined}
                      >
                        {hint ? <span className="text-[var(--termo-correct)] opacity-50">{hint.letter}</span> : cell.letter}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
