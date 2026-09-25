"use client";

import type { CSSProperties } from "react";
import { Avatar } from "@/components/Avatar";
import { AnimatedNumber } from "./AnimatedNumber";
import type { RacePlayerPublic, RevealEntry } from "@/lib/race/types";

interface RaceTrackProps {
  players: RacePlayerPublic[];
  finishProgress: number;
  mySocketId: string;
  /** reveal da rodada atual (null durante a pergunta) — dispara as animacoes pontuais */
  reveal?: { questionId: string; entries: RevealEntry[] } | null;
  /** quem ultrapassou alguem de verdade nesta rodada (calculado comparando snapshots) */
  overtakers?: string[];
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

function flameClass(streak: number): string {
  if (streak >= 5) return "text-base drop-shadow-[0_0_6px_rgba(255,120,0,0.9)]";
  if (streak >= 3) return "text-sm drop-shadow-[0_0_4px_rgba(255,120,0,0.6)]";
  return "text-xs";
}

const SHARDS = [
  { dx: "-18px", dy: "-16px", rot: "-120deg" },
  { dx: "16px", dy: "-18px", rot: "140deg" },
  { dx: "-20px", dy: "12px", rot: "80deg" },
  { dx: "20px", dy: "10px", rot: "-90deg" },
  { dx: "0px", dy: "-22px", rot: "200deg" },
];

/**
 * Pista horizontal: uma raia por jogador, ordem fixa (so os carros andam, as raias nao trocam de lugar).
 * Posicao e estados (🔥, 🧊) vem do servidor; aqui so anima a transicao entre o snapshot anterior e o atual.
 */
export function RaceTrack({ players, finishProgress, mySocketId, reveal, overtakers, showAnswered, compact = false }: RaceTrackProps) {
  const lanes = visiblePlayers(players, mySocketId, compact);
  const tall = !compact && players.length <= 8;
  const revealKey = reveal?.questionId ?? "none";

  return (
    <div className="race-motion relative w-full overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-2 sm:p-3">
      <div className="flex flex-col gap-1">
        {lanes.map((p) => {
          const pct = Math.min(1, p.distance / Math.max(1, finishProgress)) * 100;
          const crossed = p.distance >= finishProgress;
          const isMe = p.socketId === mySocketId;
          const entry = reveal?.entries.find((g) => g.socketId === p.socketId);
          const gained = entry?.distanceGained ?? 0;
          const overtook = overtakers?.includes(p.socketId) ?? false;
          return (
            <div key={p.socketId} data-testid={`lane-${p.name}`} className={`flex items-center gap-2 ${tall ? "h-12" : "h-10"}`}>
              {/* identificacao: posicao, nome, 🔥 */}
              <div className="flex w-24 shrink-0 items-center gap-1 sm:w-32">
                <span
                  className={`w-5 shrink-0 text-center text-xs font-black ${
                    p.rank <= 3 ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"
                  }`}
                >
                  {p.rank}º
                </span>
                <span className={`min-w-0 truncate text-xs font-bold sm:text-sm ${isMe ? "text-[var(--primary)]" : "text-[var(--fg)]"}`}>
                  {p.name}
                </span>
                {showAnswered && p.answered && <span className="text-xs font-black text-[var(--primary)]">✓</span>}
                {p.streak > 0 ? (
                  <span
                    key={`flame-${p.streak}`}
                    data-testid="streak"
                    className={`inline-flex shrink-0 items-center font-black text-orange-500 ${flameClass(p.streak)}`}
                    style={{ animation: "race-flame-pop 0.45s ease-out" }}
                  >
                    🔥{p.streak}
                  </span>
                ) : entry?.lostStreak ? (
                  <span key={`lost-${revealKey}`} className="relative inline-flex shrink-0 text-xs">
                    <span style={{ animation: "race-flame-out 0.6s ease-in forwards" }}>🔥</span>
                    <span className="absolute inset-0 text-[var(--danger)]" style={{ animation: "popIn 0.3s 0.35s backwards" }}>
                      ✕
                    </span>
                  </span>
                ) : null}
              </div>

              <div className={`relative h-full flex-1 rounded-lg ${isMe ? "bg-[var(--primary-tint)]" : "bg-[var(--bg)]"}`}>
                <div className="absolute inset-x-2 top-1/2 h-0 -translate-y-1/2 border-t-2 border-dashed border-[var(--border)]" />
                {/* linha de chegada quadriculada */}
                <div
                  className="absolute inset-y-0 right-1 w-2 rounded-sm opacity-70"
                  style={{
                    backgroundImage: "repeating-conic-gradient(var(--fg) 0% 25%, transparent 0% 50%)",
                    backgroundSize: "4px 4px",
                  }}
                />

                {/* carro: left anima entre posicoes vindas do servidor (acelera e desacelera) */}
                <div
                  className="absolute top-1/2 flex items-center"
                  style={{
                    left: `${pct}%`,
                    transform: `translate(-${pct}%, -50%)`,
                    transition: "left 900ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                    zIndex: overtook ? 20 : isMe ? 10 : 1,
                  }}
                >
                  <span
                    key={overtook ? `ov-${revealKey}` : "car"}
                    className="relative flex items-center"
                    style={overtook ? { animation: "race-overtake 0.9s ease-out" } : undefined}
                  >
                    {/* fumaca e linhas de velocidade quando anda */}
                    {gained > 0 && (
                      <span key={`boost-${revealKey}`} className="pointer-events-none absolute -left-1 top-1/2 -translate-y-1/2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="absolute h-2 w-2 rounded-full bg-[var(--fg-muted)] opacity-0"
                            style={{ top: `${(i - 1) * 5}px`, animation: `race-exhaust 0.7s ease-out ${i * 0.12}s` }}
                          />
                        ))}
                        {[0, 1].map((i) => (
                          <span
                            key={`l${i}`}
                            className="absolute right-2 h-0.5 w-6 origin-right rounded bg-[var(--primary)] opacity-0"
                            style={{ top: `${i * 6 - 3}px`, animation: `race-speedline 0.8s ease-out ${0.1 + i * 0.1}s` }}
                          />
                        ))}
                      </span>
                    )}

                    <span className={`-scale-x-100 text-2xl leading-none sm:text-3xl ${p.frozen ? "grayscale" : ""}`}>🏎️</span>
                    <span className={`-ml-1.5 ${p.frozen ? "opacity-70 grayscale" : ""}`}>
                      <Avatar
                        emoji={p.avatar?.emoji}
                        bgColor={p.avatar?.bgColor}
                        imageUrl={p.avatar?.imageUrl}
                        fallbackLetter={p.name.charAt(0).toUpperCase()}
                        size="sm"
                      />
                    </span>

                    {/* 🧊 gelo envolvendo o carro enquanto congelado */}
                    {p.frozen && (
                      <span
                        key={`ice-${entry?.froze ? revealKey : "on"}`}
                        data-testid="ice"
                        className="pointer-events-none absolute -inset-1 flex items-start justify-end rounded-xl border-2 border-sky-200/80 bg-sky-200/45 backdrop-blur-[1px]"
                        style={{ animation: entry?.froze ? "race-ice-form 0.5s ease-out 0.3s backwards" : undefined }}
                      >
                        <span className="-mr-1.5 -mt-2 text-sm">🧊</span>
                      </span>
                    )}

                    {/* 💥 gelo quebrando no fim da rodada congelada */}
                    {entry?.wasFrozen && !p.frozen && (
                      <span key={`shatter-${revealKey}`} data-testid="shatter" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        {SHARDS.map((s, i) => (
                          <span
                            key={i}
                            className="absolute h-2 w-2 rotate-45 bg-sky-200 opacity-0"
                            style={
                              {
                                "--dx": s.dx,
                                "--dy": s.dy,
                                "--rot": s.rot,
                                animation: "race-fly 0.6s ease-out 0.2s",
                              } as CSSProperties
                            }
                          />
                        ))}
                        <span className="text-sm opacity-0" style={{ animation: "race-flame-out 0.7s ease-out 0.15s" }}>
                          💥
                        </span>
                      </span>
                    )}

                    {overtook && (
                      <span
                        key={`ovchip-${revealKey}`}
                        data-testid="overtake"
                        className="absolute -right-3 top-0 text-xs font-black text-[var(--primary)]"
                        style={{ animation: "floatUpFade 1.2s ease-out 0.6s forwards" }}
                      >
                        ↗
                      </span>
                    )}

                    {crossed && (
                      <span className="ml-0.5 origin-bottom-left text-base" style={{ animation: "race-wave 0.6s ease-in-out infinite" }}>
                        🏁
                      </span>
                    )}
                  </span>
                </div>

                {isMe && (
                  <span className="absolute bottom-0.5 right-4 text-[10px] font-black text-[var(--fg-muted)]">
                    <AnimatedNumber value={Math.min(p.distance, finishProgress)} suffix="m" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {compact && players.length > lanes.length && (
        <p className="mt-1 text-center text-xs font-semibold text-[var(--fg-muted)]">você, o líder e seus vizinhos</p>
      )}
    </div>
  );
}
