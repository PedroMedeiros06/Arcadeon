import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { RaceRoom } from "./raceRooms";

/**
 * Estatisticas da Corrida pro leaderboard. O servidor e' a unica fonte: o cliente so
 * manda o access token do Supabase (evento "identify"), que e' verificado aqui.
 * Sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente, tudo vira no-op.
 */
let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[race-stats] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — ranking da Corrida desativado");
    client = null;
    return client;
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Valida o access token e devolve o id do usuario (ou null se invalido/sem config). */
export async function verifyAccessToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) return null;
  const supabase = getClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** Grava o resultado de cada jogador logado. Chamado uma vez quando a partida termina. */
export function recordRaceResults(room: RaceRoom): void {
  const supabase = getClient();
  if (!supabase) return;
  // sala esvaziada por abandono nao da vitoria (evita farmar vitoria com conta secundaria)
  const countsWin = room.endReason !== "players-left";
  const seen = new Set<string>();
  for (const player of room.players.values()) {
    // mesma conta em duas abas conta uma vez so
    if (!player.userId || seen.has(player.userId)) continue;
    seen.add(player.userId);
    supabase
      .rpc("record_race_result", {
        p_user_id: player.userId,
        p_won: countsWin && player.socketId === room.winnerSocketId,
        p_correct: player.correctCount,
        p_max_streak: player.maxStreak,
      })
      .then(({ error }) => {
        if (error) console.error("[race-stats] falha ao gravar resultado:", error.message);
      });
  }
}
