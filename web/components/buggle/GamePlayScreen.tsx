"use client";

import { useState } from "react";
import { Hourglass } from "lucide-react";
import { Board } from "./Board";
import type { BoggleBoard, PlayerPublic, WordResult } from "@/lib/buggle/types";

interface GamePlayScreenProps {
  board: BoggleBoard;
  players: PlayerPublic[];
  secondsLeft: number;
  totalSeconds: number;
  lastResult: WordResult | null;
  onWordSubmit: (word: string) => void;
}

export function GamePlayScreen({
  board,
  players,
  secondsLeft,
  totalSeconds,
  lastResult,
  onWordSubmit,
}: GamePlayScreenProps) {
  const [currentWord, setCurrentWord] = useState("");
  const isEnding = totalSeconds > 0 && secondsLeft <= totalSeconds * 0.15;

  return (
    <div
      className="relative flex flex-1 flex-col items-center gap-4 overflow-hidden bg-[#5a2fc2] p-4"
      style={
        isEnding
          ? {
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 12px, transparent 12px 24px)",
            }
          : undefined
      }
    >
      <div className="relative z-10 flex w-full max-w-md items-start justify-between">
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-lg font-extrabold text-white shadow-lg transition-colors ${
              isEnding ? "bg-[#ef4444]" : "bg-black/25 backdrop-blur"
            }`}
          >
            <Hourglass size={16} />
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </div>
          {lastResult && !lastResult.accepted && (
            <span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-[#5a2fc2] shadow">
              {lastResult.word} e invalida
            </span>
          )}
          {lastResult?.accepted && (
            <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-emerald-950 shadow">
              +{lastResult.points}
              {lastResult.isSecret ? " secreta!" : ""}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 rounded-2xl bg-black/25 px-3 py-2 backdrop-blur">
          {players.map((p) => (
            <span key={p.socketId} className="text-xs font-bold text-white">
              {p.name}: {p.score}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex h-14 items-center justify-center">
        {currentWord && (
          <div className="flex items-center justify-center rounded-full bg-white px-6 py-2 shadow-xl">
            <span className="font-mono text-xl font-extrabold tracking-widest text-[#3b1f9e]">
              {currentWord}
            </span>
          </div>
        )}
      </div>

      <div className="relative z-10">
        <Board board={board} onWordSubmit={onWordSubmit} onPathChange={setCurrentWord} />
      </div>
    </div>
  );
}
