"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageCircle, Pencil, Send, Sparkles, Swords } from "lucide-react";
import { TEAM_INFO } from "@/lib/draw/modes";
import type { DrawPlayerPublic, FeedItem, Team } from "@/lib/draw/types";

interface GuessPanelProps {
  isDrawer: boolean;
  canGuess: boolean;
  hasGuessed: boolean;
  players: DrawPlayerPublic[];
  drawerId: string | null;
  myId: string;
  feed: FeedItem[];
  onSubmitGuess: (guess: string) => void;
  /** times: por que o input esta travado (adversario fora da janela de roubo) */
  guessBlockedReason?: string | null;
  stealOpen?: boolean;
  teamsView?: { drawerTeam: Team | null } | null;
  /** impostor: o painel vira chat */
  inputPlaceholder?: string;
  emptyFeedText?: string;
  /** cor por jogador (impostor: a cor do traco) */
  colorOf?: (id: string) => string;
  /** dentro de outra coluna: ocupa a altura que sobrar */
  fill?: boolean;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Chip do placar: pulsa e solta um "+N" flutuante quando a pontuacao sobe. */
function ScoreChip({
  player,
  isMe,
  isDrawer,
  showTeam,
  color,
}: {
  player: DrawPlayerPublic;
  isMe: boolean;
  isDrawer: boolean;
  showTeam: boolean;
  color: string;
}) {
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
      title={player.connected ? undefined : `${player.name} está reconectando`}
      className={`relative flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-1.5 py-1 lg:gap-2 lg:px-2 lg:py-1.5 ${
        delta ? "draw-bump" : ""
      } ${player.connected ? "" : "opacity-45"} ${
        player.hasGuessedThisTurn
          ? "border-[var(--draw-ok)] bg-[var(--draw-ok-bg)]"
          : isMe
            ? "border-[var(--primary)] bg-[var(--primary-tint)]"
            : "border-transparent bg-[var(--bg)]"
      }`}
    >
      <span
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white lg:h-7 lg:w-7 lg:text-xs"
        style={{ backgroundColor: showTeam ? TEAM_INFO[player.team].color : color }}
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
  if (item.kind === "steal") {
    return (
      <p className="draw-feed-in flex items-center gap-1.5 rounded-lg bg-[var(--danger-bg)] px-2 py-0.5 text-xs font-extrabold text-[var(--danger)] sm:text-sm">
        <Swords size={13} className="shrink-0" />
        <span>
          <b>{item.name}</b> {item.text}
        </span>
      </p>
    );
  }
  if (item.kind === "chat") {
    return (
      <p className="draw-feed-in flex items-start gap-1 break-words px-2 py-0.5 text-xs font-medium text-[var(--fg)] sm:text-sm">
        <MessageCircle size={12} className="mt-1 shrink-0 text-[var(--fg-muted)]" />
        <span>
          <b>{item.name}:</b> {item.text}
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
  drawerId,
  myId,
  feed,
  onSubmitGuess,
  guessBlockedReason = null,
  stealOpen = false,
  teamsView = null,
  inputPlaceholder,
  emptyFeedText,
  colorOf = colorFor,
  fill = false,
}: GuessPanelProps) {
  const [guess, setGuess] = useState("");
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const teamTotals = teamsView
    ? (["a", "b"] as const).map((team) => ({
        team,
        score: players.filter((p) => p.team === team).reduce((sum, p) => sum + p.score, 0),
      }))
    : null;
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
    <div
      className={`flex w-full flex-col gap-1.5 sm:gap-2 lg:min-h-0 ${
        fill ? "min-h-0 lg:flex-1" : "shrink-0 lg:w-80 lg:flex-none"
      }`}
    >
      {teamTotals && (
        <div className="grid shrink-0 grid-cols-2 gap-1.5">
          {teamTotals.map(({ team, score }) => (
            <div
              key={team}
              className={`flex items-center justify-between rounded-xl border-2 px-2.5 py-1 text-xs font-extrabold sm:text-sm ${
                teamsView?.drawerTeam === team ? "shadow-[0_3px_0_var(--border)]" : "opacity-80"
              }`}
              style={{ borderColor: TEAM_INFO[team].color, backgroundColor: TEAM_INFO[team].bg, color: TEAM_INFO[team].color }}
            >
              <span className="flex items-center gap-1 truncate">
                {teamsView?.drawerTeam === team && <Pencil size={11} />}
                {TEAM_INFO[team].label}
              </span>
              <span className="tabular-nums">{score}</span>
            </div>
          ))}
        </div>
      )}
      <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto overscroll-contain rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-1.5 lg:max-h-[45%] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:p-2">
        {sorted.map((p) => (
          <ScoreChip
            key={p.id}
            player={p}
            isMe={p.id === myId}
            isDrawer={p.id === drawerId}
            showTeam={!!teamsView}
            color={colorOf(p.id)}
          />
        ))}
      </div>

      <div
        ref={feedRef}
        className="flex h-[5.5rem] shrink-0 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-1.5 sm:h-28 lg:h-auto lg:min-h-0 lg:flex-1"
      >
        {feed.length === 0 && (
          <p className="m-auto text-center text-xs font-semibold text-[var(--fg-muted)]">
            {emptyFeedText ?? (isDrawer ? "Os chutes aparecem aqui" : "Seus chutes aparecem aqui")}
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
              maxLength={inputPlaceholder ? 80 : 40}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={
                guessBlockedReason ??
                (canGuess ? (inputPlaceholder ?? (stealOpen ? "Roube! Digite a palavra..." : "Digite seu palpite...")) : "Aguarde...")
              }
              // text-base (16px) no celular: abaixo disso o iOS da zoom ao focar o campo
              className={`min-w-0 flex-1 rounded-xl border-2 bg-[var(--bg)] px-3 py-2 text-base font-semibold text-[var(--fg)] outline-none transition focus:border-[var(--primary)] disabled:opacity-60 sm:text-sm ${
                stealOpen ? "border-[var(--danger)]" : "border-[var(--border)]"
              }`}
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
