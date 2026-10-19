"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { CARD_PRELOAD_SRCS } from "@/lib/cofre/cards";
import type { CellState } from "@/lib/cofre/engine";
import { Card } from "./Card";

export interface BoardCell {
  face: string | null;
  state: CellState;
}

const SWAP_CLASSES = ["cofre-swap"];

// celular em pe: o tabuleiro deita (6x4 vira 4 colunas x 6 linhas) e as cartas ficam bem maiores.
// As posicoes sao so indices, entao mudar o numero de colunas nao muda nada no jogo.
const PORTRAIT_QUERY = "(max-width: 640px) and (orientation: portrait)";

function subscribePortrait(onChange: () => void) {
  const mq = window.matchMedia(PORTRAIT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePortrait(): boolean {
  return useSyncExternalStore(
    subscribePortrait,
    () => window.matchMedia(PORTRAIT_QUERY).matches,
    () => false
  );
}

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
  const portrait = usePortrait();
  const boardRows = Math.ceil(cells.length / cols);
  const shownCols = portrait && cols > boardRows ? boardRows : cols;
  const rows = Math.ceil(cells.length / shownCols);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const swapKey = swap?.key ?? null;
  const swapA = swap?.a ?? -1;
  const swapB = swap?.b ?? -1;

  // baixa todas as artes ao abrir o tabuleiro: a carta que vira ja tem a imagem no cache
  useEffect(() => {
    const imgs = CARD_PRELOAD_SRCS.map((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      return img;
    });
    return () => imgs.forEach((img) => (img.src = ""));
  }, []);

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
        gridTemplateColumns: `repeat(${shownCols}, minmax(0, 1fr))`,
        maxWidth: `min(100%, calc((100dvh - 12rem) * ${((shownCols / rows) * 0.75).toFixed(4)}))`,
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
