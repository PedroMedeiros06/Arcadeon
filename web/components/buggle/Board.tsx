"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoggleBoard, BoggleCell, WordResult } from "@/lib/buggle/types";

interface BoardProps {
  board: BoggleBoard;
  onWordSubmit: (word: string, path: BoggleCell[]) => void;
  onPathChange?: (word: string) => void;
  lastResult?: WordResult | null;
}

function isAdjacent(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && !(a.row === b.row && a.col === b.col);
}

export function Board({ board, onWordSubmit, onPathChange, lastResult }: BoardProps) {
  const [path, setPath] = useState<{ row: number; col: number }[]>([]);
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [flashPath, setFlashPath] = useState<{ row: number; col: number }[]>([]);
  const [flashColor, setFlashColor] = useState<"green" | "yellow">("green");
  const dragging = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastSubmittedPath = useRef<{ row: number; col: number }[]>([]);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSelected = (row: number, col: number) => path.some((p) => p.row === row && p.col === col);
  const isFlashing = (row: number, col: number) => flashPath.some((p) => p.row === row && p.col === col);

  const reset = useCallback(() => setPath([]), []);

  const submit = useCallback(() => {
    if (path.length > 0) {
      const cells = path.map((p) => board[p.row][p.col]);
      const word = cells.map((c) => c.letter).join("");
      lastSubmittedPath.current = path;
      onWordSubmit(word, cells);
    }
    setPath([]);
  }, [path, board, onWordSubmit]);

  // palavra aceita = verde; palavra ja encontrada antes por esse jogador = amarelo
  useEffect(() => {
    if (!lastResult) return;
    if (!lastResult.accepted && !lastResult.alreadyFound) return;
    setFlashColor(lastResult.accepted ? "green" : "yellow");
    setFlashPath(lastSubmittedPath.current);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlashPath([]), 500);
    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, [lastResult]);

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
      const margin = cellSize * 0.14;
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
  // Board sempre ocupa a largura inteira disponivel (eixo X cheio, igual referencia);
  // boards maiores ficam mais largos ate um teto pra nao esticar demais em telas grandes.
  const maxBoardPx = 130 * size;

  return (
    <div className="flex w-full flex-col items-center gap-4 select-none">
      <div
        ref={gridRef}
        className="relative grid w-full touch-none gap-2.5 rounded-3xl bg-[var(--primary-tint)] p-3 shadow-[0_6px_0_var(--border)]"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          maxWidth: `${maxBoardPx}px`,
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
            const flashing = isFlashing(cell.row, cell.col);
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
                className={`relative flex aspect-square w-full items-center justify-center rounded-xl font-extrabold uppercase text-white transition ${
                  flashing
                    ? flashColor === "green"
                      ? "bg-[#4ade80] shadow-[0_4px_0_#16a34a]"
                      : "bg-[#facc15] shadow-[0_4px_0_#ca8a04]"
                    : selected
                      ? "bg-[var(--primary)] shadow-[0_2px_0_var(--primary-dark)] scale-95"
                      : "bg-[var(--primary-dark)] shadow-[0_4px_0_color-mix(in_srgb,var(--primary-dark)_60%,black)] hover:brightness-110"
                }`}
                style={{ zIndex: 2, fontSize: `clamp(1.5rem, ${220 / size}%, 3.5rem)` }}
              >
                {cell.letter}
                {/* debug: area tocavel real (zona central que cellFromPoint aceita) */}
                <span
                  className="pointer-events-none absolute bg-red-500/20"
                  style={{ inset: "14%" }}
                />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
