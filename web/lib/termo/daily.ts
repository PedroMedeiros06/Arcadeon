import { createClient } from "@/lib/supabase/client";
import { codeToStates, type BoardCount, type LetterState } from "./logic";

/** Letra revelada por dica: tabuleiro (0..), posicao (0..4) e letra. */
export interface Hint {
  board: number;
  pos: number;
  letter: string;
}

/** Estado da partida diaria devolvido pelo servidor (supabase termo_daily_state / termo_daily_guess). */
export interface DailyState {
  playDate: string;
  guesses: string[];
  evals: LetterState[][][];
  finished: boolean;
  won: boolean;
  attempts: number | null;
  timeSeconds: number | null;
  answers: string[] | null;
  hard: boolean;
  hints: Hint[];
  currentStreak: number | null;
  coinsAwarded: number;
  shieldsUsed: number;
  achievements: string[];
}

interface RawDailyState {
  play_date: string;
  guesses: string[];
  evaluations: string[][];
  finished: boolean;
  won: boolean | null;
  attempts: number | null;
  time_seconds: number | null;
  answers: string[] | null;
  hard?: boolean;
  hints?: { b: number; p: number; l: string }[];
  current_streak?: number | null;
  coins_awarded?: number;
  shields_used?: number;
  achievements?: string[];
}

const ANON_KEY_STORAGE = "termo_anon_key";

/** Identifica o aparelho de quem joga sem conta. O servidor usa tambem pra herdar a partida ao logar. */
export function getAnonKey(): string {
  let key = localStorage.getItem(ANON_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(ANON_KEY_STORAGE, key);
  }
  return key;
}

function parse(raw: RawDailyState): DailyState {
  return {
    playDate: raw.play_date,
    guesses: raw.guesses ?? [],
    evals: (raw.evaluations ?? []).map((boards) => boards.map(codeToStates)),
    finished: raw.finished,
    won: raw.won === true,
    attempts: raw.attempts,
    timeSeconds: raw.time_seconds,
    answers: raw.answers,
    hard: raw.hard === true,
    hints: (raw.hints ?? []).map((h) => ({ board: h.b, pos: h.p - 1, letter: h.l })),
    currentStreak: raw.current_streak ?? null,
    coinsAwarded: raw.coins_awarded ?? 0,
    shieldsUsed: raw.shields_used ?? 0,
    achievements: raw.achievements ?? [],
  };
}

/** Erro do banco com a mensagem pronta pra mostrar (ex.: regra do modo dificil, moedas insuficientes). */
export function errorMessage(err: unknown, fallback: string): string {
  const msg = (err as { message?: string } | null)?.message;
  // mensagens em portugues vem das nossas funcoes; o resto (rede, tecnico) vira o texto padrao
  return msg && /[À-ú]|^(A |Entre|Moedas|Limite|Esse|Não)/.test(msg) ? msg : fallback;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw error;
  return data as T;
}

export async function fetchDailyState(boardCount: BoardCount): Promise<DailyState> {
  return parse(await rpc<RawDailyState>("termo_daily_state", { p_board_count: boardCount, p_anon_key: getAnonKey() }));
}

export async function sendDailyGuess(boardCount: BoardCount, guess: string): Promise<DailyState> {
  return parse(
    await rpc<RawDailyState>("termo_daily_guess", { p_board_count: boardCount, p_anon_key: getAnonKey(), p_guess: guess }),
  );
}

/** So vale no Letrado (1 palavra) e antes do primeiro palpite; o servidor ignora nos outros casos. */
export async function setDailyHardMode(boardCount: BoardCount, hard: boolean): Promise<DailyState> {
  return parse(
    await rpc<RawDailyState>("termo_daily_set_hard", { p_board_count: boardCount, p_anon_key: getAnonKey(), p_hard: hard }),
  );
}

export async function requestDailyHint(boardCount: BoardCount, boardIndex: number): Promise<DailyState> {
  return parse(
    await rpc<RawDailyState>("termo_daily_hint", {
      p_board_count: boardCount,
      p_anon_key: getAnonKey(),
      p_board_index: boardIndex,
    }),
  );
}

/** Dica do Infinito: o banco so cobra as moedas; devolve o saldo novo. */
export async function payInfiniteHint(): Promise<number> {
  return rpc<number>("termo_spend_hint", {});
}

export async function buyStreakShield(): Promise<number> {
  return rpc<number>("buy_streak_shield", {});
}

export interface ModeStats {
  played: number;
  wins: number;
  distribution: number[];
  currentStreak: number | null;
  bestStreak: number | null;
}

