const GAMES = ["termo", "buggle", "drawit", "corrida"];

export interface Mission {
  id: string;
  /** slug do jogo, ou null pra missao de qualquer jogo */
  game: string | null;
  text: string;
  target: number;
  progress: number;
  reward: number;
  completedAt: string | null;
}

export interface DailyMissions {
  day: string;
  missions: Mission[];
  chest: { reward: number; claimed: boolean };
}

function nonNegative(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseMission(raw: unknown): Mission | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const target = nonNegative(m.target);
  if (typeof m.id !== "string" || typeof m.text !== "string" || target === 0) return null;
  return {
    id: m.id,
    game: typeof m.game === "string" && GAMES.includes(m.game) ? m.game : null,
    text: m.text,
    target,
    progress: nonNegative(m.progress),
    reward: nonNegative(m.reward),
    completedAt: typeof m.completed_at === "string" ? m.completed_at : null,
  };
}

/** Retorno de `get_daily_missions()`. null quando nao sobra nenhuma missao valida. */
export function parseMissions(input: unknown): DailyMissions | null {
  // RPC escrita como `returns table` chega como lista de uma linha
  const raw = Array.isArray(input) ? input[0] : input;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.missions)) return null;
  const missions = r.missions.map(parseMission).filter((m): m is Mission => m !== null);
  if (missions.length === 0) return null;
  const chest = (r.chest && typeof r.chest === "object" ? r.chest : {}) as Record<string, unknown>;
  return {
    day: typeof r.day === "string" ? r.day : "",
    missions,
    chest: { reward: nonNegative(chest.reward), claimed: chest.claimed === true },
  };
}

export function missionDone(m: Mission): boolean {
  return m.completedAt !== null || m.progress >= m.target;
}

export function missionPercent(m: Mission): number {
  if (missionDone(m)) return 100;
  return Math.round((Math.min(m.progress, m.target) / m.target) * 100);
}

export function missionsDoneCount(d: DailyMissions): number {
  return d.missions.filter(missionDone).length;
}
