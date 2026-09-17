import { Header } from "@/components/Header";
import { GameCard } from "@/components/GameCard";
import { games } from "@/lib/games";

export default function Home() {
  return (
    <>
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-4xl font-extrabold tracking-tight text-[var(--fg)] sm:text-5xl">
            Jogos disponíveis
          </h2>
          <p className="font-medium text-[var(--fg-muted)]">Escolha um jogo e comece a jogar agora mesmo</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </main>

      <footer className="border-t-2 border-[var(--border)] py-8 text-center text-sm font-medium text-[var(--fg-muted)]">
        © {new Date().getFullYear()} Arcadeon
      </footer>
    </>
  );
}
