import Image from "next/image";
import { GameCard } from "@/components/GameCard";
import { games } from "@/lib/games";

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col px-6 py-8">
      <div className="animate-fade-up relative mb-10 overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-gradient-to-br from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)] px-8 py-10">
        <div className="relative z-10 max-w-md">
          <p className="mb-2 text-sm font-bold text-white/80">Bem-vindo ao</p>
          <h2 className="mb-3 text-4xl font-extrabold tracking-tight text-white">Arcadeon</h2>
          <p className="font-medium text-white/80">Seu hub de jogos, tudo em um só lugar.</p>
        </div>
        <Image
          src="/Logo@4x.png"
          alt=""
          width={220}
          height={220}
          className="animate-float-slow pointer-events-none absolute -right-10 -top-10 h-48 w-48 object-contain opacity-15 sm:h-60 sm:w-60"
        />
      </div>

      <h3 className="animate-fade-up mb-4 text-lg font-extrabold tracking-tight text-[var(--fg)]" style={{ animationDelay: "80ms" }}>
        Seus jogos
      </h3>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {games.map((game, i) => (
          <div key={game.slug} className="animate-fade-up" style={{ animationDelay: `${120 + i * 80}ms` }}>
            <GameCard game={game} />
          </div>
        ))}
      </div>

      <footer className="mt-8 border-t-2 border-[var(--border)] py-8 text-center text-sm font-medium text-[var(--fg-muted)]">
        © {new Date().getFullYear()} Arcadeon
      </footer>
    </main>
  );
}
