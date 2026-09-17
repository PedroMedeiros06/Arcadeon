import Link from "next/link";
import type { GameInfo } from "@/lib/types";

export function GameCard({ game }: { game: GameInfo }) {
  const isAvailable = game.status === "available";

  const card = (
    <div
      className={`flex h-full flex-col items-center justify-center rounded-3xl border-2 bg-[var(--card)] p-8 text-center transition-all duration-200 ${
        isAvailable
          ? "border-[var(--border)] shadow-[0_6px_0_var(--border)] hover:-translate-y-1 hover:border-[var(--primary)] hover:shadow-[0_8px_0_var(--primary-dark)]"
          : "border-[var(--border)] opacity-60 shadow-[0_6px_0_var(--border)]"
      }`}
    >
      <span className="mb-3 text-5xl">{game.icon}</span>
      <h3 className="mb-2 text-2xl font-extrabold tracking-tight text-[var(--fg)]">{game.title}</h3>
      <p className="mb-5 text-sm font-medium text-[var(--fg-muted)]">{game.description}</p>

      {game.multiplayer && (
        <span className="mb-3 rounded-full border-2 border-[#c9a8ff] bg-[#f3ebff] px-3 py-1 text-xs font-extrabold text-[#8b5cf6] dark:border-[#5b3d8a] dark:bg-[#2a1f3d] dark:text-[#c9a8ff]">
          Multiplayer
        </span>
      )}

      {isAvailable ? (
        <span className="mt-auto inline-block rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-2.5 text-sm font-extrabold text-white">
          Jogar
        </span>
      ) : (
        <span className="mt-auto inline-block rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-6 py-2.5 text-sm font-extrabold text-[var(--fg-muted)]">
          Em breve
        </span>
      )}
    </div>
  );

  if (!isAvailable) {
    return <div className="h-full cursor-not-allowed">{card}</div>;
  }

  return (
    <Link href={`/games/${game.slug}`} className="block h-full">
      {card}
    </Link>
  );
}
