import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Room } from "./rooms";

/**
 * Moedas e missoes do Buggle no fim da rodada. O cliente so manda o access token
 * (evento "identify"), validado com `verifyAccessToken` do raceStats.
 * Sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente, tudo vira no-op.
 */
let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[buggle-stats] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — moedas do Buggle desativadas");
    client = null;
    return client;
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export interface CoinsAwarded {
  awarded: number;
  capped: boolean;
  coins: number;
}

function parseCoins(data: unknown): CoinsAwarded | null {
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (typeof d.awarded !== "number" || typeof d.coins !== "number") return null;
  return { awarded: d.awarded, capped: d.capped === true, coins: d.coins };
}

/**
 * Paga cada conta logada uma vez (mesma conta em duas abas conta uma vez so, com a maior pontuacao).
 * Colocacao: 1 + quantos tiveram pontuacao maior (empate divide o lugar).
 * `onAwarded` recebe os sockets dessa conta (capturados agora: a proxima rodada zera os jogadores
 * antes das RPCs voltarem) e o retorno da RPC, pra mandar o evento privado `coins-awarded`.
 */
export function recordBuggleRound(
  room: Room,
  matchId: string,
  onAwarded: (socketIds: string[], result: CoinsAwarded) => void
): void {
  const supabase = getClient();
  if (!supabase) return;

  const best = new Map<string, { score: number; words: number; socketIds: string[] }>();
  for (const player of room.players.values()) {
    if (!player.userId) continue;
    const prev = best.get(player.userId);
    if (!prev) {
      best.set(player.userId, { score: player.score, words: player.foundWords.size, socketIds: [player.socketId] });
      continue;
    }
    prev.socketIds.push(player.socketId);
    if (player.score > prev.score) {
      prev.score = player.score;
      prev.words = player.foundWords.size;
    }
  }
  const scores = Array.from(room.players.values()).map((p) => p.score);

  for (const [userId, { score, words, socketIds }] of best) {
    const placement = 1 + scores.filter((s) => s > score).length;
    supabase
      .rpc("award_match_coins", {
        p_user_id: userId,
        p_game: "buggle",
        p_placement: placement,
        p_logged_players: best.size,
        p_match_id: matchId,
      })
      .then(({ data, error }) => {
        if (error) {
          console.error("[buggle-stats] falha ao pagar moedas:", error.message);
          return;
        }
        const result = parseCoins(data);
        if (result) onAwarded(socketIds, result);
      });
    if (words > 0) {
      supabase
        .rpc("mission_progress", { p_user_id: userId, p_kind: "buggle_words", p_amount: words })
        .then(({ error }) => {
          if (error) console.error("[buggle-stats] falha na missao:", error.message);
        });
    }
  }
}
