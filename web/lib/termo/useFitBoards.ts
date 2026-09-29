"use client";

import { useEffect, useState } from "react";
import { fitCells } from "@/components/termo/Board";
import type { BoardCount } from "./logic";

/**
 * Mede a area reservada aos tabuleiros e devolve o tamanho de celula que cabe nela.
 * Assim o Quádruplo no celular encolhe as letras em vez de empurrar o teclado pra fora da tela.
 */
export function useFitBoards(boardCount: BoardCount, rows: number) {
  // ref por callback: a area so monta depois que a partida carrega
  const [el, ref] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  // sobra um respiro pra sombra das celulas e o pulo da animacao de vitoria
  const fit = size && size.width > 0 && size.height > 0 ? fitCells(boardCount, rows, size.width, size.height - 8) : null;
  return { ref, fit };
}
