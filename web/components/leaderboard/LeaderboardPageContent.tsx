"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Medal, Flame, Trophy, Target, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { GAME_ICONS } from "@/components/gameIcons";
import { games } from "@/lib/games";

function GameIconBadge({ slug, accent }: { slug: string; accent: string }) {
  const Icon = GAME_ICONS[slug];
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: accent }}>
      {Icon && <Icon className="h-8 w-8" />}
    </span>
  );
}

interface BaseRow {
  id: string;
  username: string;
  avatar_emoji: string | null;
  avatar_bg_color: string | null;
  avatar_image_url: string | null;
  wins: number;
}

interface TermoRow extends BaseRow {
  board_count: number;
  attempts: number;
  time_seconds: number;
  best_streak: number;
  current_streak: number;
  /** so no Contra o Tempo: recorde de palavras em 3 minutos */
  best?: number;
}

interface RaceRow extends BaseRow {
  games_played: number;
  correct_answers: number;
  best_streak: number;
}

type TermoCategory = "today" | "attempts" | "time" | "wins" | "streak" | "speed";
type RaceCategory = "streak" | "correct" | "wins";

const TERMO_MODES = [
  { count: 1, label: "Letrado" },
  { count: 2, label: "Duplo" },
  { count: 4, label: "Quádruplo" },
];

const TERMO_CATEGORIES: { key: TermoCategory; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "attempts", label: "Menos tentativas" },
  { key: "time", label: "Menor tempo" },
  { key: "wins", label: "Mais vitórias" },
  { key: "streak", label: "Maior sequência" },
  { key: "speed", label: "Contra o Tempo" },
];

const TERMO_VALUE_LABEL: Record<TermoCategory, (row: TermoRow) => string> = {
  today: (row) => `${row.attempts} tent. · ${Math.floor(row.time_seconds / 60)}m ${row.time_seconds % 60}s`,
  speed: (row) => `${row.best ?? 0} palavras`,
  attempts: (row) => `${row.attempts} tentativas`,
  time: (row) => `${Math.floor(row.time_seconds / 60)}m ${row.time_seconds % 60}s`,
  wins: (row) => `${row.wins} vitórias`,
  streak: (row) => `${row.best_streak} seguidas`,
};

const RACE_CATEGORIES: { key: RaceCategory; label: string }[] = [
  { key: "streak", label: "Maior sequência" },
  { key: "correct", label: "Mais acertos" },
  { key: "wins", label: "Mais vitórias" },
];

const RACE_VALUE_LABEL: Record<RaceCategory, (row: RaceRow) => string> = {
  streak: (row) => `${row.best_streak} seguidas`,
  correct: (row) => `${row.correct_answers} acertos`,
  wins: (row) => `${row.wins} vitórias`,
};

const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHT: Record<number, string> = { 0: "h-32", 1: "h-24", 2: "h-20" };
const MEDAL_COLORS = ["#facc15", "#c0c0c0", "#cd7f32"];

const MOCK_NAMES = [
  "shadow_wolf", "luna.exe", "kaio_pro", "nina_g", "byte_master", "vortex99", "aurora_x", "pixelfox",
  "raven_dev", "quill", "zen_master", "nova_star", "drift_king", "echo_9", "mira_rose", "blitz",
  "sombra", "kira_san", "orbit", "flux_92", "hexa", "wren", "solstice", "viper_x", "juno",
];

function mockBase(i: number): BaseRow {
  return {
    id: `mock-${i}`,
    username: `${MOCK_NAMES[i % MOCK_NAMES.length]}${i >= MOCK_NAMES.length ? Math.floor(i / MOCK_NAMES.length) : ""}`,
    avatar_emoji: null,
    avatar_bg_color: null,
    avatar_image_url: null,
    wins: Math.max(1, 40 - Math.floor(i / 2)),
  };
}

function buildMockTermo(count: number): TermoRow[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockBase(i),
    board_count: 1,
    attempts: 1 + Math.floor(i / 4),
    time_seconds: 20 + i * 3,
    best_streak: Math.max(0, 20 - Math.floor(i / 3)),
    current_streak: Math.max(0, 10 - Math.floor(i / 5)),
  }));
}

function buildMockRace(count: number): RaceRow[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockBase(i),
    games_played: 60 - Math.floor(i / 2),
    correct_answers: Math.max(1, 400 - i * 4),
    best_streak: Math.max(1, 25 - Math.floor(i / 3)),
  }));
}

