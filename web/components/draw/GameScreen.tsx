"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Pencil, UserX, Timer, PartyPopper } from "lucide-react";
import { Canvas } from "./Canvas";
import { GuessPanel } from "./GuessPanel";
import { DifficultyStars } from "./WordPicker";
import { playDrawSfx } from "@/lib/draw/sound";
import { DIFFICULTY_LABEL, type DrawRoomState, type FeedItem, type TurnEndedPayload } from "@/lib/draw/types";

interface CanvasHandlers {
  applyRemoteStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
  applyUndo: (strokeId: string) => void;
  applyClear: () => void;
  snapshot: () => string | null;
}

export interface Celebration {
  key: number;
  points: number;
}

interface GameScreenProps {
  room: DrawRoomState;
  mySocketId: string;
  feed: FeedItem[];
  lastTurn: TurnEndedPayload | null;
  celebration: Celebration | null;
  onStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
  onClear: () => void;
  onUndo: () => void;
  onSubmitGuess: (guess: string) => void;
  registerCanvasHandlers: (handlers: CanvasHandlers) => void;
}

const CONFETTI_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899"];

// pseudo-aleatorio deterministico (render precisa ser puro): espalha o confete de forma irregular
function jitter(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const CONFETTI_PIECES = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2 + jitter(i) * 0.4;
  const dist = 90 + jitter(i + 50) * 110;
  return {
    dx: `${Math.cos(angle) * dist}px`,
    dy: `${Math.sin(angle) * dist - 40}px`,
    rot: `${jitter(i + 100) * 720 - 360}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 3 === 0,
  };
});

/** Confete + "Acertou! +N" por cima do canvas, so pra quem acertou. */
function CelebrationOverlay({ celebration }: { celebration: Celebration }) {
  const pieces = CONFETTI_PIECES;

  return (
    <div key={celebration.key} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`draw-confetti absolute h-2.5 w-2.5 ${p.round ? "rounded-full" : "rounded-[2px]"}`}
          style={{ backgroundColor: p.color, ["--dx" as string]: p.dx, ["--dy" as string]: p.dy, ["--rot" as string]: p.rot }}
        />
      ))}
      <div className="animate-pop-in flex flex-col items-center rounded-2xl border-2 border-[var(--draw-ok)] bg-[var(--card)] px-5 py-3 shadow-2xl">
        <span className="flex items-center gap-1.5 text-lg font-black text-[var(--draw-ok)] sm:text-2xl">
          <PartyPopper size={22} /> Acertou!
        </span>
        <span className="text-2xl font-black tabular-nums text-[var(--primary)] sm:text-3xl">+{celebration.points}</span>
      </div>
    </div>
  );
}

const REASON_TEXT: Record<TurnEndedPayload["reason"], { text: string; Icon: typeof Clock }> = {
  "all-guessed": { text: "Todo mundo acertou!", Icon: PartyPopper },
  timeout: { text: "Tempo esgotado", Icon: Timer },
  "drawer-left": { text: "O desenhista saiu", Icon: UserX },
};

/** Resumo do turno: revela a palavra e quanto cada um ganhou. */
function TurnResultsOverlay({ turn, mySocketId }: { turn: TurnEndedPayload; mySocketId: string }) {
  const { text, Icon } = REASON_TEXT[turn.reason];
  const gains = [...turn.players].sort((a, b) => b.gained - a.gained);
  return (
    <div className="animate-fade-up absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--card)]/92 p-3 backdrop-blur-sm sm:gap-3">
      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[var(--fg-muted)] sm:text-sm">
        <Icon size={15} /> {text}
      </p>
      <p className="text-xs font-bold text-[var(--fg-muted)] sm:text-xs">A palavra era</p>
      <div className="flex flex-wrap justify-center gap-0.5 sm:gap-1">
        {(turn.word ?? "?").split("").map((ch, i) => (
          <span
            key={i}
            className="draw-letter-flip flex h-8 min-w-6 items-center justify-center rounded-md bg-[var(--primary)] px-1 text-lg font-black uppercase text-white shadow-[0_3px_0_var(--primary-dark)] sm:h-11 sm:min-w-9 sm:text-2xl"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            {ch === " " ? " " : ch}
          </span>
        ))}
      </div>
      <div className="mt-1 flex w-full max-w-xs flex-col gap-1 overflow-y-auto">
        {gains.map((p, i) => (
          <div
            key={p.socketId}
            className={`animate-fade-up flex items-center justify-between rounded-lg px-3 py-1 text-xs font-bold sm:text-sm ${
              p.socketId === mySocketId ? "bg-[var(--primary-tint)]" : "bg-[var(--bg)]"
            }`}
            style={{ animationDelay: `${300 + i * 70}ms` }}
          >
            <span className="flex items-center gap-1 truncate text-[var(--fg)]">
              {p.socketId === turn.drawerSocketId && <Pencil size={12} className="text-[var(--primary)]" />}
              {p.name}
            </span>
            <span className={p.gained > 0 ? "text-[var(--draw-ok)]" : "text-[var(--fg-muted)]"}>
              {p.gained > 0 ? `+${p.gained}` : "0"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Tracinhos da palavra (mascara vem do servidor com espacos/hifens reais); letras "viram" quando a
 * palavra e revelada (desenhista ou quem acertou).
 */
function WordSlots({ word, mask }: { word: string | null; mask: string | null }) {
  const pattern = word ?? mask ?? "";
  const chars = pattern.split("").map((ch) => (word ? ch : ch === "_" ? "" : ch));
  return (
    <div className="flex max-w-full flex-wrap items-end justify-center gap-[3px] sm:gap-1">
      {chars.map((ch, i) =>
        ch === " " ? (
          <span key={i} className="w-2 sm:w-3" />
        ) : ch === "-" ? (
          <span key={i} className="pb-1 text-sm font-black text-[var(--fg-muted)] sm:text-xl">
            -
          </span>
        ) : (
          <span
            key={`${i}-${word ? "on" : "off"}`}
            className={`flex h-6 w-[1.05rem] items-end justify-center border-b-[3px] pb-0.5 text-sm font-black uppercase leading-none sm:h-8 sm:w-6 sm:text-xl ${
              word ? "draw-letter-flip border-[var(--primary)] text-[var(--fg)]" : "border-[var(--fg-muted)] text-transparent"
            }`}
            style={word ? { animationDelay: `${i * 40}ms` } : undefined}
          >
            {ch || " "}
          </span>
        )
      )}
    </div>
  );
}

export function GameScreen({
  room,
  mySocketId,
  feed,
  lastTurn,
  celebration,
  onStroke,
  onClear,
  onUndo,
  onSubmitGuess,
  registerCanvasHandlers,
}: GameScreenProps) {
  const isDrawer = room.currentDrawerSocketId === mySocketId;
  const drawerName = room.players.find((p) => p.socketId === room.currentDrawerSocketId)?.name ?? "";
  const me = room.players.find((p) => p.socketId === mySocketId);
  const isDrawing = room.phase === "drawing";

  const [msLeft, setMsLeft] = useState(0);
  useEffect(() => {
    if (!room.turnEndsAt) return;
    const update = () => setMsLeft(Math.max(0, room.turnEndsAt! - Date.now()));
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [room.turnEndsAt]);

  const secondsLeft = isDrawing ? Math.ceil(msLeft / 1000) : 0;
  const totalMs = room.config.turnSeconds * 1000;
  const ratio = isDrawing && totalMs > 0 ? msLeft / totalMs : 0;
  const isUrgent = isDrawing && secondsLeft <= 10 && secondsLeft > 0;

  // tique nos ultimos 10s (uma vez por segundo)
  const lastTickRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isUrgent || lastTickRef.current === secondsLeft) return;
    lastTickRef.current = secondsLeft;
    playDrawSfx("tick");
  }, [isUrgent, secondsLeft]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-1.5 sm:gap-3 sm:p-3 lg:flex-row lg:gap-4 lg:p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2">
        {/* barra de status: timer | palavra | rodada */}
        <div className="shrink-0 overflow-hidden rounded-xl border-2 border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
            <div
              className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full border-2 text-sm font-black tabular-nums sm:h-12 sm:w-12 sm:text-base ${
                isUrgent
                  ? "draw-timer-urgent border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]"
                  : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg)]"
              }`}
            >
              <Clock size={11} className="opacity-60" />
              {secondsLeft}
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <p className="flex max-w-full items-center gap-1 truncate text-xs font-bold text-[var(--fg-muted)] sm:text-xs">
                {isDrawer ? (
                  <>
                    <Pencil size={11} className="shrink-0 text-[var(--primary)]" />
                    <span className="text-[var(--primary)]">Sua vez de desenhar!</span>
                  </>
                ) : me?.hasGuessedThisTurn ? (
                  <span className="text-[var(--draw-ok)]">Você acertou!</span>
                ) : (
                  <span className="truncate">
                    <b className="text-[var(--fg)]">{drawerName}</b> esta desenhando
                  </span>
                )}
              </p>
              <div className="flex max-w-full items-end gap-1.5">
                <WordSlots word={room.currentWord} mask={room.currentWordMask} />
                {room.currentDifficulty && (
                  <span className="mb-1 shrink-0" title={DIFFICULTY_LABEL[room.currentDifficulty]}>
                    <DifficultyStars difficulty={room.currentDifficulty} size={10} />
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center rounded-lg bg-[var(--bg)] px-2 py-1 leading-tight">
              <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--fg-muted)] sm:text-[10px]">Rodada</span>
              <span className="text-xs font-black tabular-nums text-[var(--fg)] sm:text-sm">
                {room.round}/{room.config.roundsPerPlayer}
              </span>
            </div>
          </div>
          <div className="h-1 bg-[var(--bg)]">
            <div
              className="draw-time-bar h-full"
              style={{
                width: `${ratio * 100}%`,
                backgroundColor: isUrgent ? "var(--danger)" : ratio < 0.5 ? "#f59e0b" : "var(--primary)",
              }}
            />
          </div>
        </div>

        <Canvas
          canDraw={isDrawer && isDrawing}
          onStroke={onStroke}
          onClear={onClear}
          onUndo={onUndo}
          registerHandlers={registerCanvasHandlers}
        >
          {celebration && <CelebrationOverlay key={celebration.key} celebration={celebration} />}
          {room.phase === "turn-results" && lastTurn && <TurnResultsOverlay turn={lastTurn} mySocketId={mySocketId} />}
        </Canvas>
      </div>

      <GuessPanel
        isDrawer={isDrawer}
        canGuess={isDrawing}
        hasGuessed={me?.hasGuessedThisTurn ?? false}
        players={room.players}
        drawerSocketId={room.currentDrawerSocketId}
        mySocketId={mySocketId}
        feed={feed}
        onSubmitGuess={onSubmitGuess}
      />
    </div>
  );
}
