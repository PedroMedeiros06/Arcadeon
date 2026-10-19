"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Shuffle } from "lucide-react";
import { useLocalFlag } from "@/lib/race/useLocalFlag";
import { BOARD_SIZES, createGame, flip, mulberry32, resolveMiss, soloScore, type BoardSize, type GameState, type Rng } from "@/lib/cofre/engine";
import { initCofreSound, playSfx } from "@/lib/cofre/sound";
import { Board, type BoardCell } from "./Board";
import { SoundToggle } from "./SoundToggle";

const SIZES = Object.keys(BOARD_SIZES) as BoardSize[];
/** tempo que as duas cartas erradas ficam a mostra */
const MISS_REVEAL_MS = 900;
/** espera a virada (300 ms no CSS) acabar antes de trocar, senao parece que a carta errada ficou no lugar */
const FLIP_BACK_MS = 320;

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const chipClass = (active: boolean) =>
  `rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${
    active
      ? "border-[var(--game-accent)] bg-[var(--game-accent)] text-white"
      : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:border-[var(--border-hover)]"
  }`;

export function PracticeScreen({ onExit }: { onExit: () => void }) {
  const [size, setSize] = useState<BoardSize>("6x4");
  const [movingBoard, setMovingBoard] = useLocalFlag("cofreTreinoMovel", false);
  const [game, setGame] = useState<GameState | null>(null);
  const [swap, setSwap] = useState<{ a: number; b: number; key: number } | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const rngRef = useRef<Rng>(mulberry32(1));
  const missTimer = useRef<number | null>(null);
  const swapKey = useRef(0);

  const clearMissTimer = () => {
    if (missTimer.current !== null) window.clearTimeout(missTimer.current);
    missTimer.current = null;
  };

  // timeout velho nunca pode mexer num jogo novo nem numa tela desmontada
  useEffect(() => {
    initCofreSound();
    return () => {
      if (missTimer.current !== null) window.clearTimeout(missTimer.current);
    };
  }, []);

  const running = startedAt !== null && endedAt === null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const start = () => {
    clearMissTimer();
    rngRef.current = mulberry32(Date.now() >>> 0);
    setGame(createGame({ size, movingBoard, coringa: false }, 1, rngRef.current));
    setSwap(null);
    setSwapping(false);
    setStartedAt(null);
    setEndedAt(null);
  };

  const backToSetup = () => {
    clearMissTimer();
    setSwapping(false);
    setGame(null);
  };

  const handleFlip = (index: number) => {
    if (!game) return;
    const result = flip(game, index);
    if (result.event.kind === "invalid") return;
    const t = Date.now();
    if (startedAt === null) {
      setStartedAt(t);
      setNow(t);
    }
    setGame(result.state);
    playSfx("flip");
    if (result.event.kind === "match") {
      playSfx(result.event.points === 3 ? "coringa" : "match");
      if (result.event.finished) {
        setEndedAt(t);
        playSfx("open");
      }
    }
    if (result.event.kind === "miss") {
      playSfx("miss");
      const missed = result.state;
      missTimer.current = window.setTimeout(() => {
        missTimer.current = null;
        const resolved = resolveMiss(missed, rngRef.current);
        const swapped = resolved.swap;
        if (!swapped) {
          setGame(resolved.state);
          return;
        }
        // 1o vira as erradas pra baixo sem trocar; so depois da virada aplica a troca
        setGame({ ...resolved.state, cells: missed.cells.map((c, i) => (missed.flipped.includes(i) ? { ...c, state: "hidden" } : c)) });
        setSwapping(true);
        missTimer.current = window.setTimeout(() => {
          missTimer.current = null;
          setGame(resolved.state);
          setSwapping(false);
          swapKey.current += 1;
          playSfx("swap");
          setSwap({ a: swapped[0], b: swapped[1], key: swapKey.current });
        }, FLIP_BACK_MS);
      }, MISS_REVEAL_MS);
    }
  };

  if (!game) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
        <button
          type="button"
          onClick={onExit}
          className="flex w-fit items-center gap-1 text-sm font-bold text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div>
          <h2 className="text-2xl font-black text-[var(--fg)]">Treino</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Ache todos os pares com o mínimo de jogadas. Sem ranking, só pra afiar a memória.</p>
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-[var(--fg)]">Tamanho do tabuleiro</h3>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSize(s)} className={chipClass(size === s)}>
                {s.replace("x", "×")}
              </button>
            ))}
          </div>
        </section>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4">
          <input
            type="checkbox"
            checked={movingBoard}
            onChange={(e) => setMovingBoard(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[var(--game-accent)]"
          />
          <span>
            <span className="flex items-center gap-1.5 font-bold text-[var(--fg)]">
              <Shuffle className="h-4 w-4" /> Tabuleiro móvel
            </span>
            <span className="text-sm text-[var(--fg-muted)]">A cada erro, duas cartas escondidas trocam de lugar. Fique de olho!</span>
          </span>
        </label>
        <button
          type="button"
          onClick={start}
          className="rounded-2xl bg-[var(--game-accent)] py-3 text-lg font-black text-white shadow-md transition hover:brightness-110 active:scale-[0.98]"
        >
          Começar
        </button>
      </div>
    );
  }

  const totalPairs = game.cells.length / 2;
  const elapsed = startedAt === null ? 0 : (endedAt ?? now) - startedAt;
  const seconds = Math.floor(elapsed / 1000);
  const cells: BoardCell[] = game.cells.map((c) => ({ face: c.state === "hidden" ? null : c.face, state: c.state }));

  return (
    <div className="flex w-full flex-1 flex-col gap-3 px-3 py-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2">
        <button
          type="button"
          onClick={backToSetup}
          className="flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-bold text-[var(--fg-muted)] hover:bg-[var(--bg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Sair
        </button>
        <div className="flex items-center gap-2 text-sm font-bold tabular-nums">
          <SoundToggle />
          <span className="rounded-xl bg-[var(--card)] px-3 py-1.5 text-[var(--fg)]">Jogadas {game.moves}</span>
          <span className="rounded-xl bg-[var(--card)] px-3 py-1.5 text-[var(--fg)]">{formatTime(elapsed)}</span>
          <span className="rounded-xl bg-[var(--card)] px-3 py-1.5 text-[var(--fg)]">
            {game.players[0].pairs}/{totalPairs}
          </span>
        </div>
      </div>

      <Board cols={game.cols} cells={cells} disabled={game.pendingMiss || swapping || game.finished} swap={swap} onFlip={handleFlip} />

      {game.finished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-xl">
            <p className="text-sm font-bold text-[var(--game-accent)]">Cofre aberto!</p>
            <p className="mt-2 text-4xl font-black tabular-nums text-[var(--fg)]">Nota {soloScore(game.moves, seconds)}</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              {game.moves} jogadas em {formatTime(elapsed)} · quanto menor, melhor
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={start}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--game-accent)] py-3 font-black text-white transition hover:brightness-110"
              >
                <RotateCcw className="h-4 w-4" /> Jogar de novo
              </button>
              <button
                type="button"
                onClick={backToSetup}
                className="rounded-2xl border-2 border-[var(--border)] py-3 font-bold text-[var(--fg-muted)] hover:bg-[var(--bg)]"
              >
                Trocar tamanho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
