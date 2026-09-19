"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Medal, Flame, Trophy, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Avatar } from "@/components/Avatar";

interface ScoreRow {
  id: string;
  username: string;
  avatar_emoji: string | null;
  avatar_bg_color: string | null;
  avatar_image_url: string | null;
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
  streak: (row) => `${row.best_streak} seguidas`,
};

const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHT: Record<number, string> = { 0: "h-32", 1: "h-24", 2: "h-20" };
const MEDAL_COLORS = ["#facc15", "#c0c0c0", "#cd7f32"];

const MOCK_NAMES = [
  "shadow_wolf", "luna.exe", "kaio_pro", "nina_g", "byte_master", "vortex99", "aurora_x", "pixelfox",
  "raven_dev", "quill", "zen_master", "nova_star", "drift_king", "echo_9", "mira_rose", "blitz",
  "sombra", "kira_san", "orbit", "flux_92", "hexa", "wren", "solstice", "viper_x", "juno",
];

function buildMockScores(count: number): ScoreRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-${i}`,
    username: `${MOCK_NAMES[i % MOCK_NAMES.length]}${i >= MOCK_NAMES.length ? Math.floor(i / MOCK_NAMES.length) : ""}`,
    avatar_emoji: null,
    avatar_bg_color: null,
    avatar_image_url: null,
    board_count: 1,
    attempts: 1 + Math.floor(i / 4),
    time_seconds: 20 + i * 3,
    wins: Math.max(1, 40 - Math.floor(i / 2)),
    best_streak: Math.max(0, 20 - Math.floor(i / 3)),
    current_streak: Math.max(0, 10 - Math.floor(i / 5)),
  }));
}

export function LeaderboardPageContent() {
  const { username } = useAuth();
  const [boardCount, setBoardCount] = useState(1);
  const [category, setCategory] = useState<Category>("attempts");
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const useMock = useSearchParams().get("mock") === "1";

  useEffect(() => {
    if (useMock) {
      setScores(buildMockScores(100));
      return;
    }

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
      .select("id, username, avatar_emoji, avatar_bg_color, avatar_image_url, board_count, attempts, time_seconds, wins, best_streak, current_streak")
      .eq("board_count", boardCount);

    for (const [column, ascending] of orderColumns[category]) {
      query = query.order(column, { ascending });
    }

    query.limit(100).then(({ data }) => setScores(data ?? []));
  }, [boardCount, category, useMock]);

  const top3 = scores?.slice(0, 3) ?? [];
  const rest = scores?.slice(3) ?? [];

  const myRank = useMemo(() => {
    if (!scores || !username) return null;
    const idx = scores.findIndex((row) => row.username === username);
    return idx === -1 ? null : { row: scores[idx], position: idx + 1 };
  }, [scores, username]);

  return (
    <div className="flex select-none flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.count}
            onClick={() => setBoardCount(m.count)}
            className={`rounded-2xl border-2 px-4 py-2 text-sm font-extrabold transition-all duration-200 active:scale-95 ${
              boardCount === m.count
                ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:-translate-y-0.5 hover:bg-[var(--bg)]"
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
            className={`rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold uppercase transition-all duration-200 active:scale-95 ${
              category === c.key
                ? "border-[var(--accent-dark)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:-translate-y-0.5 hover:bg-[var(--bg)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex flex-1 flex-col gap-6">
        {!scores ? (
          <div className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] py-10 text-center text-sm font-medium text-[var(--fg-muted)]">
            Carregando ranking...
          </div>
        ) : scores.length === 0 ? (
          <div className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] py-10 text-center text-sm font-medium text-[var(--fg-muted)]">
            Ninguém jogou ainda. Seja o primeiro!
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-gradient-to-b from-[var(--primary)] to-[var(--primary-dark)] px-6 pb-0 pt-8">
              <div className="flex items-end justify-center gap-4">
                {PODIUM_ORDER.filter((i) => top3[i]).map((i, orderIdx) => {
                  const row = top3[i];
                  return (
                    <div
                      key={row.id}
                      className="animate-fade-up flex flex-col items-center"
                      style={{ animationDelay: `${orderIdx * 120}ms` }}
                    >
                      <span
                        className="animate-pop-in mb-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold text-[var(--primary-dark)]"
                        style={{ backgroundColor: MEDAL_COLORS[i], animationDelay: `${orderIdx * 120 + 300}ms` }}
                      >
                        {i + 1}
                      </span>
                      <div
                        className="mb-2 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 transition-transform duration-300 hover:scale-110"
                        style={{ borderColor: MEDAL_COLORS[i] }}
                      >
                        <Avatar
                          emoji={row.avatar_emoji}
                          bgColor={row.avatar_bg_color}
                          imageUrl={row.avatar_image_url}
                          fallbackLetter={row.username.charAt(0).toUpperCase()}
                          size="lg"
                        />
                      </div>
                      <p className="mb-0.5 max-w-[7rem] truncate text-center text-sm font-extrabold text-white">{row.username}</p>
                      <p className="mb-3 text-xs font-bold text-white/80">{VALUE_LABEL[category](row)}</p>
                      <div
                        className={`podium-bar w-24 origin-bottom rounded-t-2xl bg-white/15 ${PODIUM_HEIGHT[i]}`}
                        style={{ animationDelay: `${orderIdx * 120 + 150}ms` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {rest.length > 0 && (
              <div className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex flex-col gap-2">
                  {rest.map((row, i) => (
                    <div
                      key={row.id}
                      className={`animate-fade-up flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors duration-200 hover:border-[var(--primary)]/40 ${
                        row.username === username
                          ? "border-[var(--primary)] bg-[var(--primary-tint)]"
                          : "border-[var(--border)] bg-[var(--bg)]"
                      }`}
                      style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
                    >
                      <span className="w-8 text-center text-sm font-extrabold text-[var(--fg-muted)]">{i + 4}</span>
                      <Avatar
                        emoji={row.avatar_emoji}
                        bgColor={row.avatar_bg_color}
                        imageUrl={row.avatar_image_url}
                        fallbackLetter={row.username.charAt(0).toUpperCase()}
                        size="sm"
                      />
                      <span className="flex-1 truncate text-sm font-bold text-[var(--fg)]">{row.username}</span>
                      <span className="flex items-center gap-1 text-sm font-bold text-[var(--primary)]">
                        {category === "streak" && <Flame className="h-4 w-4" />}
                        {VALUE_LABEL[category](row)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <aside className="flex w-full flex-col gap-4 xl:w-80 xl:shrink-0">
        <div className="rounded-3xl border-2 border-[var(--border)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] p-6 text-white">
          <p className="mb-4 text-xs font-bold uppercase tracking-wide text-white/70">Suas estatísticas</p>

          {myRank ? (
            <>
              <div className="mb-4 flex items-center gap-4">
                <div>
                  <p className="text-xs font-bold text-white/70">Sua posição</p>
                  <p className="flex items-center gap-1.5 text-3xl font-extrabold">
                    <Trophy className="h-6 w-6" /> #{myRank.position}
                  </p>
                </div>
                <div className="h-10 w-px bg-white/20" />
                <div>
                  <p className="text-xs font-bold text-white/70">Vitórias</p>
                  <p className="text-2xl font-extrabold">{myRank.row.wins}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--card)] p-4 text-[var(--fg)]">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase text-[var(--fg-muted)]">
                  <Target className="h-3.5 w-3.5" /> Resultado atual
                </p>
                <p className="mb-1 text-lg font-extrabold text-[var(--fg)]">{VALUE_LABEL[category](myRank.row)}</p>
                <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--primary)]">
                  <Flame className="h-4 w-4" /> Sequência atual: {myRank.row.current_streak}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm font-medium text-white/80">
              {username ? "Você ainda não pontuou neste modo." : "Entre para ver suas estatísticas."}
            </p>
          )}
        </div>

        <div className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-6">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase text-[var(--fg-muted)]">
            <Medal className="h-3.5 w-3.5" /> Como pontuar
          </p>
          <p className="text-sm font-medium text-[var(--fg-muted)]">
            Jogue partidas de Termo para subir no ranking. Categorias avaliam tentativas, tempo, vitórias e sequência.
          </p>
        </div>
      </aside>
      </div>
    </div>
  );
}