export interface MyStats {
  modes: Record<BoardCount, ModeStats>;
  shields: number | null;
  speedBest: number | null;
}

interface RawModeStats {
  played: number;
  wins: number;
  distribution: number[] | null;
  current_streak: number | null;
  best_streak: number | null;
}

export async function fetchMyStats(): Promise<MyStats> {
  const raw = await rpc<Record<string, RawModeStats | number | null>>("termo_my_stats", { p_anon_key: getAnonKey() });
  const mode = (count: BoardCount): ModeStats => {
    const m = raw[String(count)] as RawModeStats | undefined;
    return {
      played: m?.played ?? 0,
      wins: m?.wins ?? 0,
      distribution: m?.distribution ?? Array(count + 5).fill(0),
      currentStreak: m?.current_streak ?? null,
      bestStreak: m?.best_streak ?? null,
    };
  };
  return {
    modes: { 1: mode(1), 2: mode(2), 4: mode(4) },
    shields: typeof raw.shields === "number" ? raw.shields : null,
    speedBest: typeof raw.speed_best === "number" ? raw.speed_best : null,
  };
}

export type DailyModeStatus = "not_started" | "playing" | "won" | "lost";

export interface DailyStatus {
  playDate: string;
  modes: Record<BoardCount, DailyModeStatus>;
  /** sequencia do Letrado (1 palavra); null sem conta */
  currentStreak: number | null;
}

/** Status do Diario de hoje por modo, sem criar partida (card da home). */
export async function fetchDailyStatus(): Promise<DailyStatus> {
  const raw = await rpc<{ play_date: string; modes: Record<string, DailyModeStatus>; current_streak: number | null }>(
    "termo_daily_status",
    { p_anon_key: getAnonKey() },
  );
  return {
    playDate: raw.play_date,
    modes: { 1: raw.modes["1"], 2: raw.modes["2"], 4: raw.modes["4"] },
    currentStreak: raw.current_streak,
  };
}

// ---------- Contra o Tempo ----------

export interface SpeedState {
  runId: string;
  /** ms que faltam, ja corrigido pela diferenca de relogio com o servidor */
  endsAt: number;
  finished: boolean;
  solved: number;
  guesses: string[];
  evals: LetterState[][][];
  history: { word: string; solved: boolean }[];
  /** ultimo palpite enviado; `word` vem quando a palavra encerrou (acertou ou gastou as 6) */
  last: { guess: string; states: LetterState[]; word?: string; solved?: boolean } | null;
}

interface RawSpeedState {
  run_id: string;
  ends_at: string;
  server_now: string;
  finished: boolean;
  solved: number;
  guesses: string[];
  evaluations: string[][];
  history: { word: string; solved: boolean }[];
  last: { guess: string; code: string; word?: string; solved?: boolean } | null;
}

function parseSpeed(raw: RawSpeedState): SpeedState {
  // converte o fim da rodada pro relogio local (o do aparelho pode estar adiantado/atrasado)
  const skew = Date.now() - new Date(raw.server_now).getTime();
  return {
    runId: raw.run_id,
    endsAt: new Date(raw.ends_at).getTime() + skew,
    finished: raw.finished,
    solved: raw.solved,
    guesses: raw.guesses ?? [],
    evals: (raw.evaluations ?? []).map((boards) => boards.map(codeToStates)),
    history: raw.history ?? [],
    last: raw.last
      ? { guess: raw.last.guess, states: codeToStates(raw.last.code), word: raw.last.word, solved: raw.last.solved }
      : null,
  };
}

export async function startSpeedRun(): Promise<SpeedState> {
  return parseSpeed(await rpc<RawSpeedState>("termo_speed_start", { p_anon_key: getAnonKey() }));
}

export async function sendSpeedGuess(runId: string, guess: string): Promise<SpeedState> {
  return parseSpeed(
    await rpc<RawSpeedState>("termo_speed_guess", { p_run_id: runId, p_anon_key: getAnonKey(), p_guess: guess }),
  );
}

export async function finishSpeedRun(runId: string): Promise<SpeedState> {
  return parseSpeed(await rpc<RawSpeedState>("termo_speed_finish", { p_run_id: runId, p_anon_key: getAnonKey() }));
}

/** Progresso do sistema antigo (antes do servidor validar), sem uso agora. */
export function clearLegacyProgress() {
  for (const count of [1, 2, 4]) localStorage.removeItem(`termo_daily_progress_${count}`);
}
