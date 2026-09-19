"use client";

import { useState } from "react";
import { Hourglass, LogOut } from "lucide-react";
import { Board } from "./Board";
import type { BoggleBoard, WordResult } from "@/lib/buggle/types";

interface GamePlayScreenProps {
  board: BoggleBoard;
  secondsLeft: number;
  totalSeconds: number;
  lastResult: WordResult | null;
  onWordSubmit: (word: string) => void;
  onLeaveRoom?: () => void;
}

export function GamePlayScreen({
  board,
  secondsLeft,
  totalSeconds,
  lastResult,
  onWordSubmit,
  onLeaveRoom,
}: GamePlayScreenProps) {
  const [currentWord, setCurrentWord] = useState("");
  const isEnding = totalSeconds > 0 && secondsLeft <= totalSeconds * 0.15;

  return (
    <div
      className="relative flex flex-1 flex-col items-center gap-4 overflow-hidden bg-[var(--bg)] p-4 sm:p-6"
      style={
        isEnding
          ? {
              backgroundImage:
                "repeating-linear-gradient(45deg, color-mix(in srgb, var(--danger) 6%, transparent) 0 12px, transparent 12px 24px)",
            }
          : undefined
      }
    >
      <div className="relative z-10 flex w-full max-w-md items-start justify-between">
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-2 rounded-full border-2 px-4 py-1.5 font-mono text-lg font-extrabold shadow-sm transition-colors ${
              isEnding
                ? "border-[var(--danger-border)] bg-[var(--danger)] text-white"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--fg)]"
            }`}
          >
            <Hourglass size={16} />
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </div>
          {lastResult && !lastResult.accepted && (
            <span className="rounded-full border-2 border-[var(--danger-border)] bg-[var(--danger)] px-3 py-1 text-xs font-bold text-white shadow-sm">
              {lastResult.word} é inválida
            </span>
          )}
          {lastResult?.accepted && (
            <span className="rounded-full border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-3 py-1 text-xs font-bold text-white shadow-sm">
              +{lastResult.points}
              {lastResult.isSecret ? " secreta!" : ""}
            </span>
          )}
        </div>

        {onLeaveRoom && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 rounded-full border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-1.5 text-xs font-extrabold text-[var(--danger)] transition hover:opacity-80"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        )}
      </div>

      <div className="relative z-10 flex h-14 items-center justify-center">
        {currentWord && (
          <div className="flex items-center justify-center rounded-full border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-2 shadow-lg">
            <span className="font-mono text-xl font-extrabold tracking-widest text-white">
              {currentWord}
            </span>
          </div>
        )}
      </div>

      <div className="relative z-10 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_8px_0_var(--border)] sm:p-5">
        <Board board={board} onWordSubmit={onWordSubmit} onPathChange={setCurrentWord} />
      </div>
    </div>
  );
}
