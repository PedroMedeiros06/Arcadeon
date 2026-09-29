"use client";

import { useEffect, useState } from "react";
import { Clock, Drama, Search, Send, Vote } from "lucide-react";
import { Canvas } from "./Canvas";
import { GuessPanel } from "./GuessPanel";
import { CATEGORY_LABEL } from "./WordPicker";
import type { CanvasHandlers, DrawRoomState, FeedItem, Point } from "@/lib/draw/types";

interface ImpostorScreenProps {
  room: DrawRoomState;
  myId: string;
  clockOffset: number;
  feed: FeedItem[];
  onStroke: (id: string, points: Point[], color: string, width: number) => void;
  onStrokeDone: () => void;
  onVote: (targetId: string) => void;
  /** chat na rodada; chute da palavra quando o impostor e pego */
  onSubmitText: (text: string) => void;
  registerCanvasHandlers: (handlers: CanvasHandlers | null) => void;
}

const noop = () => {};

function useMsLeft(endsAt: number | null, clockOffset: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt ? Math.max(0, endsAt - (now + clockOffset)) : 0;
}

function Dot({ color, size = 12 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ backgroundColor: color, width: size, height: size }} />;
}

/** Impostor pego: ultima chance de acertar a palavra. */
function ImpostorGuessCard({ onSubmit, seconds }: { onSubmit: (text: string) => void; seconds: number }) {
  const [text, setText] = useState("");
  return (
    <div className="animate-pop-in absolute inset-0 z-10 flex items-center justify-center bg-[var(--card)]/92 p-4 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSubmit(text.trim());
        }}
        className="flex w-full max-w-xs flex-col items-center gap-3 text-center"
      >
        <Drama className="h-10 w-10 text-[var(--danger)]" />
        <p className="text-lg font-black text-[var(--fg)]">Você foi pego!</p>
        <p className="text-sm font-semibold text-[var(--fg-muted)]">
          Acerte a palavra e ainda ganha a rodada. Uma tentativa, {seconds}s.
        </p>
        <div className="flex w-full gap-1.5">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={40}
            autoComplete="off"
            autoCapitalize="none"
            placeholder="Qual era a palavra?"
            className="min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base font-semibold text-[var(--fg)] outline-none focus:border-[var(--primary)] sm:text-sm"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={!text.trim()}
            className="flex w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] text-white transition active:scale-90 disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}

