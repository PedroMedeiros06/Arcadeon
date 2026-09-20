"use client";

import { useEffect, useMemo, useState } from "react";
import { ResultsScreen } from "@/components/buggle/ResultsScreen";
import type { BoggleBoard, BoggleCell, RoundEndedPayload } from "@/lib/buggle/types";

const NAMES = [
  "Ana", "Bruno", "Carla", "Davi", "Elis", "Felipe", "Gabi", "Hugo",
  "Iris", "Joao", "Kate", "Leo", "Mari", "Nico", "Olga", "Pedro",
  "Rui", "Sara", "Tom", "Uma", "Vini", "Wesley", "Xico", "Yara",
];
// pool de palavras por tamanho, pra poder pedir "gera N palavras de M letras"
const WORDS_BY_LENGTH: Record<number, string[]> = {
  2: ["AR", "OI"],
  3: ["SOL", "MAR", "LUZ", "CEU"],
  4: ["CASA", "GATO", "BOLA", "MESA", "TELA", "VENTO".slice(0, 4)],
  5: ["FESTA", "PORTA", "PAPEL", "AREIA", "PRAIA", "NUVEM"],
  6: ["AMIGO", "JARDIM", "JANELA".slice(0, 6), "CANETA", "SOMBRA", "TERRA".padEnd(6, "A")],
  7: ["PARQUE", "JANELA", "CADEIRA".slice(0, 7), "TECLADO".slice(0, 7)],
  8: ["CAMINHO", "ESTRELA", "TELEFONE".slice(0, 8)],
  9: ["MONTANHA", "COMPUTADOR".slice(0, 9)],
  10: ["COMPUTADOR"],
};
const FALLBACK_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVXZ";
function wordOfLength(len: number, index: number): string {
  const pool = WORDS_BY_LENGTH[len];
  if (pool && pool.length > 0) return pool[index % pool.length];
  // sem palavra real desse tamanho: gera uma sequencia de letras so pra preencher
  return Array.from({ length: len }, (_, i) => FALLBACK_LETTERS[(index + i) % FALLBACK_LETTERS.length]).join("");
}
const FILLER_LETTERS = "AEIOUBCDDFGHLMNNPQRRSSTTVZ";

function makeBoard(size: number): BoggleBoard {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      letter: FILLER_LETTERS[Math.floor(Math.random() * FILLER_LETTERS.length)],
    }))
  );
}

// gera um caminho de celulas adjacentes (nao precisa bater com a letra real,
// e so pra visualizar o highlight no mock)
function fakePath(len: number, boardSize: number): BoggleCell[] {
  const path: { row: number; col: number }[] = [{ row: 0, col: 0 }];
  while (path.length < len) {
    const last = path[path.length - 1];
    const candidates = [
      { row: last.row + 1, col: last.col },
      { row: last.row, col: last.col + 1 },
      { row: last.row + 1, col: last.col + 1 },
      { row: last.row - 1, col: last.col + 1 },
    ].filter(
      (c) =>
        c.row >= 0 &&
        c.row < boardSize &&
        c.col >= 0 &&
        c.col < boardSize &&
        !path.some((p) => p.row === c.row && p.col === c.col)
    );
    if (candidates.length === 0) break;
    path.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }
  return path.map((p) => ({ ...p, letter: "A" }));
}

