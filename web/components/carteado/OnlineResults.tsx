"use client";

import { Crown, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { CarteadoRoomState } from "@/lib/carteado/types";
import { Cartela } from "./Cartela";

export function OnlineResults({
  room,
  mySocketId,
  onPlayAgain,
  onLeave,
}: {
  room: CarteadoRoomState;
  mySocketId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}) {
  const isHost = room.hostSocketId === mySocketId;
  const iWon = room.winnerSocketId === mySocketId;
  const winner = room.seats.find((s) => s.socketId === room.winnerSocketId);
  const ordered = [...room.seats].sort((a, b) => (a.socketId === room.winnerSocketId ? -1 : b.socketId === room.winnerSocketId ? 1 : 0));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <div className="text-center">
        <p className="text-5xl">{iWon ? "🏆" : "🃏"}</p>
        <p className="mt-2 text-sm font-bold text-[var(--game-accent)]">{room.endReason === "players-left" ? "O adversário saiu" : `${room.table?.flips ?? 0} cartas viradas`}</p>
        <h2 className="mt-1 text-2xl font-black text-[var(--fg)]">{iWon ? "Cartela completa! Você venceu" : `${winner?.name ?? "Ninguém"} completou primeiro`}</h2>
      </div>

      <div className="flex flex-col gap-2">
        {ordered.map((s, i) => (
          <div
            key={s.socketId}
            className={`animate-fade-up flex items-center gap-3 rounded-2xl border-2 bg-[var(--card)] p-3 ${s.socketId === mySocketId ? "border-[var(--game-accent)]" : "border-[var(--border)]"} ${
              s.left ? "opacity-50" : ""
            }`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Avatar emoji={s.avatar?.emoji} bgColor={s.avatar?.bgColor} imageUrl={s.avatar?.imageUrl} fallbackLetter={s.name.charAt(0).toUpperCase()} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate font-black text-[var(--fg)]">
                {s.name}
                {s.socketId === room.winnerSocketId && <Crown className="h-4 w-4 fill-yellow-400 text-yellow-500" />}
              </p>
              <p className="text-xs font-semibold text-[var(--fg-muted)]">{s.left ? "saiu da partida" : `${s.cells.filter(Boolean).length}/9 números`}</p>
            </div>
            <Cartela cells={s.cells} fresh={null} size="sm" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {isHost ? (
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--game-accent)] py-3 font-black text-white transition hover:brightness-110"
          >
            <RotateCcw className="h-4 w-4" /> Revanche
          </button>
        ) : (
          <p className="text-center text-sm font-semibold text-[var(--fg-muted)]">Esperando o anfitrião chamar a revanche...</p>
        )}
        <button type="button" onClick={onLeave} className="rounded-2xl border-2 border-[var(--border)] py-3 font-bold text-[var(--fg-muted)] hover:bg-[var(--card)]">
          Sair da sala
        </button>
      </div>
    </div>
  );
}
