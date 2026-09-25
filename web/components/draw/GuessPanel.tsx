"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Send, Sparkles } from "lucide-react";
import type { DrawPlayerPublic, FeedItem } from "@/lib/draw/types";

interface GuessPanelProps {
  isDrawer: boolean;
  canGuess: boolean;
  hasGuessed: boolean;
  players: DrawPlayerPublic[];
  drawerSocketId: string | null;
  mySocketId: string;
  feed: FeedItem[];
  onSubmitGuess: (guess: string) => void;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Chip do placar: pulsa e solta um "+N" flutuante quando a pontuacao sobe. */
function ScoreChip({ player, isMe, isDrawer }: { player: DrawPlayerPublic; isMe: boolean; isDrawer: boolean }) {
  const prevScore = useRef(player.score);
  const [delta, setDelta] = useState<{ value: number; key: number } | null>(null);

  useEffect(() => {
    const diff = player.score - prevScore.current;
    prevScore.current = player.score;
    if (diff <= 0) return;
    setDelta({ value: diff, key: Date.now() });
    const t = setTimeout(() => setDelta(null), 1300);
    return () => clearTimeout(t);
  }, [player.score]);

  return (
    <div
      key={delta?.key}
      className={`relative flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-1.5 py-1 lg:gap-2 lg:px-2 lg:py-1.5 ${
        delta ? "draw-bump" : ""
      } ${
        player.hasGuessedThisTurn
          ? "border-[var(--draw-ok)] bg-[var(--draw-ok-bg)]"
          : isMe
            ? "border-[var(--primary)] bg-[var(--primary-tint)]"
            : "border-transparent bg-[var(--bg)]"
      }`}
    >
      <span
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white lg:h-7 lg:w-7 lg:text-xs"
        style={{ backgroundColor: colorFor(player.socketId) }}
      >
        {player.name.trim().charAt(0).toUpperCase() || "?"}
        {isDrawer && (
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--primary)] ring-2 ring-[var(--card)]">
            <Pencil size={8} className="text-white" />
          </span>
        )}
        {player.hasGuessedThisTurn && (
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--draw-ok)] ring-2 ring-[var(--card)]">
            <Check size={9} strokeWidth={3.5} className="text-white" />
          </span>
        )}
      </span>
      <span className="max-w-[5.5rem] truncate text-xs font-bold text-[var(--fg)] lg:max-w-none lg:flex-1 lg:text-sm">
        {player.name}
      </span>
      <span className="text-xs font-extrabold tabular-nums text-[var(--primary)] lg:text-sm">{player.score}</span>
      {delta && (
        <span
          key={delta.key}
          className="draw-score-float pointer-events-none absolute left-1/2 top-0 z-10 rounded-full bg-[var(--draw-ok)] px-1.5 text-[11px] font-extrabold text-white shadow"
        >
          +{delta.value}
        </span>
      )}
    </div>
  );
}

function FeedLine({ item }: { item: FeedItem }) {
  if (item.kind === "own-correct") {
    return (
      <p className="draw-feed-in flex items-center gap-1.5 rounded-lg bg-[var(--draw-ok-bg)] px-2 py-1 text-xs font-extrabold text-[var(--draw-ok)] sm:text-sm">
        <Sparkles size={14} className="shrink-0" />
        {item.text}
      </p>
    );
  }
  if (item.kind === "correct") {
    return (
      <p className="draw-feed-in flex items-center gap-1.5 rounded-lg bg-[var(--draw-ok-bg)] px-2 py-0.5 text-xs font-bold text-[var(--draw-ok)] sm:text-sm">
        <Check size={13} strokeWidth={3} className="shrink-0" />
        <span>
          <b>{item.name}</b> {item.text}
        </span>
      </p>
    );
  }
  if (item.kind === "close") {
    return (
      <p className="draw-feed-in rounded-lg bg-[var(--draw-close-bg)] px-2 py-0.5 text-xs font-bold text-[var(--draw-close)] sm:text-sm">
        <b>Você:</b> {item.text} <span className="font-extrabold">— quase lá!</span>
      </p>
    );
  }
  if (item.kind === "system") {
    return (
      <p className="draw-feed-in px-2 py-0.5 text-center text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)] sm:text-xs">
        {item.text}
      </p>
    );
  }
  return (
    <p className="draw-feed-in break-words px-2 py-0.5 text-xs font-medium text-[var(--fg-muted)] sm:text-sm">
      <b className={item.kind === "own-wrong" ? "text-[var(--primary)]" : "text-[var(--fg)]"}>
        {item.kind === "own-wrong" ? "Você" : item.name}:
      </b>{" "}
      {item.text}
    </p>
  );
}

export function GuessPanel({
  isDrawer,
  canGuess,
  hasGuessed,
  players,
  drawerSocketId,
  mySocketId,
  feed,
  onSubmitGuess,
}: GuessPanelProps) {
  const [guess, setGuess] = useState("");
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const feedRef = useRef<HTMLDivElement>(null);

  // sempre mostra o chute mais recente
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [feed.length]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!guess.trim()) return;
    onSubmitGuess(guess.trim());
    setGuess("");
  }

  return (
    <div className="flex w-full shrink-0 flex-col gap-1.5 sm:gap-2 lg:min-h-0 lg:w-80 lg:flex-none">
      <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto overscroll-contain rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-1.5 lg:max-h-[45%] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:p-2">
        {sorted.map((p) => (
          <ScoreChip
            key={p.socketId}
            player={p}
            isMe={p.socketId === mySocketId}
            isDrawer={p.socketId === drawerSocketId}
          />
        ))}
      </div>

      <div
        ref={feedRef}
        className="flex h-[5.5rem] shrink-0 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-1.5 sm:h-28 lg:h-auto lg:min-h-0 lg:flex-1"
      >
        {feed.length === 0 && (
          <p className="m-auto text-center text-xs font-semibold text-[var(--fg-muted)]">
            {isDrawer ? "Os chutes aparecem aqui" : "Seus chutes aparecem aqui"}
          </p>
        )}
        {feed.map((item) => (
          <FeedLine key={item.id} item={item} />
        ))}
      </div>

      {!isDrawer &&
        (hasGuessed ? (
          <div className="animate-pop-in flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[var(--draw-ok)] bg-[var(--draw-ok-bg)] py-2.5 text-sm font-extrabold text-[var(--draw-ok)]">
            <Check size={16} strokeWidth={3} /> Você acertou! Aguarde os outros...
          </div>
        ) : (
          <form onSubmit={submit} className="flex shrink-0 gap-1.5">
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              disabled={!canGuess}
              maxLength={40}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={canGuess ? "Digite seu palpite..." : "Aguarde..."}
              // text-base (16px) no celular: abaixo disso o iOS da zoom ao focar o campo
              className="min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base font-semibold text-[var(--fg)] outline-none transition focus:border-[var(--primary)] disabled:opacity-60 sm:text-sm"
            />
            <button
              type="submit"
              aria-label="Enviar palpite"
              onMouseDown={(e) => e.preventDefault()}
              disabled={!canGuess || !guess.trim()}
              className="flex w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] text-white transition active:scale-90 disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          </form>
        ))}
    </div>
  );
}
