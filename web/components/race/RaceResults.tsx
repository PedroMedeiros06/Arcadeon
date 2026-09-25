"use client";

import { Crown, LogOut, RotateCcw, Target, Timer } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { RaceRoomState } from "@/lib/race/types";

interface RaceResultsProps {
  room: RaceRoomState;
  mySocketId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}

const PODIUM = [
  { place: 2, height: "h-16 sm:h-20", medal: "🥈" },
  { place: 1, height: "h-24 sm:h-28", medal: "🥇" },
  { place: 3, height: "h-11 sm:h-14", medal: "🥉" },
];

function formatSeconds(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}

const TITLES = {
  finished: "🏁 CHEGADA!",
  limit: "🏁 Fim da corrida",
  "players-left": "🏁 Fim da corrida",
} as const;

/** Tela final como chegada de corrida: podio com metros, lista curta (acertos, 🔥 maxima, tempo medio). */
export function RaceResults({ room, mySocketId, onPlayAgain, onLeave }: RaceResultsProps) {
  const ranked = [...room.players].sort((a, b) => a.rank - b.rank);
  const isHost = room.hostSocketId === mySocketId;
  const meters = (d: number) => Math.min(d, room.finishProgress);

  return (
    <div className="race-motion flex flex-1 flex-col items-center gap-5 overflow-y-auto bg-[var(--bg)] px-4 py-6 sm:py-10">
      <h2 className="text-3xl font-black italic tracking-tight text-[var(--fg)] sm:text-4xl" style={{ animation: "popIn 0.5s ease-out" }}>
        {TITLES[room.endReason ?? "finished"]}
      </h2>
      {room.endReason === "players-left" && (
        <p className="-mt-3 text-sm font-semibold text-[var(--fg-muted)]">Os outros pilotos saíram da corrida.</p>
      )}

      {/* podio */}
      <div className="flex w-full max-w-md items-end justify-center gap-2 sm:gap-3">
        {PODIUM.map(({ place, height, medal }) => {
          const p = ranked[place - 1];
          if (!p) return <div key={place} className="flex-1" />;
          const winner = p.socketId === room.winnerSocketId;
          return (
            <div key={place} className="animate-fade-up flex min-w-0 flex-1 flex-col items-center gap-1" style={{ animationDelay: `${place * 150}ms` }}>
              {winner && <Crown className="h-5 w-5 fill-yellow-400 text-yellow-400" />}
              <div className="flex items-center">
                <span className={`-scale-x-100 leading-none ${place === 1 ? "text-3xl" : "text-2xl"}`}>🏎️</span>
                <span className="-ml-2">
                  <Avatar
                    emoji={p.avatar?.emoji}
                    bgColor={p.avatar?.bgColor}
                    imageUrl={p.avatar?.imageUrl}
                    fallbackLetter={p.name.charAt(0).toUpperCase()}
                    size={place === 1 ? "md" : "sm"}
                  />
                </span>
              </div>
              <span className="max-w-full truncate text-sm font-extrabold uppercase text-[var(--fg)]">{p.name}</span>
              <span className="text-xs font-black text-[var(--primary)]">{meters(p.distance)}m</span>
              <div
                className={`podium-bar flex w-full origin-bottom items-start justify-center rounded-t-xl bg-linear-to-t from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)] pt-1.5 text-2xl ${height}`}
                style={{ animationDelay: `${place * 150}ms` }}
              >
                {medal}
              </div>
            </div>
          );
        })}
      </div>

      {/* chegada de todos: barra de progresso + o essencial */}
      <div className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--card)]">
        {ranked.map((p, i) => {
          const pct = (meters(p.distance) / room.finishProgress) * 100;
          return (
            <div
              key={p.socketId}
              className={`animate-fade-up flex flex-col gap-1 border-b border-[var(--border)] px-3 py-2 last:border-b-0 ${
                p.socketId === mySocketId ? "bg-[var(--primary-tint)]" : ""
              }`}
              style={{ animationDelay: `${450 + i * 60}ms` }}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="w-7 shrink-0 font-black text-[var(--fg-muted)]">{p.rank}º</span>
                <span className="min-w-0 flex-1 truncate font-bold text-[var(--fg)]">{p.name}</span>
                <span className="flex items-center gap-0.5 text-xs font-bold text-[var(--fg)]" title="Acertos">
                  <Target size={12} className="text-[var(--fg-muted)]" />
                  {p.correctCount}
                </span>
                <span className="w-9 text-right text-xs font-bold text-orange-500" title="Maior sequência">
                  🔥{p.maxStreak}
                </span>
                <span className="flex w-12 items-center justify-end gap-0.5 text-xs font-semibold text-[var(--fg-muted)]" title="Tempo médio">
                  <Timer size={12} />
                  {formatSeconds(p.avgResponseMs)}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-9">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-[var(--primary-dark)] to-[var(--primary-2)]"
                    style={{ width: `${pct}%`, transition: "width 900ms cubic-bezier(0.2,0.8,0.2,1)" }}
                  />
                </div>
                <span className="w-12 text-right text-xs font-black tabular-nums text-[var(--fg-muted)]">{meters(p.distance)}m</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        {isHost ? (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPlayAgain}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-3 font-extrabold text-white transition hover:-translate-y-0.5 active:scale-95"
          >
            <RotateCcw size={16} /> Nova corrida
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
