"use client";

import { useLayoutEffect, useRef } from "react";
import type { CellState } from "@/lib/cofre/engine";
import { Card } from "./Card";

export interface BoardCell {
  face: string | null;
  state: CellState;
}

const SWAP_CLASSES = ["cofre-swap"];

export function Board({
  cols,
  cells,
  disabled,
  swap,
  onFlip,
}: {
  cols: number;
  cells: BoardCell[];
  disabled: boolean;
  /** key muda a cada troca nova */
  swap: { a: number; b: number; key: number } | null;
  onFlip: (index: number) => void;
}) {
  const rows = Math.ceil(cells.length / cols);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const swapKey = swap?.key ?? null;
  const swapA = swap?.a ?? -1;
  const swapB = swap?.b ?? -1;

  // o estado ja chega trocado; aqui so animamos cada carta saindo da posicao da outra (FLIP)
  useLayoutEffect(() => {
    if (swapKey === null) return;
    const elA = cellRefs.current[swapA];
    const elB = cellRefs.current[swapB];
    if (!elA || !elB) return;
    const ra = elA.getBoundingClientRect();
    const rb = elB.getBoundingClientRect();
    const pairs: [HTMLDivElement, number, number][] = [
      [elA, rb.left - ra.left, rb.top - ra.top],
      [elB, ra.left - rb.left, ra.top - rb.top],
    ];
    const cleanups: (() => void)[] = [];
    for (const [el, dx, dy] of pairs) {
      el.classList.remove(...SWAP_CLASSES);
      el.style.setProperty("--dx", `${dx}px`);
      el.style.setProperty("--dy", `${dy}px`);
      void el.offsetWidth; // reinicia a animacao se a mesma celula trocar de novo
      el.classList.add(...SWAP_CLASSES);
      const done = () => el.classList.remove(...SWAP_CLASSES);
      const timer = window.setTimeout(done, 700);
      cleanups.push(() => {
        window.clearTimeout(timer);
        done();
      });
    }
    return () => cleanups.forEach((fn) => fn());
  }, [swapKey, swapA, swapB]);

  return (
    <div
      className="cofre-motion mx-auto grid w-full gap-2 sm:gap-3"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        maxWidth: `min(100%, calc((100dvh - 12rem) * ${((cols / rows) * 0.75).toFixed(4)}))`,
      }}
    >
      {cells.map((cell, i) => (
        <div
          key={i}
          ref={(el) => {
            cellRefs.current[i] = el;
          }}
          className="relative rounded-xl"
        >
          <Card face={cell.face} state={cell.state} disabled={disabled} onFlip={() => onFlip(i)} />
        </div>
      ))}
    </div>
  );
}
