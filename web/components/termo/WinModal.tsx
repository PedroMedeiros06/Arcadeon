"use client";

import { useState } from "react";
import { Award, Bot, Clock, Coins, Flame, RotateCcw, Share2, Shield, Swords, Target } from "lucide-react";
import { LoginModal } from "@/components/LoginModal";
import { Leaderboard } from "./Leaderboard";
import { NextWordCountdown } from "./Extras";

interface WinModalProps {
  open: boolean;
  won: boolean;
  attempts: number;
  boardCount: number;
  timeString: string;
  answers: string[];
  leaderboardRefresh: number;
  currentStreak?: number;
  coinsAwarded?: number;
  showLeaderboard?: boolean;
  /** Diario jogado sem conta: lembra que ranking/sequencia/moedas precisam de login */
  loginHint?: boolean;
  shareFeedback?: string | null;
  onShare: () => void;
  onPlayAgain: () => void;
  playAgainLabel?: string;
  /** Diario: mostra contagem pra proxima palavra */
  showCountdown?: boolean;
  /** conquistas liberadas nesta partida */
  achievements?: string[];
  shieldsUsed?: number;
  onAnalyze?: () => void;
  /** Infinito: gera link pra um amigo jogar as mesmas palavras */
  onChallenge?: () => void;
  /** resultado de quem mandou o desafio, pra comparar */
  challenger?: { name: string | null; attempts: number | null; timeSeconds: number | null } | null;
}

// indice = tentativas alem do minimo possivel (1 no Letrado, 2 no Duplo, 4 no Quádruplo);
// todo modo tem 5 tentativas de folga, entao a mesma escala vale pros tres
const WIN_PHRASES = [
  "Impossível! Você é um gênio!",
  "Extraordinário! Mandou muito bem!",
  "Excelente! Ótima jogada!",
  "Muito bom! Mandou bem!",
  "Ufa, quase! Bom trabalho!",
  "Ufa! Por muito pouco!",
];

