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

export interface MatchCoinsResult {
  awarded: number;
  capped: boolean;
  coins: number;
}

function parseCoins(data: unknown): MatchCoinsResult | null {
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (typeof d.awarded !== "number" || typeof d.coins !== "number") return null;
  return { awarded: d.awarded, capped: d.capped === true, coins: d.coins };
}

/**
 * Moedas da partida (award_match_coins) e missao race_finish pra cada conta logada.
 * `onCoins` recebe os sockets daquela conta e o retorno da RPC (evento privado `coins-awarded`).
 * Abandono (players-left) nao paga nem conta missao, mesma regra da vitoria no ranking.
 */
export function awardRaceMatch(
  room: RaceRoom,
  placements: { socketId: string; userId: string | null }[],
  onCoins: (socketIds: string[], result: MatchCoinsResult) => void
): void {
  const supabase = getClient();
  if (!supabase || !room.matchId || room.endReason === "players-left") return;
  // tudo capturado agora: "Nova corrida" troca os objetos dos jogadores antes das RPCs voltarem
  const matchId = room.matchId;
  const byUser = new Map<string, { placement: number; socketIds: string[] }>();
  placements.forEach(({ socketId, userId }, i) => {
    if (!userId) return;
    const entry = byUser.get(userId);
    // mesma conta em duas abas: vale a melhor colocacao (ranking ja vem ordenado)
    if (entry) entry.socketIds.push(socketId);
    else byUser.set(userId, { placement: i + 1, socketIds: [socketId] });
  });
  const loggedPlayers = byUser.size;
  for (const [userId, { placement, socketIds }] of byUser) {
    supabase
      .rpc("award_match_coins", {
        p_user_id: userId,
        p_game: "corrida",
        p_placement: placement,
        p_logged_players: loggedPlayers,
        p_match_id: matchId,
      })
      .then(({ data, error }) => {
        if (error) return console.error("[race-stats] falha ao pagar moedas:", error.message);
        const result = parseCoins(data);
        if (result) onCoins(socketIds, result);
      });
    supabase
      .rpc("mission_progress", { p_user_id: userId, p_kind: "race_finish", p_amount: 1 })
      .then(({ error }) => {
        if (error) console.error("[race-stats] falha ao contar missao:", error.message);
      });
  }
}
