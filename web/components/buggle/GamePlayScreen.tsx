"use client";

import { useState } from "react";
import { Hourglass, LogOut } from "lucide-react";
import { Board } from "./Board";
import { SoundToggle } from "./SoundToggle";
import type { BoggleBoard, BoggleCell, WordResult } from "@/lib/buggle/types";

interface GamePlayScreenProps {
  board: BoggleBoard;
  secondsLeft: number;
  totalSeconds: number;
  lastResult: WordResult | null;
  onWordSubmit: (word: string, path: BoggleCell[]) => void;
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
    <div className="relative flex flex-1 touch-none flex-col items-center gap-4 overflow-hidden bg-[var(--bg)] p-4 sm:p-6">
      {isEnding && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--primary) 0 20px, transparent 20px 48px)",
            animation: "dangerPulse 1.2s ease-in-out infinite",
          }}
        />
      )}
      <div className="relative z-10 flex w-full max-w-2xl items-start justify-between">
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-2 rounded-full border-2 px-4 py-1.5 font-mono text-lg font-extrabold text-white shadow-sm transition-colors ${
              isEnding
                ? "border-[var(--danger-border)] bg-[var(--danger)]"
                : "border-[var(--primary-dark)] bg-[var(--primary-dark)]"
            }`}
          >
            <Hourglass size={16} />
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </div>
          {lastResult && !lastResult.accepted && lastResult.alreadyFound && (
            <span className="rounded-full border-2 border-[#ca8a04] bg-[#facc15] px-3 py-1 text-xs font-bold text-[var(--stage-3)] shadow-sm">
              {lastResult.word} já encontrada
            </span>
          )}
          {lastResult && !lastResult.accepted && !lastResult.alreadyFound && (
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

        <div className="flex items-center gap-2">
          <SoundToggle />
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
      </div>

      <div className="relative z-10 flex h-14 items-center justify-center">
        {currentWord && (
          <div className="flex items-center justify-center rounded-full border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-2 shadow-lg">
            <span className="flex font-mono text-xl font-extrabold tracking-widest text-white">
              {currentWord.split("").map((letter, i) => {
                const isNewest = i === currentWord.length - 1;
                // quanto mais letras na palavra, mais brusca a animacao da letra nova
                const intensity = Math.min(currentWord.length, 10);
                const scale = 1.2 + intensity * 0.05; // 1.25 -> 1.7
                const rot = 4 + intensity * 2; // 6deg -> 24deg
                const duration = Math.max(0.18, 0.35 - intensity * 0.015); // mais rapida tambem

                return (
                  <span
                    key={i}
                    className="inline-block"
                    style={
                      isNewest
                        ? ({
                            animation: `letterPop ${duration}s ease-out`,
                            "--pop-scale": scale,
                            "--pop-rot": `${rot}deg`,
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {letter}
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>

      <Board board={board} onWordSubmit={onWordSubmit} onPathChange={setCurrentWord} lastResult={lastResult} />
    </div>
  );
}
