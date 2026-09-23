"use client";

import { Avatar } from "@/components/Avatar";
import type { RacePlayerPublic, RevealEntry } from "@/lib/race/types";

interface RaceTrackProps {
  players: RacePlayerPublic[];
  finishLine: number;
  mySocketId: string;
  /** ganhos da ultima pergunta — mostra "+N" flutuando sobre o carro */
  gains?: RevealEntry[] | null;
  /** mostra o "✓" de quem ja respondeu durante a pergunta */
  showAnswered?: boolean;
  /** so eu + lider + vizinhos, pra caber no celular durante a pergunta */
  compact?: boolean;
}

function visiblePlayers(players: RacePlayerPublic[], mySocketId: string, compact: boolean): RacePlayerPublic[] {
  if (!compact) return players;
  const byRank = [...players].sort((a, b) => a.rank - b.rank);
  const myRank = byRank.find((p) => p.socketId === mySocketId)?.rank ?? 1;
  const wanted = new Set([1, myRank - 1, myRank, myRank + 1]);
  return byRank.filter((p) => wanted.has(p.rank));
}

/**
 * Pista horizontal: uma raia por jogador, ordem fixa (so os carros andam, as raias nao trocam de lugar).
 * Posicao = distance / finishLine, travada visualmente na bandeira — ranking real usa a distancia sem trava.
 */
export function RaceTrack({ players, finishLine, mySocketId, gains, showAnswered, compact = false }: RaceTrackProps) {
  const lanes = visiblePlayers(players, mySocketId, compact);
  const laneHeight = compact || players.length > 8 ? "h-9" : "h-11";

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-2 sm:p-3">
      <div className="flex flex-col gap-1">
        {lanes.map((p) => {
          const pct = Math.min(1, p.distance / Math.max(1, finishLine)) * 100;
          const crossed = p.distance >= finishLine;
          const isMe = p.socketId === mySocketId;
          const gain = gains?.find((g) => g.socketId === p.socketId);
          return (
            <div key={p.socketId} className={`flex items-center gap-2 ${laneHeight}`}>
              <div className="flex w-20 shrink-0 items-center gap-1.5 sm:w-28">
                <span
                  className={`w-5 shrink-0 text-center text-xs font-black ${
                    p.rank <= 3 ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"
                  }`}
                >
                  {p.rank}º
                </span>
                <span
                  className={`truncate text-xs font-bold sm:text-sm ${isMe ? "text-[var(--primary)]" : "text-[var(--fg)]"}`}
                >
                  {p.name}
                </span>
                {showAnswered && p.answered && <span className="text-xs font-black text-[var(--primary)]">✓</span>}
              </div>

              <div
                className={`relative h-full flex-1 rounded-lg ${
                  isMe ? "bg-[var(--primary-tint)]" : "bg-[var(--bg)]"
                }`}
              >
                {/* faixa tracejada no meio da raia */}
                <div className="absolute inset-x-2 top-1/2 h-0 -translate-y-1/2 border-t-2 border-dashed border-[var(--border)]" />
                {/* linha de chegada quadriculada */}
                <div
                  className="absolute inset-y-0 right-1 w-2 rounded-sm opacity-70"
                  style={{
                    backgroundImage:
                      "repeating-conic-gradient(var(--fg) 0% 25%, transparent 0% 50%)",
                    backgroundSize: "4px 4px",
                  }}
                />
                {/* carro: left anima entre posicoes vindas do servidor */}
                <div
                  className="absolute top-1/2 flex items-center transition-[left,transform] duration-700 ease-out"
                  style={{ left: `${pct}%`, transform: `translate(-${pct}%, -50%)` }}
                >
                  <span className="relative flex items-center">
                    <span className="-scale-x-100 text-2xl leading-none sm:text-3xl">🏎️</span>
                    <span className="-ml-1.5">
                      <Avatar
                        emoji={p.avatar?.emoji}
                        bgColor={p.avatar?.bgColor}
                        imageUrl={p.avatar?.imageUrl}
                        fallbackLetter={p.name.charAt(0).toUpperCase()}
                        size="sm"
                      />
                    </span>
                    {crossed && <span className="ml-0.5 text-sm">🏁</span>}
                    {gain && gain.distanceGained > 0 && (
                      <span
                        key={gain.distanceGained + p.socketId}
                        className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-1.5 text-[10px] font-black text-white"
                        style={{ animation: "floatUpFade 1.6s ease-out 0.5s forwards" }}
                      >
                        +{gain.distanceGained}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {compact && players.length > lanes.length && (
        <p className="mt-1 text-center text-[10px] font-semibold text-[var(--fg-muted)]">
          mostrando você, o líder e seus vizinhos
        </p>
      )}
    </div>
  );
}
