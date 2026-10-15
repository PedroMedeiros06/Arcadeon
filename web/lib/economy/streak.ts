/** Valores do ciclo de 7 dias do spec (6.4); o servidor manda os dele em `rewards`. */
export const DEFAULT_STREAK_REWARDS = [10, 10, 15, 15, 20, 25, 50];

export interface ArcadeonStreak {
  streak: number;
  bestStreak: number;
  countedToday: boolean;
  /** posicao de hoje no ciclo, de 1 a 7 */
  cycleDay: number;
  claimedToday: boolean;
  rewards: number[];
}

/** done: dia passado do ciclo; claimable/claimed/waiting: hoje; upcoming: dias seguintes. */
export type SlotState = "done" | "claimable" | "claimed" | "waiting" | "upcoming";

export interface StreakSlot {
  day: number;
  reward: number;
  state: SlotState;
}

function count(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/** Retorno de `get_arcadeon_streak()`. null quando nao da pra confiar no formato. */
export function parseStreak(input: unknown): ArcadeonStreak | null {
  // RPC escrita como `returns table` chega como lista de uma linha
  const raw = Array.isArray(input) ? input[0] : input;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const streak = count(r.streak);
  const cycleDay = count(r.cycle_day);
  if (streak === null || cycleDay === null || cycleDay < 1 || cycleDay > 7) return null;
  const rewards =
    Array.isArray(r.rewards) && r.rewards.length === 7 && r.rewards.every((n) => count(n) !== null)
      ? (r.rewards as number[])
      : DEFAULT_STREAK_REWARDS;
  const claimedToday = r.claimed_today === true;
  return {
    streak,
    bestStreak: Math.max(count(r.best_streak) ?? 0, streak),
    // so da pra resgatar dia contado; se o servidor mandar os dois desencontrados, vale o resgate
    countedToday: r.counted_today === true || claimedToday,
    cycleDay,
    claimedToday,
    rewards,
  };
}

export function streakSlots(s: ArcadeonStreak): StreakSlot[] {
  return s.rewards.map((reward, i) => {
    const day = i + 1;
    let state: SlotState;
    if (day < s.cycleDay) state = "done";
    else if (day > s.cycleDay) state = "upcoming";
    else if (!s.countedToday) state = "waiting";
    else state = s.claimedToday ? "claimed" : "claimable";
    return { day, reward, state };
  });
}

export function todayReward(s: ArcadeonStreak): number {
  return s.rewards[s.cycleDay - 1];
}

/** Uma frase sobre o que fazer agora. Nunca fala em perder a sequencia. */
export function streakHint(s: ArcadeonStreak): string {
  if (!s.countedToday) return "Termine uma partida hoje pra contar o dia.";
  if (!s.claimedToday) return `Resgate ${todayReward(s)} moedas do dia ${s.cycleDay}.`;
  return s.cycleDay === 7 ? "Ciclo completo. Amanhã começa um novo." : `Volte amanhã pro dia ${s.cycleDay + 1}.`;
}
