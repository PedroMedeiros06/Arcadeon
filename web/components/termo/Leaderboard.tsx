"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ScoreRow {
  id: string;
  username: string;
  attempts: number;
  time_seconds: number;
}

export function Leaderboard({ refreshKey, boardCount }: { refreshKey: number; boardCount: number }) {
  const [scores, setScores] = useState<ScoreRow[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("termo_leaderboard")
      .select("id, username, attempts, time_seconds")
      .eq("board_count", boardCount)
      .limit(10)
      .then(({ data }) => setScores(data ?? []));
  }, [refreshKey, boardCount]);

  if (!scores) {
    return (
      <div className="flex items-center justify-center py-6 text-sm font-medium text-[var(--fg-muted)]">
        Carregando ranking...
      </div>
    );
  }

  return (
    <div className="w-full py-2">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
        <Trophy className="h-4 w-4" /> Ranking
      </h3>

      <div className="flex flex-col gap-2 pb-2">
        {scores.map((row, i) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2"
          >
            <span className="w-6 text-center text-sm font-extrabold text-[var(--fg-muted)]">
              {i + 1}
            </span>
            <span className="flex-1 truncate text-sm font-bold text-[var(--fg)]">{row.username}</span>
            <span className="text-xs font-bold text-[var(--primary)]">{row.attempts} tent.</span>
            <span className="text-xs font-bold text-[var(--accent)]">
              {Math.floor(row.time_seconds / 60)}m {row.time_seconds % 60}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
