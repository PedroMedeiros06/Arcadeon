import { createClient } from "@/lib/supabase/client";
import { createOnce } from "@/lib/home/dailyCache";
import { parseStreak, type ArcadeonStreak } from "./streak";
import { parseMissions, type DailyMissions } from "./missions";

/** Leitura que nunca lanca: RPC que ainda nao existe (404) ou rede fora viram null. */
async function readRpc(name: string): Promise<unknown> {
  try {
    const { data, error } = await createClient().rpc(name);
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function fetchArcadeonStreak(): Promise<ArcadeonStreak | null> {
  return parseStreak(await readRpc("get_arcadeon_streak"));
}

/** Home e coluna lateral montam juntas: uma requisicao so. */
export const getArcadeonStreakShared = createOnce(fetchArcadeonStreak);

export async function fetchDailyMissions(): Promise<DailyMissions | null> {
  return parseMissions(await readRpc("get_daily_missions"));
}

export async function claimStreakReward(): Promise<{ coinsAwarded: number; coins: number }> {
  const { data, error } = await createClient().rpc("claim_streak_reward");
  // o servidor manda as mensagens em portugues, prontas pra mostrar
  if (error) throw new Error(error.message || "Não deu pra resgatar agora. Tente de novo.");
  const d = (data ?? {}) as { coins_awarded?: unknown; coins?: unknown };
  return { coinsAwarded: Number(d.coins_awarded) || 0, coins: Number(d.coins) || 0 };
}
