"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WORD_LENGTH } from "./logic";

/**
 * Linha sendo digitada (letras + cursor) e teclado fisico/virtual. Compartilhado pelos modos
 * (Diario/Infinito, Contra o Tempo, Vilao). `onSubmit` recebe a palavra completa ou incompleta.
 */
export function useWordInput({ enabled, onSubmit }: { enabled: boolean; onSubmit: (word: string) => void }) {
  const [letters, setLetters] = useState<string[]>(Array(WORD_LENGTH).fill(""));
  const [cursor, setCursor] = useState(0);
  const [shake, setShake] = useState(false);
  // sempre a versao mais nova do onSubmit, sem reinscrever o listener de teclado a cada render
  const submitRef = useRef(onSubmit);
  useEffect(() => {
    submitRef.current = onSubmit;
  });

  const reset = useCallback(() => {
    setLetters(Array(WORD_LENGTH).fill(""));
    setCursor(0);
  }, []);

  const shakeRow = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }, []);

  const handleKey = useCallback(
    (key: string) => {
      if (!enabled) return;

      if (key === "Enter") {
        submitRef.current(letters.join(""));
        return;
      }

      if (key === "Back") {
        const next = [...letters];
        if (next[cursor]) {
          next[cursor] = "";
        } else {
          const prev = Math.max(0, cursor - 1);
          next[prev] = "";
          setCursor(prev);
        }
        setLetters(next);
        return;
      }

      if (/^[a-zA-Z]$/.test(key)) {
        const next = [...letters];
        next[cursor] = key.toLowerCase();
        setLetters(next);
        // pula pro proximo quadrado vazio (o jogador pode ter editado no meio)
        let nextCursor = Math.min(cursor + 1, WORD_LENGTH - 1);
        for (let i = cursor + 1; i < WORD_LENGTH; i++) {
          if (!next[i]) {
            nextCursor = i;
            break;
          }
        }
        setCursor(nextCursor);
      }
    },
    [enabled, letters, cursor],
  );

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      // atalhos (Ctrl+R etc.) nao digitam; foco em campo de texto tambem nao
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Backspace") handleKey("Back");
      else if (e.key === "Enter") handleKey("Enter");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, handleKey]);

  return { letters, cursor, setCursor, shake, shakeRow, reset, handleKey };
}
