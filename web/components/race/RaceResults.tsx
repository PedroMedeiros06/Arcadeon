"use client";

import { Crown, LogOut, RotateCcw, Target, Timer, Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { RaceRoomState } from "@/lib/race/types";

interface RaceResultsProps {
  room: RaceRoomState;
  mySocketId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}

const PODIUM = [
  { place: 2, height: "h-20 sm:h-24", medal: "🥈" },
  { place: 1, height: "h-28 sm:h-32", medal: "🥇" },
  { place: 3, height: "h-14 sm:h-16", medal: "🥉" },
];

function formatSeconds(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}

export function RaceResults({ room, mySocketId, onPlayAgain, onLeave }: RaceResultsProps) {
  const ranked = [...room.players].sort((a, b) => a.rank - b.rank);
  const isHost = room.hostSocketId === mySocketId;
  const total = room.totalQuestions;

  return (
    <div className="flex flex-1 flex-col items-center gap-5 overflow-y-auto bg-[var(--bg)] px-4 py-6 sm:py-10">
      <div className="flex items-center gap-2 text-2xl font-black text-[var(--fg)] sm:text-3xl">
        <Trophy className="h-7 w-7 text-[var(--primary)]" />
        Resultado
      </div>
      {room.endReason === "players-left" && (
        <p className="text-sm font-semibold text-[var(--fg-muted)]">A corrida terminou porque os outros pilotos saíram.</p>
      )}

      {/* podio */}
      <div className="flex w-full max-w-md items-end justify-center gap-2 sm:gap-3">
        {PODIUM.map(({ place, height, medal }) => {
          const p = ranked[place - 1];
          if (!p) return <div key={place} className="flex-1" />;
          return (
            <div key={place} className="animate-fade-up flex flex-1 flex-col items-center gap-1.5" style={{ animationDelay: `${place * 120}ms` }}>
              {place === 1 && <Crown className="h-5 w-5 fill-yellow-400 text-yellow-400" />}
              <Avatar
                emoji={p.avatar?.emoji}
                bgColor={p.avatar?.bgColor}
                imageUrl={p.avatar?.imageUrl}
                fallbackLetter={p.name.charAt(0).toUpperCase()}
                size={place === 1 ? "lg" : "md"}
              />
              <span className="max-w-full truncate text-sm font-extrabold text-[var(--fg)]">{p.name}</span>
              <span className="text-xs font-bold text-[var(--fg-muted)]">{p.points} pts</span>
              <div
                className={`podium-bar flex w-full origin-bottom items-start justify-center rounded-t-xl bg-linear-to-t from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)] pt-2 text-2xl ${height}`}
                style={{ animationDelay: `${place * 120}ms` }}
              >
                {medal}
              </div>
            </div>
          );
        })}
      </div>

      {/* tabela */}
      <div className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--card)]">
        <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem] items-center gap-1 border-b-2 border-[var(--border)] px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
          <span>#</span>
          <span>Piloto</span>
          <span className="flex items-center justify-end gap-0.5"><Target size={11} />Acertos</span>
          <span className="text-right">Pontos</span>
          <span className="flex items-center justify-end gap-0.5"><Timer size={11} />Média</span>
        </div>
        {ranked.map((p, i) => (
          <div
            key={p.socketId}
            className={`animate-fade-up grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem] items-center gap-1 px-3 py-2 text-sm ${
              p.socketId === mySocketId ? "bg-[var(--primary-tint)]" : ""
            }`}
            style={{ animationDelay: `${400 + i * 50}ms` }}
          >
            <span className="font-black text-[var(--fg-muted)]">{p.rank}º</span>
            <span className="flex min-w-0 items-center gap-2">
              <Avatar
                emoji={p.avatar?.emoji}
                bgColor={p.avatar?.bgColor}
                imageUrl={p.avatar?.imageUrl}
                fallbackLetter={p.name.charAt(0).toUpperCase()}
                size="sm"
              />
              <span className="truncate font-bold text-[var(--fg)]">{p.name}</span>
            </span>
            <span className="text-right font-bold text-[var(--fg)]">
              {p.correctCount}/{total}
            </span>
            <span className="text-right font-bold text-[var(--fg)]">{p.points}</span>
            <span className="text-right font-semibold text-[var(--fg-muted)]">{formatSeconds(p.avgResponseMs)}</span>
          </div>
        ))}
      </div>

      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        {isHost ? (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPlayAgain}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-3 font-extrabold text-white transition hover:-translate-y-0.5 active:scale-95"
          >
            <RotateCcw size={16} /> Jogar de novo
          </button>
        ) : (
          <p className="flex flex-1 items-center justify-center text-sm font-semibold text-[var(--fg-muted)]">
            Aguardando o anfitrião...
          </p>
        )}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onLeave}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] py-3 font-extrabold text-[var(--danger)] transition hover:opacity-80 active:scale-95"
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );
}
