import { GameCard } from "@/components/GameCard";
import { DailyTermoCard } from "@/components/DailyTermoCard";
import { games } from "@/lib/games";

export default function Home() {
  const multiplayer = games.filter((g) => g.multiplayer);
  const solo = games.filter((g) => !g.multiplayer);

  return (
    <main className="flex w-full flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <div className="animate-fade-up">
        <DailyTermoCard />
      </div>

      <section className="flex flex-col gap-4">
        <h2
          className="animate-fade-up font-display text-xl font-extrabold tracking-tight text-[var(--fg)]"
          style={{ animationDelay: "80ms" }}
        >
          Jogar com amigos
        </h2>
        {/* no celular vira uma fileira com rolagem lateral; a partir de sm, grade */}
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {multiplayer.map((game, i) => (
            <div
              key={game.slug}
              className="animate-fade-up w-[78%] shrink-0 snap-start sm:w-auto"
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              <GameCard game={game} />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--fg)]">Jogar sozinho</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {solo.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>
    </main>
  );
}
