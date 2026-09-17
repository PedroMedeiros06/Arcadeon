import Link from "next/link";
import { Header } from "@/components/Header";
import { LeaderboardPageContent } from "@/components/leaderboard/LeaderboardPageContent";

export default function LeaderboardPage() {
  return (
    <>
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="mb-1 text-3xl font-extrabold tracking-tight text-[var(--fg)]">
              🏆 Leaderboard
            </h2>
            <p className="font-medium text-[var(--fg-muted)]">Os melhores jogadores do Arcadeon</p>
          </div>
          <Link
            href="/"
            className="rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-extrabold text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
          >
            ← Hub
          </Link>
        </div>

        <LeaderboardPageContent />
      </main>
    </>
  );
}
