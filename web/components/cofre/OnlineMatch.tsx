"use client";

import { Hourglass, LogOut } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { CofreRoomState } from "@/lib/cofre/types";
import { Board, type BoardCell } from "./Board";

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
  if (!board) return null;
  const myTurn = room.turnSocketId === mySocketId;
  const turnSeat = room.seats.find((s) => s.socketId === room.turnSocketId);
  const locked = now < room.lockedUntil;
  const canFlip = room.phase === "playing" && myTurn && !locked && board.flipped.length < 2 && !pendingFlip;
  const msLeft = room.phaseEndsAt ? Math.max(0, room.phaseEndsAt - Math.max(now, room.lockedUntil)) : null;
  const totalMs = room.config.turnSeconds * 1000;
  const ending = msLeft !== null && msLeft <= 3000 && room.phase === "playing";

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
          <span
            className={`flex min-w-[64px] items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-black tabular-nums ${
              ending ? "bg-[var(--danger)] text-white" : "bg-[var(--bg)] text-[var(--fg)]"
            }`}
          >
            <Hourglass className="h-3.5 w-3.5" />
            {msLeft === null ? "—" : `${Math.ceil(msLeft / 1000)}s`}
          </span>
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
          return (
            <div
              key={s.socketId}
              className={`flex items-center gap-2 rounded-2xl border-2 py-1 pl-1 pr-3 transition ${
                turn ? "border-[var(--game-accent)] bg-[var(--card)] shadow-md" : "border-transparent bg-[var(--card)]"
              } ${s.left ? "opacity-40" : ""}`}
            >
              <Avatar size="sm" emoji={s.avatar?.emoji} bgColor={s.avatar?.bgColor} imageUrl={s.avatar?.imageUrl} fallbackLetter={s.name.charAt(0).toUpperCase()} />
              <span className="max-w-[7rem] truncate text-sm font-bold text-[var(--fg)]">
                {s.name}
                {s.socketId === mySocketId && <span className="text-[var(--fg-muted)]"> (você)</span>}
              </span>
              <span className="text-sm font-black tabular-nums text-[var(--game-accent)]">{s.points}</span>
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
