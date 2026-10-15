"use client";

import { useEffect, useState } from "react";
import { Play, User, Users } from "lucide-react";
import { useBlockTransition } from "@/lib/transition/TransitionProvider";
import { formatCountdown, msUntilBrasiliaMidnight } from "@/lib/time";
import type { GameInfo } from "@/lib/types";
import { GAME_ICONS } from "./gameIcons";

/** Contagem ate a proxima palavra do dia. So aparece depois de montar, pra hidratacao bater. */
function useNextWordCountdown(enabled: boolean): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setLabel(formatCountdown(msUntilBrasiliaMidnight(Date.now())));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [enabled]);
  return label;
}

export function GameCard({ game, layout = "default" }: { game: GameInfo; layout?: "default" | "wide" }) {
  const isAvailable = game.status === "available";
  const wide = layout === "wide";
  const { navigate } = useBlockTransition();
  const Icon = GAME_ICONS[game.slug];
  const PlayersIcon = game.multiplayer ? Users : User;
  const countdown = useNextWordCountdown(wide && game.slug === "termo");

  const card = (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] transition-all duration-300 ${
        wide ? "sm:flex-row" : ""
      } ${
        isAvailable
          ? "hover:-translate-y-1 hover:border-[var(--border-hover)] hover:shadow-lg hover:shadow-black/5 group-active:scale-[0.98]"
          : "opacity-60"
      }`}
    >
      <div
        className={`pattern-${game.slug} relative flex items-end justify-between p-3 ${
          wide ? "h-28 shrink-0 sm:h-auto sm:w-56" : "h-24"
        }`}
        // cor inline cobre jogo novo que ainda nao tem classe pattern-* propria
        style={{ backgroundColor: game.accent }}
      >
        <span
          className={`flex items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${
            wide ? "h-14 w-14" : "h-11 w-11"
          }`}
        >
          {Icon && <Icon className={wide ? "h-8 w-8" : "h-6 w-6"} />}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg font-extrabold leading-tight tracking-tight text-[var(--fg)]">{game.title}</h3>
        <p className="flex-1 text-sm text-[var(--fg-muted)]">{game.description}</p>
        {countdown && (
          <p className="text-sm font-bold" style={{ color: game.accent }}>
            Nova palavra em {countdown}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {game.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ color: game.accent, backgroundColor: `color-mix(in srgb, ${game.accent} 14%, transparent)` }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          {isAvailable ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-extrabold text-white transition-transform duration-200 group-hover:scale-105"
              style={{ backgroundColor: game.accent }}
            >
              <Play className="h-4 w-4 fill-current" /> Jogar
            </span>
          ) : (
            <span className="inline-flex items-center rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-extrabold text-[var(--fg-muted)]">
              Em breve
            </span>
          )}
          <span className="flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)]">
            <PlayersIcon className="h-3.5 w-3.5" /> {game.players}
          </span>
        </div>
      </div>
    </div>
  );

  if (!isAvailable) {
    return <div className="h-full cursor-not-allowed">{card}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/games/${game.slug}`)}
      className="group block h-full w-full rounded-3xl text-left"
    >
      {card}
    </button>
  );
}
