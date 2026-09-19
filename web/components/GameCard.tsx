"use client";

import { Play } from "lucide-react";
import { useBlockTransition } from "@/lib/transition/TransitionProvider";
import type { GameInfo } from "@/lib/types";

export function GameCard({ game }: { game: GameInfo }) {
  const isAvailable = game.status === "available";
  const { navigate } = useBlockTransition();

  const card = (
    <div
      className={`group flex h-full flex-col rounded-3xl border-2 bg-[var(--card)] p-5 transition-all duration-300 ${
        isAvailable
          ? "border-[var(--border)] hover:-translate-y-1.5 hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/10"
          : "border-[var(--border)] opacity-60"
      }`}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-tint)] text-3xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
        {game.icon}
      </span>
      <h3 className="mb-1 text-lg font-extrabold tracking-tight text-[var(--fg)]">{game.title}</h3>
      <p className="mb-4 flex-1 text-sm font-medium text-[var(--fg-muted)]">{game.description}</p>

      {game.multiplayer && (
        <span className="mb-3 w-fit rounded-full border-2 border-[var(--primary)]/30 bg-[var(--primary-tint)] px-3 py-1 text-xs font-extrabold text-[var(--primary)]">
          Multiplayer
        </span>
      )}

      {isAvailable ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-2xl bg-[var(--primary)] px-4 py-2 text-sm font-extrabold text-white transition-transform duration-200 group-hover:scale-105">
          <Play className="h-4 w-4 fill-current transition-transform duration-200 group-hover:translate-x-0.5" /> Jogar
        </span>
      ) : (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-extrabold text-[var(--fg-muted)]">
          Em breve
        </span>
      )}
    </div>
  );

  if (!isAvailable) {
    return <div className="h-full cursor-not-allowed">{card}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/games/${game.slug}`)}
      className="block h-full w-full text-left"
    >
      {card}
    </button>
  );
}
