"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { RoundEndedPayload } from "@/lib/buggle/types";
import { scoreForWord } from "@/lib/buggle/score";

interface ResultsScreenProps {
  result: RoundEndedPayload;
  isHost: boolean;
  onPlayAgain: () => void;
}

const LENGTH_COLORS: Record<number, string> = {
  3: "#8a8fa8",
  4: "#1cb0f6",
  5: "#22c55e",
  6: "#f59e0b",
  7: "#ef4444",
};
function colorForLength(len: number) {
  return LENGTH_COLORS[len] ?? "#a855f7"; // 8+ = roxo
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
function ordinalFor(i: number) {
  return ORDINALS[i] ?? `${i + 1}th`;
}

export function ResultsScreen({ result, isHost, onPlayAgain }: ResultsScreenProps) {
  const secretFound = result.foundBy.some((p) =>
    result.secretWord ? p.foundWords.includes(result.secretWord.word) : false
  );

  // a secreta nunca entra no reveal normal (mesmo quando encontrada): ela e
  // sempre a ultima a aparecer, fixa no board com o efeito dourado
  const words = useMemo(() => {
    const list = result.secretWord
      ? result.allWords.filter((w) => w.word !== result.secretWord!.word)
      : [...result.allWords];
    return list.sort((a, b) => a.word.length - b.word.length);
  }, [result.allWords, result.secretWord]);

  const [revealIndex, setRevealIndex] = useState(0);
  const [phase, setPhase] = useState<"entering" | "leaving" | "idle">("idle");
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(result.room.players.map((p) => [p.socketId, 0]))
  );
  const [gainFlash, setGainFlash] = useState<Record<string, number>>({});
  const [secretRevealed, setSecretRevealed] = useState(false);

  // maquina de reveal: comeca com nada visivel, entao vai revelando uma
  // palavra por vez (entra -> fica -> sai -> proxima), sem pular etapas
  useEffect(() => {
    if (revealIndex < 0 || revealIndex >= words.length) {
      if (revealIndex === words.length) {
        const timeout = setTimeout(() => setSecretRevealed(true), 800);
        return () => clearTimeout(timeout);
      }
      return;
    }

    // tempo pra escrever a palavra toda (delay por letra, igual ao usado no render)
    // + uma pausa de leitura, so entao a animacao de saida comeca
    const word = words[revealIndex];
    const intensity = Math.min(word.word.length, 10);
    const letterDelayMs = (0.05 + intensity * 0.012) * 1000;
    const typeDurationMs = word.word.length * letterDelayMs + 250; // 250ms = duracao do letterPop
    const readPauseMs = 1200;
    const leaveAt = typeDurationMs + readPauseMs;
    const advanceAfterLeaveMs = 400; // duracao do fadeOut

    const enterTimer = setTimeout(() => setPhase("entering"), 50);
    const leaveTimer = setTimeout(() => {
      setPhase("leaving");

      const finders = result.foundBy.filter((p) => p.foundWords.includes(word.word));
      if (finders.length > 0) {
        const gains: Record<string, number> = {};
        setScores((prev) => {
          const updated = { ...prev };
          for (const f of finders) {
            const points = scoreForWord(word.word.length);
            updated[f.socketId] = (updated[f.socketId] ?? 0) + points;
            gains[f.socketId] = points;
          }
          return updated;
        });
        setGainFlash(gains);
        setTimeout(() => setGainFlash({}), 1200);
      }
    }, leaveAt);
    const advanceTimer = setTimeout(() => {
      setPhase("idle");
      setRevealIndex((i) => i + 1);
    }, leaveAt + advanceAfterLeaveMs);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
      clearTimeout(advanceTimer);
    };
  }, [revealIndex, words, result.foundBy]);

  const currentWord = revealIndex >= 0 && revealIndex < words.length ? words[revealIndex] : null;
  const currentPoints = currentWord ? scoreForWord(currentWord.word.length) : 0;
  const board = result.room.board;
  const totalWords = words.length;
  const countedSoFar = Math.max(0, revealIndex + 1);

  // secreta (encontrada ou nao) fica marcada fixa no board quando revelada, por ultimo
  const showFixedSecret = secretRevealed && !!result.secretWord;

  // efeito "led chase": percorre o caminho da secreta do inicio ao fim, com um
  // brilho que flui suavemente de uma celula pra proxima (fade continuo, sem
  // degrau) — so reinicia do comeco depois que a ponta termina o percurso
  // inteiro e uma pausa curta passa (nao fica dando volta em circulo).
  const [chaseTick, setChaseTick] = useState(0);
  useEffect(() => {
    if (!showFixedSecret) return;
    const path = result.secretWord?.path ?? [];
    const len = Math.max(1, path.length);
    const stepMs = 550; // tempo pra percorrer uma celula do caminho
    const pauseMs = 900; // pausa antes de reiniciar o percurso
    const cycleMs = len * stepMs + pauseMs;
    let raf: number;
    const start = performance.now();
    const loop = (now: number) => {
      const elapsed = (now - start) % cycleMs;
      setChaseTick(Math.min(len, elapsed / stepMs));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showFixedSecret, result.secretWord]);

  // caminho fica sempre dourado solido; isso aqui e so um brilho extra (shine)
  // que passa por cima das celulas, de 0 (nada) a 1 (brilho maximo)
  const chaseShine = useMemo(() => {
    if (!showFixedSecret) return new Map<string, number>();
    const path = result.secretWord!.path;
    const len = path.length;
    const shine = new Map<string, number>();
    const shineSpan = 1.4;
    for (let i = 0; i < len; i++) {
      const dist = Math.abs(chaseTick - i);
      const strength = Math.max(0, 1 - dist / shineSpan);
      const cell = path[i];
      shine.set(`${cell.row}-${cell.col}`, strength);
    }
    return shine;
  }, [showFixedSecret, chaseTick, result.secretWord]);

  const highlightSet = useMemo(() => {
    if (showFixedSecret) return new Set(result.secretWord!.path.map((c) => `${c.row}-${c.col}`));
    if (!currentWord) return new Set<string>();
    return new Set(currentWord.path.map((c) => `${c.row}-${c.col}`));
  }, [currentWord, showFixedSecret, result.secretWord]);

  const ranking = useMemo(
    () =>
      [...result.room.players].sort((a, b) => (scores[b.socketId] ?? 0) - (scores[a.socketId] ?? 0)),
    [result.room.players, scores]
  );

  return (
    <div className="flex flex-1 flex-col items-center gap-5 overflow-hidden p-4 sm:p-6">
      <div className="relative flex w-full justify-center self-stretch">
        {board && (
          <div className="relative">
            <div
              className="grid gap-1 rounded-3xl bg-[var(--primary-tint)] p-3 shadow-[0_6px_0_var(--border)]"
              style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))`, width: "min(85vw, 460px)" }}
            >
              {board.map((row) =>
                row.map((cell) => {
                  const key = `${cell.row}-${cell.col}`;
                  const isHighlighted = highlightSet.has(key);
                  const shine = chaseShine.get(key) ?? 0;
                  const isSecretCell = showFixedSecret && isHighlighted;
                  return (
                    <div
                      key={key}
                      className={`relative flex aspect-square items-center justify-center rounded-md font-extrabold uppercase text-white ${
                        isSecretCell
                          ? "bg-[#facc15]"
                          : isHighlighted
                            ? "bg-[#4ade80] shadow-[0_2px_0_#16a34a] transition-colors duration-300"
                            : "bg-[var(--primary-dark)] transition-colors duration-300"
                      }`}
                      style={{
                        fontSize: `clamp(1rem, ${180 / board.length}%, 2rem)`,
                        boxShadow: isSecretCell ? "0 2px 0 #ca8a04" : undefined,
                      }}
                    >
                      {cell.letter}
                      {isSecretCell && (
                        <span
                          className="pointer-events-none absolute inset-0 rounded-md bg-white"
                          style={{ opacity: shine * 0.35 }}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="absolute left-full top-0 flex h-full items-stretch gap-2.5 pl-4">
              <div className="relative h-full w-2.5 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-white/10">
                <div
                  className="absolute bottom-0 left-0 w-full rounded-full bg-[var(--primary)] transition-all duration-500"
                  style={{ height: `${totalWords > 0 ? (countedSoFar / totalWords) * 100 : 0}%` }}
                />
              </div>

              <div className="flex flex-col justify-between py-1 text-xs font-semibold whitespace-nowrap text-[var(--fg-muted)]">
                <div className="flex flex-col">
                  <span>Total de palavras</span>
                  <span className="text-lg font-extrabold text-[var(--fg)]">{totalWords}</span>
                </div>
                <div className="flex flex-col">
                  <span>Contadas</span>
                  <span className="text-lg font-extrabold text-[var(--primary)]">{countedSoFar}</span>
                </div>
              </div>
            </div>

            <div className="absolute left-1/2 top-full flex translate-x-[-42%] items-center gap-2 pt-5">
              {currentWord && phase !== "idle" && (() => {
                // palavra maior = entrada mais brusca (mais escala/rotacao) e letras mais espacadas
                const len = currentWord.word.length;
                const intensity = Math.min(len, 10);
                const enterScale = 1 + intensity * 0.09; // ate ~1.9
                const enterRot = intensity * 1.2; // ate ~12deg
                const letterDelay = 0.05 + intensity * 0.012;
                return (
                  <>
                    <span
                      key={currentWord.word}
                      className={`w-max whitespace-nowrap rounded-full border-2 border-[var(--primary-dark)] px-6 py-2 text-2xl font-extrabold text-white shadow-lg ${
                        phase === "leaving" ? "animate-[fadeOut_0.4s_ease]" : ""
                      }`}
                      style={
                        {
                          backgroundColor: colorForLength(currentWord.word.length),
                          animation:
                            phase === "entering"
                              ? `wordSlam 0.4s cubic-bezier(0.17,0.89,0.32,1.49) both`
                              : undefined,
                          "--slam-scale": enterScale,
                          "--slam-rot": `${enterRot}deg`,
                        } as React.CSSProperties
                      }
                    >
                      {currentWord.word.split("").map((letter, i) => (
                        <span
                          key={i}
                          className="inline-block"
                          style={{ animation: `letterPop 0.25s ease-out ${i * letterDelay}s both` }}
                        >
                          {letter}
                        </span>
                      ))}
                    </span>
                    <span
                      key={`points-${currentWord.word}`}
                      className={`text-lg font-extrabold text-yellow-400 ${
                        phase === "leaving" ? "animate-[fadeOut_0.4s_ease]" : ""
                      }`}
                      style={
                        phase === "entering"
                          ? ({
                              animation: `wordSlam 0.4s cubic-bezier(0.17,0.89,0.32,1.49) both`,
                              "--slam-scale": enterScale,
                              "--slam-rot": `${enterRot}deg`,
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      +{currentPoints}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="h-14 w-full" />

      <div className="flex flex-wrap items-end justify-center gap-4">
        {ranking.map((p, i) => {
          const score = scores[p.socketId] ?? 0;
          const wordsFoundCount = result.foundBy.find((f) => f.socketId === p.socketId)?.foundWords.length ?? 0;
          const gain = gainFlash[p.socketId];
          return (
            <div key={p.socketId} className="relative flex flex-col items-center gap-1">
              {gain && (
                <span
                  key={`${p.socketId}-${revealIndex}`}
                  className="absolute -top-6 text-sm font-extrabold text-[var(--primary)]"
                  style={{ animation: "floatUpFade 1.2s ease-out forwards" }}
                >
                  +{gain}
                </span>
              )}
              <div className="relative">
                <Avatar
                  emoji={p.avatar?.emoji}
                  bgColor={p.avatar?.bgColor ?? colorFor(p.socketId)}
                  imageUrl={p.avatar?.imageUrl}
                  fallbackLetter={p.name.trim().charAt(0).toUpperCase()}
                  size="lg"
                  shape="square"
                />
                {p.socketId === result.room.hostSocketId && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400 p-1 shadow">
                    <Crown size={10} className="fill-[#2c1568] text-[#2c1568]" />
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-[var(--fg)]">{p.name}</span>
              <span className="text-[11px] font-semibold text-[var(--fg-muted)]">
                {wordsFoundCount} {wordsFoundCount === 1 ? "palavra" : "palavras"}
              </span>
              <div className="flex flex-col items-center rounded-t-xl bg-[var(--primary)] px-4 py-2 text-white shadow-[0_4px_0_var(--primary-dark)]">
                <span className="text-lg font-extrabold">{score}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide">{ordinalFor(i)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {secretRevealed && result.secretWord && (() => {
        const finders = result.foundBy.filter((p) => p.foundWords.includes(result.secretWord!.word));
        const finderNames = finders.map((p) => p.name).join(", ");
        return (
          <div
            className="fixed left-4 top-[88px] z-50 flex flex-col gap-1 rounded-2xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-3 shadow-[0_6px_0_var(--primary-dark)]"
            style={{ "--card-rot": "-5deg", animation: "cardDropIn 0.5s cubic-bezier(0.17,0.89,0.32,1.28) both" } as React.CSSProperties}
          >
            <span className="text-[11px] font-bold uppercase tracking-wide text-white">
              {secretFound ? `${finderNames} encontrou a palavra secreta` : "A palavra secreta desta rodada era"}
            </span>
            <span className="text-3xl font-black tracking-wide text-yellow-300">{result.secretWord.word}</span>
          </div>
        );
      })()}

      {isHost && secretRevealed && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPlayAgain}
          className="rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-8 py-3 font-bold text-white shadow-[0_4px_0_var(--primary-dark)]"
        >
          Jogar novamente
        </button>
      )}
    </div>
  );
}
