"use client";

import { useCallback, useRef, useState } from "react";
import type { BoggleBoard } from "@/lib/buggle/types";

function cellFromPoint(x: number, y: number): { row: number; col: number } | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const cellEl = el?.closest("[data-row]") as HTMLElement | null;
  if (!cellEl) return null;
  return { row: Number(cellEl.dataset.row), col: Number(cellEl.dataset.col) };
}

interface BoardProps {
  board: BoggleBoard;
  onWordSubmit: (word: string) => void;
}

function isAdjacent(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && !(a.row === b.row && a.col === b.col);
}

export function Board({ board, onWordSubmit }: BoardProps) {
  const [path, setPath] = useState<{ row: number; col: number }[]>([]);
  const dragging = useRef(false);

  const isSelected = (row: number, col: number) => path.some((p) => p.row === row && p.col === col);

  const reset = useCallback(() => setPath([]), []);

  const submit = useCallback(() => {
    if (path.length > 0) {
      const word = path.map((p) => board[p.row][p.col].letter).join("");
      onWordSubmit(word);
    }
    setPath([]);
  }, [path, board, onWordSubmit]);

  const tryAddCell = useCallback(
    (row: number, col: number) => {
      setPath((prev) => {
        if (prev.length === 0) return [{ row, col }];
        const last = prev[prev.length - 1];
        if (last.row === row && last.col === col) return prev;
        // Voltar pra célula anterior = desfazer último passo
        if (prev.length > 1) {
          const prevLast = prev[prev.length - 2];
          if (prevLast.row === row && prevLast.col === col) return prev.slice(0, -1);
        }
        if (prev.some((p) => p.row === row && p.col === col)) return prev;
        if (!isAdjacent(last, { row, col })) return prev;
        return [...prev, { row, col }];
      });
    },
    []
  );

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        className="grid gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-3"
        style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}
        onMouseLeave={() => {
          if (dragging.current) {
            dragging.current = false;
            submit();
          }
        }}
        onMouseUp={() => {
          if (dragging.current) {
            dragging.current = false;
            submit();
          }
        }}
      >
        {board.map((row) =>
          row.map((cell) => {
            const selected = isSelected(cell.row, cell.col);
            return (
              <button
                key={`${cell.row}-${cell.col}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  dragging.current = true;
                  reset();
                  tryAddCell(cell.row, cell.col);
                }}
                onMouseEnter={() => {
                  if (dragging.current) tryAddCell(cell.row, cell.col);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  dragging.current = true;
                  reset();
                  tryAddCell(cell.row, cell.col);
                }}
                onTouchMove={(e) => {
                  if (!dragging.current) return;
                  const touch = e.touches[0];
                  const target = cellFromPoint(touch.clientX, touch.clientY);
                  if (target) tryAddCell(target.row, target.col);
                }}
                onTouchEnd={() => {
                  if (dragging.current) {
                    dragging.current = false;
                    submit();
                  }
                }}
                data-row={cell.row}
                data-col={cell.col}
                className={`flex aspect-square w-10 items-center justify-center rounded-lg border-2 text-lg font-extrabold uppercase transition sm:w-12 ${
                  selected
                    ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg)]"
                }`}
              >
                {cell.letter}
              </button>
            );
          })
        )}
      </div>

      <div className="flex min-h-8 items-center gap-2 font-mono text-xl font-bold tracking-wider text-[var(--fg)]">
        {path.map((p) => board[p.row][p.col].letter).join("")}
      </div>
    </div>
  );
}
