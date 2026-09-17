"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ScoreRow {
  id: string;
  username: string;
  board_count: number;
  attempts: number;
  time_seconds: number;
  wins: number;
  best_streak: number;
  current_streak: number;
}

type Category = "attempts" | "time" | "wins" | "streak";

const MODES = [
  { count: 1, label: "Termo" },
  { count: 2, label: "Dueto" },
  { count: 4, label: "Quarteto" },
];

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "attempts", label: "Menos tentativas" },
  { key: "time", label: "Menor tempo" },
  { key: "wins", label: "Mais vitórias" },
  { key: "streak", label: "Maior sequência" },
];

const VALUE_LABEL: Record<Category, (row: ScoreRow) => string> = {
  attempts: (row) => `${row.attempts} tentativas`,
  time: (row) => `${Math.floor(row.time_seconds / 60)}m ${row.time_seconds % 60}s`,
  wins: (row) => `${row.wins} vitórias`,
  streak: (row) => `🔥 ${row.best_streak}`,
};

export function LeaderboardPageContent() {
  const [boardCount, setBoardCount] = useState(1);
  const [category, setCategory] = useState<Category>("attempts");
  const [scores, setScores] = useState<ScoreRow[] | null>(null);

  useEffect(() => {
    setScores(null);
    const supabase = createClient();
    const orderColumns: Record<Category, [string, boolean][]> = {
      attempts: [
        ["attempts", true],
        ["time_seconds", true],
      ],
      time: [
        ["time_seconds", true],
        ["attempts", true],
      ],
      wins: [["wins", false]],
      streak: [["best_streak", false]],
    };

    let query = supabase
      .from("termo_leaderboard")
      .select("id, username, board_count, attempts, time_seconds, wins, best_streak, current_streak")
      .eq("board_count", boardCount);

    for (const [column, ascending] of orderColumns[category]) {
      query = query.order(column, { ascending });
    }

    query.limit(50).then(({ data }) => setScores(data ?? []));
  }, [boardCount, category]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        {MODES.map((m) => (
          <button
            key={m.count}
            onClick={() => setBoardCount(m.count)}
            className={`rounded-2xl border-2 px-4 py-2 text-sm font-extrabold transition ${
              boardCount === m.count
                ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold uppercase transition ${
              category === c.key
                ? "border-[var(--accent-dark)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-6">
        {!scores ? (
          <div className="flex items-center justify-center py-10 text-sm font-medium text-[var(--fg-muted)]">
            Carregando ranking...
          </div>
        ) : scores.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm font-medium text-[var(--fg-muted)]">
            Ninguém jogou ainda. Seja o primeiro!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {scores.map((row, i) => (
              <div
                key={row.id}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                  i === 0
                    ? "border-[var(--primary)] bg-[var(--primary-tint)]"
                    : "border-[var(--border)] bg-[var(--bg)]"
                }`}
              >
                <span className="w-8 text-center text-lg font-extrabold text-[var(--fg-muted)]">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <span className="flex-1 truncate text-sm font-bold text-[var(--fg)]">{row.username}</span>
                <span className="text-sm font-bold text-[var(--primary)]">{VALUE_LABEL[category](row)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
