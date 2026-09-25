"use client";

import { useEffect, useState } from "react";
import { Lightbulb, Skull, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ScoreRow {
  id: string;
  username: string;
  attempts: number;
  time_seconds: number;
  hard?: boolean;
  hints_used?: number;
}

type Scope = "today" | "all";

/**
 * Ranking do modo. "Hoje" zera todo dia (vitorias do Diario de hoje; quem usou dica fica depois);
 * "Geral" e o melhor resultado de sempre.
 */
export function Leaderboard({ refreshKey, boardCount }: { refreshKey: number; boardCount: number }) {
  const [scope, setScope] = useState<Scope>("today");
  const [result, setResult] = useState<{ key: string; rows: ScoreRow[] } | null>(null);
  const requestKey = `${scope}-${boardCount}-${refreshKey}`;

  useEffect(() => {
    const supabase = createClient();
    const query =
      scope === "today"
        ? supabase
            .from("termo_daily_leaderboard")
            .select("id, username, attempts, time_seconds, hard, hints_used")
            .eq("board_count", boardCount)
        : supabase.from("termo_leaderboard").select("id, username, attempts, time_seconds").eq("board_count", boardCount);
    query.limit(10).then(({ data }) => setResult({ key: requestKey, rows: (data as ScoreRow[] | null) ?? [] }));
  }, [scope, boardCount, requestKey]);

  const scores = result?.key === requestKey ? result.rows : null;

  return (
    <div className="w-full py-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
          <Trophy className="h-4 w-4" /> Ranking
        </h3>
        <div className="flex rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] p-0.5">
          {(["today", "all"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={`rounded-lg px-2.5 py-0.5 text-xs font-bold transition ${
                scope === s ? "bg-[var(--primary)] text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              {s === "today" ? "Hoje" : "Geral"}
            </button>
          ))}
        </div>
      </div>

      {!scores ? (
        <div className="flex items-center justify-center py-6 text-sm font-medium text-[var(--fg-muted)]">
          Carregando ranking...
        </div>
      ) : scores.length === 0 ? (
        <p className="py-6 text-center text-sm font-medium text-[var(--fg-muted)]">
          {scope === "today" ? "Ninguém venceu hoje ainda. Seja o primeiro!" : "Ninguém pontuou neste modo ainda."}
        </p>
      ) : (
        <div className="flex flex-col gap-2 pb-2">
          {scores.map((row, i) => (
            <div
              key={row.id}
              className="flex items-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            >
              <span className="w-6 text-center text-sm font-extrabold text-[var(--fg-muted)]">{i + 1}</span>
              <span className="flex flex-1 items-center gap-1.5 truncate text-sm font-bold text-[var(--fg)]">
                <span className="truncate">{row.username}</span>
                {row.hard && <Skull className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" aria-label="modo difícil" />}
                {!!row.hints_used && (
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[var(--termo-present)]" aria-label="usou dica" />
                )}
              </span>
              <span className="text-xs font-bold text-[var(--primary)]">{row.attempts} tent.</span>
              <span className="text-xs font-bold text-[var(--accent)]">
                {Math.floor(row.time_seconds / 60)}m {row.time_seconds % 60}s
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
