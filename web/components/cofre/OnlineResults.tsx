"use client";

import { Crown, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { CofreRoomState } from "@/lib/cofre/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export function OnlineResults({
  room,
  mySocketId,
  onPlayAgain,
  onLeave,
}: {
  room: CofreRoomState;
  mySocketId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}) {
  const isHost = room.hostSocketId === mySocketId;
  const ranked = [...room.seats].sort((a, b) => (a.left ? 99 : a.place) - (b.left ? 99 : b.place));
  const winners = ranked.filter((s) => s.place === 1);
  const me = room.seats.find((s) => s.socketId === mySocketId);
  const iWon = me?.place === 1;

  let headline: string;
  if (winners.length > 1) headline = "Empate! O espólio foi dividido";
  else if (iWon) headline = "Você levou o maior espólio!";
  else headline = `${winners[0]?.name ?? "Ninguém"} levou o maior espólio`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <div className="text-center">
        <p className="text-sm font-bold text-[var(--game-accent)]">{room.endReason === "players-left" ? "A equipe se desfez" : "Cofre limpo!"}</p>
        <h2 className="mt-1 text-2xl font-black text-[var(--fg)]">{headline}</h2>
      </div>

      <ol className="flex flex-col gap-2">
        {ranked.map((s, i) => (
          <li
            key={s.socketId}
            className={`animate-fade-up flex items-center gap-3 rounded-2xl border-2 bg-[var(--card)] p-3 ${
              s.socketId === mySocketId ? "border-[var(--game-accent)]" : "border-[var(--border)]"
            } ${s.left ? "opacity-50" : ""}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="w-8 text-center text-xl font-black text-[var(--fg-muted)]">{s.left ? "—" : (MEDALS[s.place - 1] ?? `${s.place}º`)}</span>
            <Avatar emoji={s.avatar?.emoji} bgColor={s.avatar?.bgColor} imageUrl={s.avatar?.imageUrl} fallbackLetter={s.name.charAt(0).toUpperCase()} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 truncate font-black text-[var(--fg)]">
                {s.name}
                {s.place === 1 && <Crown className="h-4 w-4 fill-yellow-400 text-yellow-500" />}
              </span>
              <span className="text-xs font-semibold text-[var(--fg-muted)]">
                {s.left ? "saiu da partida" : `${s.pairs} ${s.pairs === 1 ? "par" : "pares"} · ${s.misses} ${s.misses === 1 ? "erro" : "erros"}`}
              </span>
            </span>
            <span className="text-2xl font-black tabular-nums text-[var(--game-accent)]">{s.points}</span>
          </li>
        ))}
      </ol>
      <p className="text-center text-xs text-[var(--fg-muted)]">Par vale 1 ponto, Coringa vale 3. Empate: mais pares, depois menos erros.</p>

      <div className="flex flex-col gap-2">
        {isHost ? (
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--game-accent)] py-3 font-black text-white transition hover:brightness-110"
          >
            <RotateCcw className="h-4 w-4" /> Jogar de novo
          </button>
        ) : (
          <p className="text-center text-sm font-semibold text-[var(--fg-muted)]">Esperando o anfitrião chamar a revanche...</p>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="rounded-2xl border-2 border-[var(--border)] py-3 font-bold text-[var(--fg-muted)] hover:bg-[var(--card)]"
        >
          Sair da sala
        </button>
      </div>
    </div>
  );
}
