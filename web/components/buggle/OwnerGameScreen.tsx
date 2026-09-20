"use client";

import { Hourglass } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RoundCountdown } from "./RoundCountdown";
import type { PlayerPublic, RoomState } from "@/lib/buggle/types";

interface OwnerGameScreenProps {
  room: RoomState;
  secondsLeft: number;
  countdown: number | null;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function PlayerCard({ player, reverse }: { player: PlayerPublic; reverse?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 shadow-sm ${
        reverse ? "flex-row-reverse" : ""
      }`}
    >
      <Avatar
        emoji={player.avatar?.emoji}
        bgColor={player.avatar?.bgColor ?? colorFor(player.socketId)}
        imageUrl={player.avatar?.imageUrl}
        fallbackLetter={player.name.trim().charAt(0).toUpperCase()}
        size="lg"
        shape="square"
      />
      <div className={`flex min-w-0 flex-col leading-tight ${reverse ? "items-end text-right" : ""}`}>
        <span className="truncate text-base font-extrabold text-[var(--fg)]">{player.name}</span>
        <span className="text-sm font-semibold text-[var(--fg-muted)]">
          {player.wordsFound} {player.wordsFound === 1 ? "palavra" : "palavras"}
        </span>
      </div>
    </div>
  );
}

export function OwnerGameScreen({ room, secondsLeft, countdown }: OwnerGameScreenProps) {
  if (countdown !== null) {
    return <RoundCountdown countdown={countdown} />;
  }

  // so os 16 com mais palavras descobertas, pra caber sem scroll
  const topPlayers = [...room.players].sort((a, b) => b.wordsFound - a.wordsFound).slice(0, 16);
  const half = Math.ceil(topPlayers.length / 2);
  const left = topPlayers.slice(0, half);
  const right = topPlayers.slice(half);

  return (
    <div
      className="flex flex-1 flex-col items-center gap-3 overflow-hidden bg-[var(--bg)] p-3 sm:p-4"
      style={{ animation: "countdownFadeIn 0.6s ease-out" }}
    >
      <div className="flex items-center gap-2 rounded-full border-2 border-[var(--primary-dark)] bg-[var(--primary-dark)] px-4 py-1.5 font-mono text-lg font-extrabold text-white shadow-sm">
        <Hourglass size={16} />
        {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
      </div>

      <div className="flex w-full flex-1 justify-between gap-6 overflow-hidden px-4">
        <div className="grid w-72 shrink-0 grid-cols-1 gap-2.5 self-start pt-2 xl:w-80">
          {left.map((p) => (
            <PlayerCard key={p.socketId} player={p} />
          ))}
        </div>

        <div className="flex flex-1 justify-center self-start pt-2">
          {room.board && (
            <div
              className="grid w-full max-w-2xl gap-3 rounded-3xl bg-[var(--primary-tint)] p-4 shadow-[0_6px_0_var(--border)]"
              style={{ gridTemplateColumns: `repeat(${room.board.length}, minmax(0, 1fr))` }}
            >
              {room.board.map((row) =>
                row.map((cell) => (
                  <div
                    key={`${cell.row}-${cell.col}`}
                    className="flex aspect-square items-center justify-center rounded-xl bg-[var(--primary-dark)] font-extrabold uppercase text-white"
                    style={{ fontSize: `clamp(2.2rem, ${520 / room.board!.length}%, 7rem)` }}
                  >
                    {cell.letter}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="grid w-72 shrink-0 grid-cols-1 gap-2.5 self-start pt-2 xl:w-80">
          {right.map((p) => (
            <PlayerCard key={p.socketId} player={p} reverse />
          ))}
        </div>
      </div>
    </div>
  );
}
