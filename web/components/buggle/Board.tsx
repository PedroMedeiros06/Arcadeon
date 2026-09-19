"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoggleBoard } from "@/lib/buggle/types";

interface BoardProps {
  board: BoggleBoard;
  onWordSubmit: (word: string) => void;
  onPathChange?: (word: string) => void;
}

function isAdjacent(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && !(a.row === b.row && a.col === b.col);
}

export function Board({ board, onWordSubmit, onPathChange }: BoardProps) {
  const [path, setPath] = useState<{ row: number; col: number }[]>([]);
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const dragging = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const isSelected = (row: number, col: number) => path.some((p) => p.row === row && p.col === col);

  const reset = useCallback(() => setPath([]), []);

  const submit = useCallback(() => {
    if (path.length > 0) {
      const word = path.map((p) => board[p.row][p.col].letter).join("");
      onWordSubmit(word);
    }
    setPath([]);
  }, [path, board, onWordSubmit]);

  const cellFromPoint = useCallback(
    (x: number, y: number): { row: number; col: number } | null => {
      const gridEl = gridRef.current;
      if (!gridEl) return null;
      const rect = gridEl.getBoundingClientRect();
      const relX = x - rect.left;
      const relY = y - rect.top;
      if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;
      const cellSize = rect.width / board.length;
      const col = Math.min(board.length - 1, Math.max(0, Math.floor(relX / cellSize)));
      const row = Math.min(board.length - 1, Math.max(0, Math.floor(relY / cellSize)));

      // So conta a celula se o ponto estiver na zona central dela (evita
      // trocar de celula so por encostar na borda, o que quebrava diagonais).
      const cellLeft = col * cellSize;
      const cellTop = row * cellSize;
      const localX = relX - cellLeft;
      const localY = relY - cellTop;
      const margin = cellSize * 0.18;
      if (
        localX < margin ||
        localX > cellSize - margin ||
        localY < margin ||
        localY > cellSize - margin
      ) {
        return null;
      }

      return { row, col };
    },
    [board.length]
  );

  const tryAddCell = useCallback((row: number, col: number) => {
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
  }, []);

  useEffect(() => {
    onPathChange?.(path.map((p) => board[p.row][p.col].letter).join(""));

    const gridEl = gridRef.current;
    if (!gridEl || path.length === 0) {
      setLinePoints([]);
      return;
    }
    const gridRect = gridEl.getBoundingClientRect();
    const points = path.map((p) => {
      const cellEl = cellRefs.current.get(`${p.row}-${p.col}`);
      if (!cellEl) return { x: 0, y: 0 };
      const rect = cellEl.getBoundingClientRect();
      return {
        x: rect.left - gridRect.left + rect.width / 2,
        y: rect.top - gridRect.top + rect.height / 2,
      };
    });
    setLinePoints(points);
  }, [path, board, onPathChange]);

  const size = board.length;
  // Board pequeno (4x4-6x6) ocupa quase toda a largura disponivel;
  // boards maiores crescem menos por celula, mas o board em si fica maior.
  const maxBoardPx = Math.min(420, 68 * size);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        ref={gridRef}
        className="relative grid gap-2.5 rounded-2xl bg-[var(--primary-tint)] p-3"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          width: `min(90vw, ${maxBoardPx}px)`,
        }}
        onMouseMove={(e) => {
          if (!dragging.current) return;
          const target = cellFromPoint(e.clientX, e.clientY);
          if (target) tryAddCell(target.row, target.col);
        }}
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
        {linePoints.length > 1 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
            <polyline
              points={linePoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          </svg>
        )}

        {board.map((row) =>
          row.map((cell) => {
            const selected = isSelected(cell.row, cell.col);
            return (
              <button
                key={`${cell.row}-${cell.col}`}
                ref={(el) => {
                  if (el) cellRefs.current.set(`${cell.row}-${cell.col}`, el);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  dragging.current = true;
                  reset();
                  tryAddCell(cell.row, cell.col);
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
                className={`relative flex aspect-square w-full items-center justify-center rounded-lg border-2 font-extrabold uppercase transition ${
                  selected
                    ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white scale-95"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:border-[var(--primary)]"
                }`}
                style={{ zIndex: 2, fontSize: `clamp(0.75rem, ${90 / size}%, 1.5rem)` }}
              >
                {cell.letter}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