/** Fim da rodada: quem era o impostor, votos e pontos. */
function RevealOverlay({ room, myId }: { room: DrawRoomState; myId: string }) {
  const round = room.impostor!;
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? "?";
  const impostorName = round.impostorId ? nameOf(round.impostorId) : "?";
  const impostorWon = !round.caught || round.impostorGuessedRight;
  let headline: string;
  if (round.aborted) headline = "O impostor saiu da sala";
  else if (!round.caught) headline = `${impostorName} enganou todo mundo!`;
  else if (round.impostorGuessedRight) headline = `${impostorName} foi pego, mas acertou a palavra!`;
  else headline = `Pegaram ${impostorName}!`;

  const tally = new Map<string, number>();
  for (const v of round.votes ?? []) tally.set(v.target, (tally.get(v.target) ?? 0) + 1);
  const gains = Object.entries(round.gained ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="animate-fade-up absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 overflow-y-auto bg-[var(--card)]/94 p-3 text-center backdrop-blur-sm">
      <Drama className={`h-8 w-8 ${impostorWon ? "text-[var(--danger)]" : "text-[var(--draw-ok)]"}`} />
      <p className="text-base font-black text-[var(--fg)] sm:text-xl">{headline}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">A palavra era</p>
      <p className="rounded-lg bg-[var(--primary)] px-3 py-1 text-lg font-black uppercase text-white shadow-[0_3px_0_var(--primary-dark)] sm:text-2xl">
        {round.word}
      </p>
      {round.impostorGuess && (
        <p className="text-xs font-semibold text-[var(--fg-muted)]">
          Chute do impostor: <b className="text-[var(--fg)]">{round.impostorGuess}</b>
        </p>
      )}
      {tally.size > 0 && (
        <div className="flex flex-wrap justify-center gap-1">
          {[...tally].map(([id, n]) => (
            <span
              key={id}
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                id === round.impostorId ? "bg-[var(--danger-bg)] text-[var(--danger)]" : "bg-[var(--bg)] text-[var(--fg-muted)]"
              }`}
            >
              {nameOf(id)}: {n} voto{n > 1 ? "s" : ""}
            </span>
          ))}
        </div>
      )}
      {gains.length > 0 && (
        <div className="mt-1 flex w-full max-w-xs flex-col gap-1">
          {gains.map(([id, points]) => (
            <div
              key={id}
              className={`flex items-center justify-between rounded-lg px-3 py-1 text-xs font-bold sm:text-sm ${
                id === myId ? "bg-[var(--primary-tint)]" : "bg-[var(--bg)]"
              }`}
            >
              <span className="truncate text-[var(--fg)]">{nameOf(id)}</span>
              <span className="text-[var(--draw-ok)]">+{points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ImpostorScreen({
  room,
  myId,
  clockOffset,
  feed,
  onStroke,
  onStrokeDone,
  onVote,
  onSubmitText,
  registerCanvasHandlers,
}: ImpostorScreenProps) {
  const round = room.impostor;
  const msLeft = useMsLeft(room.phaseEndsAt, clockOffset);
  if (!round) return null;

  const seconds = Math.ceil(msLeft / 1000);
  const phase = room.phase;
  const colorOf = (id: string) => round.colors[id] ?? "#9ca3af";
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? "?";
  const myTurn = phase === "impostor-drawing" && round.strokerId === myId;
  const lap = Math.min(2, Math.floor(round.strokeIndex / Math.max(1, round.strokeOrder.length)) + 1);
  const categoryLabel = CATEGORY_LABEL[round.category] ?? round.category;
  const canChat = phase === "impostor-drawing" || phase === "impostor-voting";

  let status: React.ReactNode;
  if (phase === "impostor-drawing") {
    status = myTurn ? (
      <span className="text-[var(--primary)]">Sua vez! Faça um traço</span>
    ) : (
      <span className="flex items-center gap-1.5">
        <Dot color={colorOf(round.strokerId ?? "")} /> Vez de <b className="text-[var(--fg)]">{nameOf(round.strokerId ?? "")}</b>
      </span>
    );
  } else if (phase === "impostor-voting") {
    status = (
      <span className="flex items-center gap-1.5 text-[var(--danger)]">
        <Vote size={13} /> Votação: quem é o impostor?
      </span>
    );
  } else if (phase === "impostor-guess") {
    status = round.amImpostor ? (
      <span className="text-[var(--danger)]">Última chance: acerte a palavra</span>
    ) : (
      <span className="flex items-center gap-1.5">
        <Search size={13} /> O impostor foi pego e está tentando adivinhar...
      </span>
    );
  } else {
    status = <span>Fim da rodada</span>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-1.5 sm:gap-3 sm:p-3 lg:flex-row lg:gap-4 lg:p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2">
        <div className="shrink-0 overflow-hidden rounded-xl border-2 border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
            <div
              className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full border-2 text-sm font-black tabular-nums sm:h-12 sm:w-12 sm:text-base ${
                room.phaseEndsAt && seconds <= 5
                  ? "draw-timer-urgent border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]"
                  : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg)]"
              }`}
            >
              <Clock size={11} className="opacity-60" />
              {room.phaseEndsAt ? seconds : "–"}
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
              <p className="max-w-full truncate text-xs font-bold text-[var(--fg-muted)]">{status}</p>
              {round.amImpostor && phase !== "impostor-reveal" ? (
                <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-black text-[var(--danger)] sm:text-lg">
                  <Drama size={18} /> Você é o impostor
                  <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--fg-muted)] sm:text-xs">
                    Tema: {categoryLabel}
                  </span>
                </p>
              ) : (
                <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-black uppercase text-[var(--fg)] sm:text-lg">
                  {round.word}
                  <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-[11px] font-bold normal-case text-[var(--fg-muted)] sm:text-xs">
                    Tema: {categoryLabel}
                  </span>
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-center rounded-lg bg-[var(--bg)] px-2 py-1 leading-tight">
              <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--fg-muted)] sm:text-[10px]">Rodada</span>
              <span className="text-xs font-black tabular-nums text-[var(--fg)] sm:text-sm">
                {room.round}/{room.config.roundsPerPlayer}
              </span>
            </div>
          </div>

          {/* ordem dos tracos desta volta */}
          {phase === "impostor-drawing" && (
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-t-2 border-[var(--border)] px-2 py-1">
              <span className="shrink-0 text-[10px] font-extrabold uppercase text-[var(--fg-muted)]">Volta {lap}/2</span>
              {round.strokeOrder.map((id) => (
                <span
                  key={id}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition ${
                    id === round.strokerId ? "scale-105 bg-[var(--primary-tint)] text-[var(--fg)]" : "text-[var(--fg-muted)]"
                  }`}
                >
                  <Dot color={colorOf(id)} size={9} />
                  {nameOf(id)}
                </span>
              ))}
            </div>
          )}
        </div>

        <Canvas
          canDraw={myTurn}
          rules={{ forcedColor: colorOf(myId), singleStroke: true, noUndo: true, noFill: true, noShapes: true }}
          onStroke={onStroke}
          onStrokeDone={onStrokeDone}
          onFill={noop}
          onShape={noop}
          onClear={noop}
          onUndo={noop}
          registerHandlers={registerCanvasHandlers}
        >
          {phase === "impostor-guess" && round.amImpostor && <ImpostorGuessCard onSubmit={onSubmitText} seconds={seconds} />}
          {phase === "impostor-reveal" && <RevealOverlay room={room} myId={myId} />}
        </Canvas>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-1.5 sm:gap-2 lg:min-h-0 lg:w-80 lg:flex-none">
        {phase === "impostor-voting" && (
          <div className="animate-fade-up flex shrink-0 flex-col gap-1.5 rounded-xl border-2 border-[var(--danger)] bg-[var(--card)] p-2">
            <p className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wide text-[var(--danger)]">
              <span>Vote no impostor</span>
              <span className="text-[var(--fg-muted)]">
                {round.votedIds.length}/{room.players.filter((p) => p.connected).length} votaram
              </span>
            </p>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
              {room.players
                .filter((p) => p.id !== myId)
                .map((p) => {
                  const mine = round.myVote === p.id;
                  return (
                    <button
                      key={p.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onVote(p.id)}
                      aria-pressed={mine}
                      className={`flex shrink-0 items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-sm font-bold transition active:scale-95 ${
                        mine
                          ? "border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--danger)]"
                      }`}
                    >
                      <Dot color={colorOf(p.id)} />
                      {p.name}
                      {round.votedIds.includes(p.id) && <span className="text-[10px] font-semibold opacity-60">já votou</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        <GuessPanel
          isDrawer={!canChat}
          canGuess={canChat}
          hasGuessed={false}
          players={room.players}
          drawerId={round.strokerId}
          myId={myId}
          feed={feed}
          onSubmitGuess={onSubmitText}
          colorOf={colorOf}
          inputPlaceholder={round.amImpostor ? "Disfarce: comente o desenho..." : "Converse e acuse (sem dizer a palavra)..."}
          emptyFeedText="Conversem aqui: quem parece não saber a palavra?"
          fill
        />
      </div>
    </div>
  );
}
