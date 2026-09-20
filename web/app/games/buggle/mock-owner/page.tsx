"use client";

import { useEffect, useMemo, useState } from "react";
import { OwnerGameScreen } from "@/components/buggle/OwnerGameScreen";
import type { BoggleBoard, PlayerPublic, RoomState } from "@/lib/buggle/types";

const LETTERS = "AAAAEEEEIIOOUUBCDDFGHLMNNPQRRSSTTVZ";
const NAMES = [
  "Ana", "Bruno", "Carla", "Davi", "Elis", "Felipe", "Gabi", "Hugo",
  "Iris", "Joao", "Kate", "Leo", "Mari", "Nico", "Olga", "Pedro",
  "Rui", "Sara", "Tom", "Uma", "Vini", "Wesley", "Xico", "Yara",
];
const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const EMOJIS = [null, "🐔", "🐶", "🐱", "🐸", "🦊", "🐼", "🦁"];

function randomBoard(size: number): BoggleBoard {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      letter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
    }))
  );
}

function makePlayers(count: number): PlayerPublic[] {
  return Array.from({ length: count }, (_, i) => ({
    socketId: `mock-${i}`,
    name: NAMES[i % NAMES.length],
    score: Math.floor(Math.random() * 400),
    wordsFound: Math.floor(Math.random() * 20),
    avatar: {
      emoji: EMOJIS[i % EMOJIS.length],
      bgColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      imageUrl: null,
    },
  }));
}

export default function BuggleMockOwnerPage() {
  const [playerCount, setPlayerCount] = useState(4);
  const [board] = useState<BoggleBoard>(() => randomBoard(4));
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [countdown, setCountdown] = useState<number | null>(null);

  const players = useMemo(() => makePlayers(playerCount), [playerCount]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const t = setTimeout(() => setCountdown(null), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 800);
    return () => clearTimeout(t);
  }, [countdown]);

  const room: RoomState = {
    code: "MOCK1",
    ownerSocketId: "owner",
    hostSocketId: players[0]?.socketId ?? null,
    config: { boardSize: 4, roundSeconds: 180, minWordLength: 3, visibility: "public", maxPlayers: 24 },
    phase: "playing",
    board,
    roundEndsAt: null,
    players,
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b-2 border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">
          Mock TV (dev only) —
        </span>
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--fg-muted)]">
          Players: {playerCount}
        </label>
        <input
          type="range"
          min={0}
          max={24}
          value={playerCount}
          onChange={(e) => setPlayerCount(Number(e.target.value))}
          className="w-40"
        />
        <button
          onClick={() => setPlayerCount((c) => Math.max(0, c - 1))}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-bold text-[var(--fg-muted)] transition hover:bg-[var(--card)]"
        >
          -1
        </button>
        <button
          onClick={() => setPlayerCount((c) => Math.min(24, c + 1))}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-bold text-[var(--fg-muted)] transition hover:bg-[var(--card)]"
        >
          +1
        </button>
        <button
          onClick={() => setCountdown(3)}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-bold text-[var(--fg-muted)] transition hover:bg-[var(--card)]"
        >
          Testar countdown 3-2-1
        </button>
        <button
          onClick={() => setSecondsLeft((s) => Math.max(0, s - 10))}
          className="rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-xs font-bold text-[var(--fg-muted)] transition hover:bg-[var(--card)]"
        >
          -10s
        </button>
      </div>

      <OwnerGameScreen room={room} secondsLeft={secondsLeft} countdown={countdown} />
    </div>
  );
}
