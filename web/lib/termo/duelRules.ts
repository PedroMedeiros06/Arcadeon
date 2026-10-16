// Regras puras do Duelo (sem React nem Supabase): leitura do estado que vem de termo_duel_state e a
// pontuacao de "quem chegou mais perto". Quem decide o vencedor e' o banco; aqui e' so pra mostrar.

export type DuelStatus = "waiting" | "playing" | "finished" | "expired";
export type DuelEndReason = "solved" | "closest" | "forfeit" | "abandoned";
type Count = 1 | 2 | 4;

export interface DuelAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export interface DuelPlayer {
  userId: string;
  username: string;
  avatar: DuelAvatar;
  /** letras dos palpites: os meus sempre; os do rival so depois do fim */
  guesses: string[] | null;
  /** cores de cada palpite, um codigo "CPAAA" por tabuleiro */
  patterns: string[][];
  finishedAt: number | null;
  score: number | null;
  lastSeenAt: number | null;
}

export interface DuelState {
  id: string;
  code: string;
  boardCount: Count;
  maxAttempts: number;
  status: DuelStatus;
  hostId: string;
  guestId: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  winnerId: string | null;
  endReason: DuelEndReason | null;
  /** relogio do banco - relogio local, em ms (contagem e "rival sumiu" usam a hora do banco) */
  serverOffset: number;
  me: DuelPlayer;
  opponent: DuelPlayer | null;
  words: string[] | null;
}

export const DUEL_CODE = /^[A-HJ-NP-Z2-9]{5}$/;
/** sem sinal de vida por mais que isso, o rival pode ser dado como ausente */
export const ABANDON_MS = 60_000;

const STATUSES: DuelStatus[] = ["waiting", "playing", "finished", "expired"];
const REASONS: DuelEndReason[] = ["solved", "closest", "forfeit", "abandoned"];

const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
const time = (v: unknown) => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function words(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((w) => typeof w === "string" && /^[a-z]{5}$/.test(w)) ? (v as string[]) : null;
}

function patterns(v: unknown, boardCount: number): string[][] | null {
  if (!Array.isArray(v)) return null;
  const rows: string[][] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== boardCount || !row.every((c) => typeof c === "string" && /^[CPA]{5}$/.test(c)))
      return null;
    rows.push(row as string[]);
  }
  return rows;
}

function player(raw: unknown, boardCount: number): DuelPlayer | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const userId = str(p.user_id);
  const rows = patterns(p.patterns, boardCount);
  if (!userId || !rows) return null;
  const a = (p.avatar && typeof p.avatar === "object" ? p.avatar : {}) as Record<string, unknown>;
  const guesses = p.guesses == null ? null : words(p.guesses);
  if (p.guesses != null && (!guesses || guesses.length !== rows.length)) return null;
  return {
    userId,
    username: str(p.username) ?? "Jogador",
    avatar: { emoji: str(a.emoji), bgColor: str(a.bg_color), imageUrl: str(a.image_url) },
    guesses,
    patterns: rows,
    finishedAt: time(p.finished_at),
    score: num(p.score),
    lastSeenAt: time(p.last_seen_at),
  };
}

/** Retorno das RPCs termo_duel_*; null quando nao tem a forma esperada. */
export function parseDuelState(raw: unknown, localNow: number): DuelState | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const boardCount = d.board_count;
  if (boardCount !== 1 && boardCount !== 2 && boardCount !== 4) return null;
  const id = str(d.id);
  const code = str(d.code);
  const hostId = str(d.host_id);
  const status = STATUSES.find((s) => s === d.status);
  const me = player(d.me, boardCount);
  const serverNow = time(d.now);
  if (!id || !code || !DUEL_CODE.test(code) || !hostId || !status || !me || !me.guesses || serverNow === null) return null;
  const opponent = d.opponent == null ? null : player(d.opponent, boardCount);
  if (d.opponent != null && !opponent) return null;
  return {
    id,
    code,
    boardCount,
    maxAttempts: num(d.max_attempts) ?? boardCount + 5,
    status,
    hostId,
    guestId: str(d.guest_id),
    startedAt: time(d.started_at),
    finishedAt: time(d.finished_at),
    winnerId: str(d.winner_id),
    endReason: REASONS.find((r) => r === d.end_reason) ?? null,
    serverOffset: serverNow - localNow,
    me,
    opponent,
    words: d.words == null ? null : words(d.words),
  };
}

/** Pontos por tabuleiro: 10 se resolvido; senao a melhor linha (verde 2, amarelo 1). Igual ao banco. */
export function boardScores(rows: string[][], boardCount: number): number[] {
  return Array.from({ length: boardCount }, (_, b) => {
    let best = 0;
    for (const row of rows) {
      const code = row[b];
      if (code === "CCCCC") return 10;
      let v = 0;
      for (const c of code) v += c === "C" ? 2 : c === "P" ? 1 : 0;
      best = Math.max(best, v);
    }
    return best;
  });
}

/** Quantos tabuleiros o jogador ja resolveu. */
export function solvedCount(rows: string[][], boardCount: number): number {
  let n = 0;
  for (let b = 0; b < boardCount; b++) if (rows.some((r) => r[b] === "CCCCC")) n++;
  return n;
}

/** Rival sem sinal de vida ha mais de um minuto (pela hora do banco). */
export function opponentAway(state: DuelState, localNow: number): boolean {
  const seen = state.opponent?.lastSeenAt;
  return state.status === "playing" && seen != null && localNow + state.serverOffset - seen > ABANDON_MS;
}

/** Codigo digitado ou link colado ("…?join=K7M2Q"); null se nao for um codigo valido. */
export function normalizeDuelCode(input: string): string | null {
  const m = input.match(/join=([A-Za-z0-9]{5})/);
  const code = (m ? m[1] : input).trim().toUpperCase();
  return DUEL_CODE.test(code) ? code : null;
}