// jogos com ranking implementado; os demais aparecem como "Em breve"
const GAMES_WITH_RANKING = new Set(["termo", "corrida"]);

export function LeaderboardPageContent() {
  const searchParams = useSearchParams();
  const initialGame = searchParams.get("game");
  const [gameSlug, setGameSlug] = useState(
    games.some((g) => g.slug === initialGame) ? initialGame! : games[0].slug
  );
  const game = games.find((g) => g.slug === gameSlug) ?? games[0];

  function selectGame(slug: string) {
    setGameSlug(slug);
    const params = new URLSearchParams(searchParams.toString());
    params.set("game", slug);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  return (
    <div className="flex select-none flex-col gap-6">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {games.map((g) => {
          const active = g.slug === gameSlug;
          const Icon = GAME_ICONS[g.slug];
          return (
            <button
              key={g.slug}
              onClick={() => selectGame(g.slug)}
              className={`flex shrink-0 items-center gap-2.5 rounded-2xl border-2 px-4 py-3 text-sm font-extrabold transition-all duration-200 active:scale-95 ${
                active
                  ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white shadow-[0_4px_0_var(--primary-dark)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] shadow-[0_4px_0_var(--border)] hover:-translate-y-0.5 hover:bg-[var(--bg)]"
              }`}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: active ? "rgb(255 255 255 / 0.2)" : g.accent }}
              >
                {Icon && <Icon className="h-4 w-4" />}
              </span>
              {g.title}
              {!GAMES_WITH_RANKING.has(g.slug) && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold tracking-wide ${
                    active ? "bg-white/20 text-white" : "bg-[var(--bg)] text-[var(--fg-muted)]"
                  }`}
                >
                  Em breve
                </span>
              )}
            </button>
          );
        })}
      </div>

      {game.slug === "termo" ? (
        <TermoLeaderboard />
      ) : game.slug === "corrida" ? (
        <RaceLeaderboard />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
          <GameIconBadge slug={game.slug} accent={game.accent} />
          <p className="text-lg font-extrabold text-[var(--fg)]">Ranking do {game.title} em breve</p>
          <p className="max-w-sm text-sm font-medium text-[var(--fg-muted)]">
            Ainda estamos preparando o ranking deste jogo. Enquanto isso, jogue algumas partidas pra treinar!
          </p>
        </div>
      )}
    </div>
  );
}

function ChipRow<K extends string | number>({
  items,
  value,
  onChange,
  variant,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  variant: "mode" | "category";
}) {
  const activeClass =
    variant === "mode"
      ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
      : "border-[var(--accent-dark)] bg-[var(--accent)] text-white";
  const baseClass =
    variant === "mode"
      ? "rounded-2xl px-4 py-2 text-sm"
      : "rounded-xl px-3 py-1.5 text-xs uppercase";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={`border-2 font-extrabold transition-all duration-200 active:scale-95 ${baseClass} ${
            value === item.key
              ? activeClass
              : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:-translate-y-0.5 hover:bg-[var(--bg)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TermoLeaderboard() {
  const [boardCount, setBoardCount] = useState(1);
  const [category, setCategory] = useState<TermoCategory>("today");
  const [scores, setScores] = useState<TermoRow[] | null>(null);
  const useMock = useSearchParams().get("mock") === "1";

  useEffect(() => {
    if (useMock) {
      setScores(buildMockTermo(100));
      return;
    }

    setScores(null);
    const supabase = createClient();
    const avatarCols = "id, username, avatar_emoji, avatar_bg_color, avatar_image_url";
    const blank = { wins: 0, board_count: boardCount, attempts: 0, time_seconds: 0, best_streak: 0, current_streak: 0 };

    // "Hoje": vitorias do Diario de hoje (zera todo dia); ja vem ordenado pela view
    if (category === "today") {
      supabase
        .from("termo_daily_leaderboard")
        .select(`${avatarCols}, attempts, time_seconds`)
        .eq("board_count", boardCount)
        .limit(100)
        .then(({ data }) => setScores((data ?? []).map((r) => ({ ...blank, ...r }) as TermoRow)));
      return;
    }
    // Contra o Tempo nao depende do modo de tabuleiros
    if (category === "speed") {
      supabase
        .from("termo_speed_leaderboard")
        .select(`${avatarCols}, best`)
        .limit(100)
        .then(({ data }) => setScores((data ?? []).map((r) => ({ ...blank, ...r }) as TermoRow)));
      return;
    }

    const orderColumns: Record<"attempts" | "time" | "wins" | "streak", [string, boolean][]> = {
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

  return (
    <>
      <ChipRow
        items={TERMO_MODES.map((m) => ({ key: m.count, label: m.label }))}
        value={boardCount}
        onChange={setBoardCount}
        variant="mode"
      />
      <ChipRow items={TERMO_CATEGORIES} value={category} onChange={setCategory} variant="category" />
      <RankingBoard
        rows={scores}
        valueLabel={TERMO_VALUE_LABEL[category]}
        showFlame={category === "streak"}
        emptyStatsText="Você ainda não pontuou neste modo."
        howToScore="Jogue o Letrado diário para subir no ranking. A categoria Hoje zera todo dia; as outras avaliam tentativas, tempo, vitórias, sequência e o recorde no Contra o Tempo."
        myDetails={(row) => (
          <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--primary)]">
            <Flame className="h-4 w-4" /> Sequência atual: {row.current_streak}
          </p>
        )}
      />
    </>
  );
}

function RaceLeaderboard() {
  const [category, setCategory] = useState<RaceCategory>("streak");
  const [scores, setScores] = useState<RaceRow[] | null>(null);
  const useMock = useSearchParams().get("mock") === "1";

  useEffect(() => {
    if (useMock) {
      setScores(buildMockRace(100));
      return;
    }

    setScores(null);
    const supabase = createClient();
    // desempate: quem chegou nisso jogando menos partidas fica na frente
    const orderColumn: Record<RaceCategory, string> = {
      streak: "best_streak",
      correct: "correct_answers",
      wins: "wins",
    };

    supabase
      .from("race_leaderboard")
      .select("id, username, avatar_emoji, avatar_bg_color, avatar_image_url, games_played, wins, correct_answers, best_streak")
      .gt(orderColumn[category], 0)
      .order(orderColumn[category], { ascending: false })
      .order("games_played", { ascending: true })
      .limit(100)
      .then(({ data }) => setScores(data ?? []));
  }, [category, useMock]);

  return (
    <>
      <ChipRow items={RACE_CATEGORIES} value={category} onChange={setCategory} variant="category" />
      <RankingBoard
        rows={scores}
        valueLabel={RACE_VALUE_LABEL[category]}
        showFlame={category === "streak"}
        emptyStatsText="Você ainda não pontuou nesta categoria."
        howToScore="Termine corridas logado para subir no ranking. Conta sua maior sequência de acertos numa partida, o total de respostas certas e as vitórias."
        myDetails={(row) => (
          <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--primary)]">
            <CheckCircle2 className="h-4 w-4" /> {row.games_played}{" "}
            {row.games_played === 1 ? "partida jogada" : "partidas jogadas"}
          </p>
        )}
      />
    </>
  );
}

function RankingBoard<T extends BaseRow>({
  rows,
  valueLabel,
  showFlame,
  emptyStatsText,
  howToScore,
  myDetails,
}: {
  rows: T[] | null;
  valueLabel: (row: T) => string;
  showFlame: boolean;
  emptyStatsText: string;
  howToScore: string;
  myDetails: (row: T) => ReactNode;
}) {
  const { username } = useAuth();
  const top3 = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];

  const myRank = useMemo(() => {
    if (!rows || !username) return null;
    const idx = rows.findIndex((row) => row.username === username);
    return idx === -1 ? null : { row: rows[idx], position: idx + 1 };
  }, [rows, username]);

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex flex-1 flex-col gap-6">
        {!rows ? (
          <div className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] py-10 text-center text-sm font-medium text-[var(--fg-muted)]">
            Carregando ranking...
          </div>
        ) : rows.length === 0 ? (
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
                      <p className="mb-3 text-xs font-bold text-white/80">{valueLabel(row)}</p>
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
                        {showFlame && <Flame className="h-4 w-4" />}
                        {valueLabel(row)}
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
                <p className="mb-1 text-lg font-extrabold text-[var(--fg)]">{valueLabel(myRank.row)}</p>
                {myDetails(myRank.row)}
              </div>
            </>
          ) : (
            <p className="text-sm font-medium text-white/80">
              {username ? emptyStatsText : "Entre para ver suas estatísticas."}
            </p>
          )}
        </div>

        <div className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-6">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase text-[var(--fg-muted)]">
            <Medal className="h-3.5 w-3.5" /> Como pontuar
          </p>
          <p className="text-sm font-medium text-[var(--fg-muted)]">{howToScore}</p>
        </div>
      </aside>
    </div>
  );
}
