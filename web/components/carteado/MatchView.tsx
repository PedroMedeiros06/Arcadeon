"use client";

import { Hourglass, LogOut } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { COLORS, type Card, type CardColor } from "@/lib/carteado/engine";
import { COLOR_HEX, COLOR_LABEL, type EventTone } from "@/lib/carteado/cards";
import type { PlayerAvatar } from "@/lib/carteado/types";
import { Cartela } from "./Cartela";
import { CarteadoCard } from "./CarteadoCard";

export interface MatchSide {
  name: string;
  avatar: PlayerAvatar | null;
  cells: (CardColor | null)[];
  required: CardColor | null;
}

/** Mesa compartilhada pelo Treino e pelas salas online. So desenha; quem decide e' o pai. */
export function MatchView({
  me,
  opp,
  myTurn,
  canFlip,
  choosingColor,
  lastCard,
  flipKey,
  drawCount,
  fresh,
  status,
  toast,
  secondsLeft,
  timerFraction,
  onFlip,
  onChoose,
  onLeave,
}: {
  me: MatchSide;
  opp: MatchSide;
  myTurn: boolean;
  canFlip: boolean;
  /** eu virei a preta e preciso escolher */
  choosingColor: boolean;
  lastCard: Card | null;
  /** muda a cada carta virada: reinicia a animacao */
  flipKey: number;
  drawCount: number;
  fresh: { mine: boolean; index: number } | null;
  status: string;
  toast: { text: string; tone: EventTone; seq: number } | null;
  secondsLeft: number | null;
  /** 0..1 do relogio da vez; null = sem relogio */
  timerFraction: number | null;
  onFlip: () => void;
  onChoose: (color: CardColor) => void;
  onLeave: () => void;
}) {
  const ending = secondsLeft !== null && secondsLeft <= 3;
  const meFilled = me.cells.filter(Boolean).length;
  const oppFilled = opp.cells.filter(Boolean).length;

  return (
    <div className="carteado-motion flex w-full flex-1 flex-col">
      <div className="sticky top-0 z-30 border-b-2 border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLeave}
            aria-label="Sair da partida"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] transition hover:opacity-80"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <span key={status} className={`animate-fade-up truncate text-base font-black ${myTurn ? "text-[var(--game-accent)]" : "text-[var(--fg)]"}`}>
            {status}
          </span>
          <span
            className={`flex min-w-[64px] items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-black tabular-nums ${
              ending ? "bg-[var(--danger)] text-white" : "bg-[var(--bg)] text-[var(--fg)]"
            }`}
          >
            <Hourglass className="h-3.5 w-3.5" />
            {secondsLeft === null ? "—" : `${secondsLeft}s`}
          </span>
        </div>
        {timerFraction !== null && (
          <div className="h-1 w-full bg-[var(--border)]">
            <div
              className="h-full transition-[width] duration-200 ease-linear"
              style={{ width: `${Math.min(1, timerFraction) * 100}%`, backgroundColor: ending ? "var(--danger)" : "var(--game-accent)" }}
            />
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-3 px-3 py-3">
        {/* adversario */}
        <div
          className={`flex w-full max-w-md items-center gap-3 rounded-2xl border-2 bg-[var(--card)] p-2.5 transition ${
            !myTurn ? "border-[var(--game-accent)]" : "border-[var(--border)]"
          }`}
        >
          <Avatar emoji={opp.avatar?.emoji} bgColor={opp.avatar?.bgColor} imageUrl={opp.avatar?.imageUrl} fallbackLetter={opp.name.charAt(0).toUpperCase()} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-black text-[var(--fg)]">{opp.name}</p>
            <p className="text-xs font-semibold text-[var(--fg-muted)]">{oppFilled}/9 números</p>
            {opp.required && <RequiredTag color={opp.required} label="precisa de" />}
          </div>
          <Cartela cells={opp.cells} fresh={fresh && !fresh.mine ? fresh.index : null} size="sm" />
        </div>

        {/* mesa */}
        <div className="relative flex items-center justify-center gap-5 py-2 sm:gap-8">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onFlip}
            disabled={!canFlip}
            aria-label="Virar carta do monte"
            className={`group relative transition ${canFlip ? "cursor-pointer hover:-translate-y-1" : "cursor-default"}`}
          >
            <span className="absolute left-1.5 top-1.5 opacity-50">
              <CarteadoCard card={null} width={84} />
            </span>
            <span className="absolute left-0.5 top-0.5 opacity-75">
              <CarteadoCard card={null} width={84} />
            </span>
            <CarteadoCard card={null} width={84} className={canFlip ? "carteado-glow" : ""} />
            <span className="absolute -bottom-6 left-0 right-0 text-center text-xs font-bold text-[var(--fg-muted)]">{drawCount} no monte</span>
          </button>
          <div className="flex h-[134px] w-[96px] items-center justify-center">
            {lastCard ? (
              <CarteadoCard key={flipKey} card={lastCard} width={96} className="carteado-flip-in" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] p-2 text-center text-xs font-bold text-[var(--fg-muted)]">
                Vire a primeira carta
              </div>
            )}
          </div>
          {toast && (
            <div className="pointer-events-none absolute inset-x-0 -top-4 z-20 flex justify-center">
              <span
                key={toast.seq}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black shadow-lg ${
                  toast.tone === "good"
                    ? "bg-[var(--game-accent)] text-white"
                    : toast.tone === "bad"
                      ? "bg-[var(--danger)] text-white"
                      : toast.tone === "wild"
                        ? "bg-[#121018] text-white"
                        : "bg-[var(--card)] text-[var(--fg)] ring-2 ring-[var(--border)]"
                }`}
                style={{ animation: "popIn 0.35s ease-out" }}
              >
                {toast.text}
              </span>
            </div>
          )}
        </div>

        {/* eu */}
        <div
          className={`mt-4 flex w-full max-w-md flex-col items-center gap-2.5 rounded-3xl border-2 bg-[var(--card)] p-3 transition ${
            myTurn ? "border-[var(--game-accent)] shadow-[0_8px_24px_-12px_var(--game-accent)]" : "border-[var(--border)]"
          }`}
        >
          <div className="flex w-full items-center gap-2">
            <Avatar emoji={me.avatar?.emoji} bgColor={me.avatar?.bgColor} imageUrl={me.avatar?.imageUrl} fallbackLetter={me.name.charAt(0).toUpperCase()} />
            <p className="flex-1 truncate font-black text-[var(--fg)]">Sua cartela</p>
            <span className="text-sm font-black tabular-nums text-[var(--game-accent)]">{meFilled}/9</span>
          </div>
          {me.required && <RequiredTag color={me.required} label="Sua próxima carta precisa ser" />}
          <Cartela cells={me.cells} fresh={fresh?.mine ? fresh.index : null} />
        </div>
      </div>

      {choosingColor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="animate-fade-up w-full max-w-sm rounded-3xl bg-[var(--card)] p-5 text-center shadow-2xl">
            <p className="text-lg font-black text-[var(--fg)]">Escolha a cor</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">A próxima carta de número de {opp.name} só conta se for dessa cor.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onChoose(color)}
                  className="rounded-2xl py-5 text-lg font-black capitalize text-white shadow-[inset_0_-0.25em_0_rgba(0,0,0,0.2)] transition hover:brightness-110 active:scale-95"
                  style={{ background: COLOR_HEX[color] }}
                >
                  {COLOR_LABEL[color]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequiredTag({ color, label }: { color: CardColor; label: string }) {
  return (
    <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg)] px-2 py-0.5 text-xs font-bold text-[var(--fg)]">
      {label}
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-white" style={{ background: COLOR_HEX[color] }}>
        {COLOR_LABEL[color]}
      </span>
    </span>
  );
}
