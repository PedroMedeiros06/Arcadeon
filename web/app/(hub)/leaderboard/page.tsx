import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { LeaderboardPageContent } from "@/components/leaderboard/LeaderboardPageContent";

export default function LeaderboardPage() {
  return (
    <main className="w-full flex-1 px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[var(--fg)]">Leaderboard</h2>
            <p className="text-sm font-medium text-[var(--fg-muted)]">Os melhores jogadores do Arcadeon</p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-extrabold text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Hub
        </Link>
      </div>

      <Suspense fallback={null}>
        <LeaderboardPageContent />
      </Suspense>
    </main>
  );
}