function makeResult(
  playerCount: number,
  wordCount: number,
  minLen: number,
  maxLen: number,
  secretFound: boolean,
  board: BoggleBoard
): RoundEndedPayload {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    socketId: `mock-${i}`,
    name: NAMES[i % NAMES.length],
    score: 0,
    wordsFound: 0,
    avatar: null,
  }));

  const allWords = Array.from({ length: wordCount }, (_, i) => {
    const len = minLen + (i % Math.max(1, maxLen - minLen + 1));
    return { word: wordOfLength(len, i), path: fakePath(len, board.length) };
  });
  const secretWord = allWords[Math.floor(allWords.length / 2)] ?? null;

  const foundBy = players.map((p, playerIndex) => {
    const found = allWords
      .filter((w) => {
        if (secretWord && w.word === secretWord.word) return secretFound;
        return Math.random() > 0.4;
      })
      .map((w) => w.word);
    return { socketId: p.socketId, name: p.name, foundWords: found };
  });
  // se a secreta foi "encontrada", garante que pelo menos 1 jogador tem ela
  if (secretWord && secretFound && !foundBy.some((f) => f.foundWords.includes(secretWord.word))) {
    foundBy[0]?.foundWords.push(secretWord.word);
  }

  return {
    room: {
      code: "MOCK1",
      ownerSocketId: "owner",
      hostSocketId: players[0]?.socketId ?? null,
      config: { boardSize: board.length, roundSeconds: 180, minWordLength: 3, visibility: "public", maxPlayers: 24 },
      phase: "results",
      board,
      roundEndsAt: null,
      players,
    },
    allWords,
    secretWord: secretWord ? { word: secretWord.word, path: secretWord.path } : null,
    foundBy,
  };
}

export default function BuggleMockResultsPage() {
  const [playerCount, setPlayerCount] = useState(4);
  const [wordCount, setWordCount] = useState(8);
  const [boardSize, setBoardSize] = useState(5);
  const [minLen, setMinLen] = useState(3);
  const [maxLen, setMaxLen] = useState(6);
  const [secretFound, setSecretFound] = useState(true);
  const [seed, setSeed] = useState(0);
  // board usa Math.random, entao so gera depois de montar no client
  // (evita mismatch de hidratacao com o SSR)
  const [board, setBoard] = useState<BoggleBoard | null>(null);

  useEffect(() => {
    setBoard(makeBoard(boardSize));
  }, [boardSize, seed]);

  const result = useMemo(
    () => (board ? makeResult(playerCount, wordCount, minLen, Math.max(minLen, maxLen), secretFound, board) : null),
    [playerCount, wordCount, minLen, maxLen, secretFound, board]
  );

  if (!result) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b-2 border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">
          Mock resultados (dev only) —
        </span>
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--fg-muted)]">
          Players: {playerCount}
        </label>
        <input
          type="range"
          min={1}
          max={24}
          value={playerCount}
          onChange={(e) => setPlayerCount(Number(e.target.value))}
          className="w-32"
        />
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--fg-muted)]">
          Palavras: {wordCount}
        </label>
        <input
          type="range"
          min={1}
          max={40}
          value={wordCount}
          onChange={(e) => setWordCount(Number(e.target.value))}
          className="w-32"
        />
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--fg-muted)]">
          Board: {boardSize}x{boardSize}
        </label>
        <input
          type="range"
          min={4}
          max={8}
          value={boardSize}
          onChange={(e) => setBoardSize(Number(e.target.value))}
          className="w-32"
        />
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--fg-muted)]">
          Letras min: {minLen}
        </label>
        <input
          type="range"
          min={2}
          max={10}
          value={minLen}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMinLen(v);
            if (v > maxLen) setMaxLen(v);
          }}
          className="w-24"
        />
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--fg-muted)]">
          Letras max: {maxLen}
        </label>
        <input
          type="range"
          min={2}
          max={10}
          value={maxLen}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMaxLen(v);
            if (v < minLen) setMinLen(v);
          }}
          className="w-24"
        />
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--fg-muted)]">
          <input type="checkbox" checked={secretFound} onChange={(e) => setSecretFound(e.target.checked)} />
          Secreta encontrada
        </label>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-bold text-[var(--fg-muted)] transition hover:bg-[var(--card)]"
        >
          Regenerar
        </button>
      </div>

      <ResultsScreen key={seed} result={result} isHost onPlayAgain={() => alert("Jogar novamente (mock)")} />
    </div>
  );
}