export function WinModal({
  open,
  won,
  attempts,
  boardCount,
  timeString,
  answers,
  leaderboardRefresh,
  currentStreak,
  coinsAwarded = 0,
  showLeaderboard = true,
  loginHint = false,
  shareFeedback,
  onShare,
  onPlayAgain,
  playAgainLabel = "Jogar novamente",
  showCountdown = false,
  achievements = [],
  shieldsUsed = 0,
  onAnalyze,
  onChallenge,
  challenger,
}: WinModalProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  if (!open) return null;

  const feedback = WIN_PHRASES[attempts - boardCount] ?? "Você acertou!";
  const answerText = answers.join(", ").toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={won ? "Você acertou" : "Fim de jogo"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.4)] animate-[scaleIn_0.25s_ease-out]">
        <div
          className={`relative shrink-0 overflow-hidden px-8 pb-8 pt-9 text-center ${
            won
              ? "bg-gradient-to-br from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)]"
              : "bg-gradient-to-br from-[var(--fg-muted)] to-[var(--border-hover)]"
          }`}
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

          <div className="animate-pop-in mb-3 text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
            {won ? "🎉" : "😔"}
          </div>

          <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-white">
            {won ? "Você acertou!" : "Fim de jogo"}
          </h2>
          <p className="text-sm font-semibold text-white/85">
            {won ? feedback : `${answers.length > 1 ? "As palavras eram" : "A palavra era"}: ${answerText}`}
          </p>
          {won && answers.length > 1 && <p className="mt-1 text-xs font-bold text-white/70">{answerText}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {coinsAwarded > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-extrabold text-white">
                <Coins className="h-4 w-4" /> +{coinsAwarded} moedas
              </span>
            )}
            {shieldsUsed > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-extrabold text-white">
                <Shield className="h-4 w-4" /> {shieldsUsed} escudo{shieldsUsed > 1 ? "s" : ""} salv{shieldsUsed > 1 ? "aram" : "ou"} sua sequência
              </span>
            )}
            {achievements.map((a) => (
              <span
                key={a}
                className="animate-pop-in inline-flex items-center gap-1.5 rounded-full bg-yellow-300 px-3 py-1 text-sm font-extrabold text-[#5a3d00]"
              >
                <Award className="h-4 w-4" /> Conquista: {a}
              </span>
            ))}
          </div>
        </div>

        <div className="shrink-0 px-8 pt-5">
          <div className="flex justify-center gap-3">
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
              <span className="flex items-center gap-1 text-xl font-extrabold text-[var(--primary)]">
                <Target className="h-4 w-4" />
                {attempts}
              </span>
              <span className="text-xs font-bold uppercase text-[var(--fg-muted)]">Tentativas</span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
              <span className="flex items-center gap-1 text-xl font-extrabold text-[var(--accent)]">
                <Clock className="h-4 w-4" />
                {timeString}
              </span>
              <span className="text-xs font-bold uppercase text-[var(--fg-muted)]">Tempo</span>
            </div>
            {currentStreak !== undefined && (
              <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-3">
                <span className="flex items-center gap-1 text-xl font-extrabold text-[var(--primary)]">
                  <Flame className="h-4 w-4 fill-current" />
                  {currentStreak}
                </span>
                <span className="text-xs font-bold uppercase text-[var(--fg-muted)]">Sequência</span>
              </div>
            )}
          </div>
          {challenger && (
            <p className="mt-3 rounded-xl bg-[var(--bg)] px-3 py-2 text-center text-sm font-bold text-[var(--fg)]">
              <Swords className="mr-1 inline h-4 w-4 text-[var(--primary)]" />
              {challenger.name ?? "Seu amigo"}{" "}
              {challenger.attempts
                ? `fez em ${challenger.attempts} tentativa${challenger.attempts > 1 ? "s" : ""}${
                    challenger.timeSeconds !== null
                      ? ` (${Math.floor(challenger.timeSeconds / 60)}m ${challenger.timeSeconds % 60}s)`
                      : ""
                  }`
                : "não conseguiu"}
              {won && challenger.attempts
                ? attempts < challenger.attempts
                  ? " — você venceu o desafio! 🏆"
                  : attempts === challenger.attempts
                    ? " — empate!"
                    : " — não foi dessa vez."
                : won && !challenger.attempts
                  ? " — você venceu o desafio! 🏆"
                  : ""}
            </p>
          )}
          {loginHint && (
            <p className="mt-3 text-center text-xs font-semibold text-[var(--fg-muted)]">
              <button onClick={() => setLoginOpen(true)} className="font-extrabold text-[var(--primary)] underline">
                Entre na sua conta
              </button>{" "}
              para contar sequência, ganhar moedas e aparecer no ranking.
            </p>
          )}
        </div>

        {showLeaderboard && (
          <div className="mt-5 flex-1 overflow-y-auto border-t-2 border-[var(--border)] px-8">
            <Leaderboard refreshKey={leaderboardRefresh} boardCount={boardCount} />
          </div>
        )}

        <div className="flex shrink-0 flex-col gap-2 p-8 pt-4">
          {showCountdown && <NextWordCountdown className="mb-1" />}
          {(onAnalyze || onChallenge) && (
            <div className="flex gap-2">
              {onAnalyze && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onAnalyze}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm font-extrabold text-[var(--fg)] transition hover:bg-[var(--bg)]"
                >
                  <Bot className="h-4 w-4" /> Análise
                </button>
              )}
              {onChallenge && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onChallenge}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm font-extrabold text-[var(--fg)] transition hover:bg-[var(--bg)]"
                >
                  <Swords className="h-4 w-4" /> Desafiar amigo
                </button>
              )}
            </div>
          )}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onShare}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-6 py-2.5 text-sm font-extrabold text-[var(--fg)] transition hover:bg-[var(--bg)]"
          >
            <Share2 className="h-4 w-4" />
            {shareFeedback === "Resultado copiado!" ? "Copiado!" : "Compartilhar resultado"}
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPlayAgain}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-3 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
          >
            <RotateCcw className="h-4 w-4" />
            {playAgainLabel}
          </button>
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
