"use client";

import { useEffect } from "react";
import { Hourglass, LogOut } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { playSfx } from "@/lib/cofre/sound";
import type { CofreRoomState } from "@/lib/cofre/types";
import { Board, type BoardCell } from "./Board";
import { SoundToggle } from "./SoundToggle";

export function OnlineMatch({
  room,
  mySocketId,
  now,
  peekFaces,
  swap,
  toast,
  pendingFlip,
  onFlip,
  onLeave,
}: {
  room: CofreRoomState;
  mySocketId: string;
  /** relogio do servidor estimado */
  now: number;
  /** espiada inicial: faces de todas as cartas ate o prazo acabar */
  peekFaces: string[] | null;
  swap: { a: number; b: number; key: number } | null;
  toast: { text: string; tone: "good" | "bad" | "gold"; seq: number } | null;
  pendingFlip: boolean;
  onFlip: (index: number) => void;
  onLeave: () => void;
}) {
  const board = room.board;
  const myTurn = room.turnSocketId === mySocketId;
  const turnSeat = room.seats.find((s) => s.socketId === room.turnSocketId);
  const locked = now < room.lockedUntil;
  const canFlip = room.phase === "playing" && myTurn && !locked && (board?.flipped.length ?? 2) < 2 && !pendingFlip;
  const msLeft = room.phaseEndsAt ? Math.max(0, room.phaseEndsAt - Math.max(now, room.lockedUntil)) : null;
  const totalMs = room.config.turnSeconds * 1000;
  const ending = msLeft !== null && msLeft <= 3000 && room.phase === "playing";
  const secondsLeft = msLeft === null ? null : Math.ceil(msLeft / 1000);
  const tickSecond = ending && myTurn && secondsLeft !== null && secondsLeft > 0 ? secondsLeft : null;

  // tique-taque nos 3 ultimos segundos da minha vez
  useEffect(() => {
    if (tickSecond !== null) playSfx("tick");
  }, [tickSecond]);

  if (!board) return null;

  const cells: BoardCell[] = board.cells.map((c, i) =>
    peekFaces && c.state === "hidden" ? { face: peekFaces[i] ?? null, state: "up" } : { face: c.face, state: c.state }
  );

  let status: string;
  if (room.phase === "peek") status = "Decore o que puder!";
  else if (myTurn) status = "Sua vez!";
  else if (turnSeat) status = `Vez de ${turnSeat.name}`;
  else status = "Cofre aberto!";

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="sticky top-0 z-30 border-b-2 border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLeave}
            aria-label="Sair da partida"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] transition hover:opacity-80"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <span
            key={`${room.turnSocketId}-${room.phase}`}
            className={`animate-fade-up truncate text-base font-black ${myTurn ? "text-[var(--game-accent)]" : "text-[var(--fg)]"}`}
          >
            {status}
          </span>
          <div className="flex items-center gap-2">
          <SoundToggle />
          <span
            className={`flex min-w-[64px] items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-black tabular-nums ${
              ending ? "bg-[var(--danger)] text-white" : "bg-[var(--bg)] text-[var(--fg)]"
            }`}
          >
            <Hourglass className="h-3.5 w-3.5" />
            {secondsLeft === null ? "—" : `${secondsLeft}s`}
          </span>
          </div>
        </div>
        {msLeft !== null && totalMs > 0 && room.phase === "playing" && (
          <div className="h-1 w-full bg-[var(--border)]">
            <div
              className="h-full transition-[width] duration-200 ease-linear"
              style={{ width: `${Math.min(1, msLeft / totalMs) * 100}%`, backgroundColor: ending ? "var(--danger)" : "var(--game-accent)" }}
            />
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-wrap justify-center gap-2 px-3 pt-3">
        {room.seats.map((s) => {
          const turn = s.socketId === room.turnSocketId;
          const me = s.socketId === mySocketId;
          return (
            <div
              key={s.socketId}
              className={`relative flex items-center gap-2 rounded-2xl border-2 bg-[var(--card)] py-1.5 pl-1.5 pr-3 transition-all duration-300 ${
                turn ? "-translate-y-0.5 border-[var(--game-accent)] shadow-[0_6px_18px_-6px_var(--game-accent)]" : "border-[var(--border)]"
              } ${s.left ? "opacity-40 grayscale" : ""}`}
            >
              <span className={`relative rounded-full ${turn ? "ring-2 ring-[var(--game-accent)] ring-offset-2 ring-offset-[var(--card)]" : ""}`}>
                <Avatar emoji={s.avatar?.emoji} bgColor={s.avatar?.bgColor} imageUrl={s.avatar?.imageUrl} fallbackLetter={s.name.charAt(0).toUpperCase()} />
                {turn && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--game-accent)] opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-[var(--card)] bg-[var(--game-accent)]" />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="max-w-[6.5rem] truncate text-sm font-extrabold text-[var(--fg)]">
                  {me ? "Você" : s.name}
                </span>
                <span className="text-[11px] font-semibold text-[var(--fg-muted)]">
                  {s.left ? "saiu" : `${s.pairs} ${s.pairs === 1 ? "par" : "pares"}`}
                </span>
              </span>
              <span className="ml-1 text-xl font-black tabular-nums text-[var(--game-accent)]">{s.points}</span>
            </div>
          );
        })}
      </div>

      <div className="relative flex flex-1 flex-col px-3 py-3 sm:px-6">
        <Board cols={board.cols} cells={cells} disabled={!canFlip} swap={swap} onFlip={onFlip} />
        {toast && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center">
            <span
              key={toast.seq}
              className={`rounded-full px-4 py-2 text-base font-black shadow-lg ${
                toast.tone === "gold"
                  ? "bg-gradient-to-r from-[#e0409b] to-[#f2c14e] text-white"
                  : toast.tone === "good"
                    ? "bg-[var(--game-accent)] text-white"
                    : "bg-[var(--card)] text-[var(--fg)]"
              }`}
              style={{ animation: "popIn 0.35s ease-out" }}
            >
              {toast.text}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
