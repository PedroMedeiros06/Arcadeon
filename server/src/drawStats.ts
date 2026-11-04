import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { DrawPlayer, DrawRoom } from "./drawRooms";

/**
 * Economia do Rabiscado (moedas por partida e missoes). O servidor e' a unica fonte: o cliente so
 * manda o access token (evento "identify"), verificado com `verifyAccessToken` da Corrida.
 * Sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente, tudo vira no-op.
 */
let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[draw-stats] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — moedas do Rabiscado desativadas");
    client = null;
    return client;
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type MatchCoins = NonNullable<DrawPlayer["coins"]>;

/**
 * Colocacao de cada jogador (1 = primeiro, empate divide a posicao). Nos times vale o placar do
 * time: vencedor 1, perdedor 2, empate 1 pros dois.
 */
export function matchPlacements(room: DrawRoom): Map<string, number> {
  const players = Array.from(room.players.values());
  const out = new Map<string, number>();
  if (room.config.mode === "teams") {
    const total = (team: string) => players.filter((p) => p.team === team).reduce((s, p) => s + p.score, 0);
    const a = total("a");
    const b = total("b");
    for (const p of players) {
      const mine = p.team === "a" ? a : b;
      const other = p.team === "a" ? b : a;
      out.set(p.id, mine >= other ? 1 : 2);
    }
    return out;
  }
  for (const p of players) out.set(p.id, 1 + players.filter((q) => q.score > p.score).length);
  return out;
}

/**
 * Paga a partida de cada conta logada (mesma conta em duas abas recebe uma vez, pela melhor
 * colocacao). Chama mesmo com menos de 2 logados: a RPC paga 0 mas conta o dia e a missao.
 * `onPaid` recebe o id do jogador que fica com o resultado.
 */
export function awardDrawMatch(room: DrawRoom, matchId: string, onPaid: (playerId: string, coins: MatchCoins) => void): void {
  const supabase = getClient();
  if (!supabase) return;
  const placements = matchPlacements(room);
  const best = new Map<string, { playerId: string; placement: number }>();
  for (const p of room.players.values()) {
    if (!p.userId) continue;
    const placement = placements.get(p.id) ?? room.players.size;
    const prev = best.get(p.userId);
    if (!prev || placement < prev.placement) best.set(p.userId, { playerId: p.id, placement });
  }
  for (const [userId, { playerId, placement }] of best) {
    supabase
      .rpc("award_match_coins", {
        p_user_id: userId,
        p_game: "drawit",
        p_placement: placement,
        p_logged_players: best.size,
        p_match_id: `drawit:${matchId}`,
      })
      .then(({ data, error }) => {
        if (error) {
          console.error("[draw-stats] falha ao pagar partida:", error.message);
          return;
        }
        const d = (data ?? {}) as Record<string, unknown>;
        onPaid(playerId, {
          awarded: typeof d.awarded === "number" ? d.awarded : 0,
          capped: d.capped === true,
          coins: typeof d.coins === "number" ? d.coins : 0,
        });
      });
  }
}

/** Acerto de quem esta logado conta na missao "Acerte N desenhos". */
export function recordCorrectGuess(player: DrawPlayer): void {
  if (!player.userId) return;
  const supabase = getClient();
  if (!supabase) return;
  supabase
    .rpc("mission_progress", { p_user_id: player.userId, p_kind: "draw_correct_guess", p_amount: 1 })
    .then(({ error }) => {
      if (error) console.error("[draw-stats] falha na missao:", error.message);
    });
}
