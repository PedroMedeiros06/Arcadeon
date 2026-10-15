import { Suspense } from "react";
import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { LeaderboardPageContent } from "@/components/leaderboard/LeaderboardPageContent";

export const metadata: Metadata = {
  title: "Placares",
  description: "Ranking dos melhores jogadores do Arcadeon no Letrado e na Corrida do Conhecimento.",
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardPage() {
  return (
    <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--fg)]">Placares</h1>
            <p className="text-sm font-medium text-[var(--fg-muted)]">Os melhores jogadores do Arcadeon</p>
          </div>
        </div>

        <Suspense fallback={null}>
          <LeaderboardPageContent />
        </Suspense>
      </div>
    </main>
  );
}
