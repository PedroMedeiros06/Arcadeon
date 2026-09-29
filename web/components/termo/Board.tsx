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

// proporcoes em relacao a celula: espaco entre letras e entre tabuleiros
const GAP = 0.12;
const BOARD_GAP = 0.6;
const MAX_CELL = 62;
// no Quádruplo a celula pode ficar mais larga que alta (ate ~2:1) quando falta altura, como no
// celular em pe; nos outros modos fica quase quadrada
const minHeightRatio = (boardCount: BoardCount) => (boardCount === 4 ? 0.5 : 0.9);

export interface BoardFit {
  /** largura e altura da celula em px */
  w: number;
  h: number;
  /** quantos tabuleiros por linha */
  columns: number;
}

/**
 * Maior celula que faz os tabuleiros caberem em width x height. Quádruplo testa 4 lado a lado
 * e 2x2; Duplo testa lado a lado e empilhado. Vence o que deixa a letra maior.
 */
export function fitCells(boardCount: BoardCount, rows: number, width: number, height: number): BoardFit {
  const options = boardCount === 4 ? [4, 2] : boardCount === 2 ? [2, 1] : [1];
  let best: BoardFit = { w: 0, h: 0, columns: options[0] };
  for (const columns of options) {
    const boardRows = boardCount / columns;
    const wUnits = columns * (WORD_LENGTH + (WORD_LENGTH - 1) * GAP) + (columns - 1) * BOARD_GAP;
    const hUnits = boardRows * (rows + (rows - 1) * GAP) + (boardRows - 1) * BOARD_GAP;
    let w = Math.min(width / wUnits, MAX_CELL);
    const h = Math.min(height / hUnits, w);
    w = Math.min(w, h / minHeightRatio(boardCount));
    if (h > best.h || (h === best.h && w > best.w)) best = { w, h, columns };
  }
  return { w: Math.floor(best.w), h: Math.floor(best.h), columns: best.columns };
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
  /** tamanho calculado por fitCells: celula em px e colunas de tabuleiros */
  fit?: BoardFit;
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
  fit,
}: BoardsProps) {
  const totalRows = rowCount ?? maxAttemptsFor(boardCount);
  // com fit, tudo sai do tamanho da celula (estilo inline); sem fit, classes fixas por modo
  const size = fit ? "" : sizeClasses(boardCount);
  const small = fit ? Math.min(fit.w, fit.h) : 0;
  const cellCss: React.CSSProperties | undefined = fit
    ? {
        width: fit.w,
        height: fit.h,
        fontSize: Math.round(Math.min(fit.h * 0.72, fit.w * 0.62)),
        borderRadius: Math.max(4, Math.round(small * 0.22)),
        // sombra de 4px em celula pequena invade a linha de baixo
        boxShadow: small < 36 ? "none" : undefined,
        borderWidth: small < 28 ? 1.5 : undefined,
      }
    : undefined;
  const rowGapCss: React.CSSProperties | undefined = fit ? { gap: Math.max(2, Math.round(fit.h * GAP)) } : undefined;
  const cellGapCss: React.CSSProperties | undefined = fit ? { gap: Math.max(2, Math.round(fit.w * GAP)) } : undefined;

  return (
    <div
      className={
        fit
          ? "grid justify-center"
          : boardCount === 4
            ? "grid grid-cols-2 gap-x-2 gap-y-1 sm:flex sm:justify-center sm:gap-8 lg:gap-4"
            : "flex justify-center gap-4 sm:gap-8 lg:gap-4"
      }
      style={
        fit
          ? {
              gridTemplateColumns: `repeat(${fit.columns}, auto)`,
              columnGap: Math.round(fit.w * BOARD_GAP),
              rowGap: Math.round(fit.h * BOARD_GAP),
            }
          : undefined
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
            className={`flex shrink-0 flex-col transition-opacity ${fit ? "" : `sm:gap-2.5 lg:gap-1.5 ${boardCount === 4 ? "gap-[3px]" : "gap-1.5"}`} ${solved && bounceRowIndex === null ? "opacity-60" : ""}`}
            style={rowGapCss}
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
                  className={`flex ${fit ? "" : "gap-1 sm:gap-2 lg:gap-1.5"} ${isCurrentRow && shakeRow ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
                  style={cellGapCss}
                >
                  {rowCells.map((cell, i) => {
                    const isRevealing = rowIndex === revealRowIndex && cell.state !== "empty";

                    if (isRevealing) {
                      return (
                        <div
                          key={i}
                          aria-label={cellLabel(cell)}
                          className={`relative ${size} ${bounce ? "termo-tile-bounce" : ""}`}
                          style={{
                            ...cellCss,
                            perspective: "400px",
                            animationDelay: bounce ? `${WORD_LENGTH * 200 + 300 + i * 100}ms` : undefined,
                          }}
                        >
                          <div
                            aria-hidden
                            className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 font-extrabold uppercase ${cellClasses.empty}`}
                            style={{
                              borderRadius: cellCss?.borderRadius,
                              animation: "flipRevealFront 0.5s ease-in both",
                              animationDelay: `${i * 200}ms`,
                              backfaceVisibility: "hidden",
                            }}
                          >
                            {cell.letter}
                          </div>
                          <div
                            aria-hidden
                            className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 font-extrabold uppercase ${cellClasses[cell.state]}`}
                            style={{
                              borderRadius: cellCss?.borderRadius,
                              animation: "flipRevealBack 0.5s ease-out both",
                              animationDelay: `${i * 200}ms`,
                              backfaceVisibility: "hidden",
                            }}
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
                        style={bounce ? { ...cellCss, animationDelay: `${i * 100}ms` } : cellCss}
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
