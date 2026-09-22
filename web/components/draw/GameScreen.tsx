"use client";

import { useEffect, useState } from "react";
import { Hourglass, Pencil } from "lucide-react";
import { Canvas } from "./Canvas";
import { GuessPanel } from "./GuessPanel";
import type { DrawRoomState } from "@/lib/draw/types";

interface FeedItem {
  id: string;
  kind: "correct" | "own-correct" | "wrong";
  text: string;
}

interface CanvasHandlers {
  applyRemoteStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
  applyUndo: (strokeId: string) => void;
  applyClear: () => void;
}

interface GameScreenProps {
  room: DrawRoomState;
  mySocketId: string;
  feed: FeedItem[];
  onStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
  onClear: () => void;
  onUndo: () => void;
  onSubmitGuess: (guess: string) => void;
  registerCanvasHandlers: (handlers: CanvasHandlers) => void;
}

export function GameScreen({
  room,
  mySocketId,
  feed,
  onStroke,
  onClear,
  onUndo,
  onSubmitGuess,
  registerCanvasHandlers,
}: GameScreenProps) {
  const isDrawer = room.currentDrawerSocketId === mySocketId;
  const drawerName = room.players.find((p) => p.socketId === room.currentDrawerSocketId)?.name ?? "";
  const me = room.players.find((p) => p.socketId === mySocketId);

  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (!room.turnEndsAt) return;
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((room.turnEndsAt! - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(interval);
  }, [room.turnEndsAt]);

  const totalSeconds = room.config.turnSeconds;
  const isEnding = room.turnEndsAt !== null && secondsLeft <= totalSeconds * 0.15;

  const wordDisplay = isDrawer
    ? room.currentWord ?? ""
    : Array.from({ length: room.currentWordLength ?? 0 })
        .map(() => "_")
        .join(" ");

  return (
    <div className="flex flex-1 flex-col gap-2 p-2 sm:gap-4 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm ${
            isEnding ? "animate-pulse bg-[var(--danger-bg)] text-[var(--danger)]" : "bg-[var(--card)] text-[var(--fg)]"
          } border-2 border-[var(--border)]`}
        >
          <Hourglass size={13} />
          {secondsLeft}s
        </div>

        <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--fg)] sm:text-sm">
          {isDrawer ? (
            <>
              <Pencil size={13} className="text-[var(--primary)]" />
              Sua vez de desenhar!
            </>
          ) : (
            <span className="max-w-[40vw] truncate sm:max-w-none">{drawerName} esta desenhando</span>
          )}
        </p>

        <p className="rounded-full border-2 border-[var(--border)] bg-[var(--card)] px-2.5 py-1 font-mono text-sm font-extrabold uppercase tracking-[0.2em] text-[var(--fg)] sm:px-3 sm:py-1.5 sm:text-lg sm:tracking-[0.3em]">
          {wordDisplay}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden sm:gap-4 lg:flex-row">
        <div className="flex h-[52vh] shrink-0 sm:h-[58vh] lg:h-auto lg:flex-1">
          <Canvas
            isDrawer={isDrawer}
            onStroke={onStroke}
            onClear={onClear}
            onUndo={onUndo}
            registerHandlers={registerCanvasHandlers}
          />
        </div>
        <GuessPanel
          isDrawer={isDrawer}
          hasGuessed={me?.hasGuessedThisTurn ?? false}
          players={room.players}
          mySocketId={mySocketId}
          feed={feed}
          onSubmitGuess={onSubmitGuess}
        />
      </div>
    </div>
  );
}
