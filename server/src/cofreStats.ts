import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { CofreRoom, cofrePlacements } from "./cofreRooms";

/**
 * Moedas e ranking das salas online do Cofre. O cliente so manda o access token
 * (evento "identify"), validado com `verifyAccessToken` do raceStats.
 * Sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente, tudo vira no-op.
 */
let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[cofre-stats] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — moedas e ranking do Cofre desativados");
    client = null;
    return client;
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export interface CofreCoins {
  awarded: number;
  capped: boolean;
  coins: number;
}

function parseCoins(data: unknown): CofreCoins | null {
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (typeof d.awarded !== "number" || typeof d.coins !== "number") return null;
  return { awarded: d.awarded, capped: d.capped === true, coins: d.coins };
}

export interface CofreAccountResult {
  userId: string;
  socketIds: string[];
  /** 1 = venceu (empate divide o lugar) */
  place: number;
  pairs: number;
  points: number;
}

/**
 * Uma entrada por conta logada que terminou a partida na sala (quem saiu antes nao entra).
 * Mesma conta em duas abas vale uma vez, com a melhor colocacao.
 */
export function cofreAccountResults(room: CofreRoom): CofreAccountResult[] {
  const game = room.game;
  if (!game) return [];
  const places = cofrePlacements(room);
  const byUser = new Map<string, CofreAccountResult>();
  room.seats.forEach((socketId, i) => {
    const userId = room.players.get(socketId)?.userId;
    const score = game.players[i];
    if (!userId || !score || score.left) return;
    const place = places[i] ?? 0;
    const prev = byUser.get(userId);
    if (!prev) {
      byUser.set(userId, { userId, socketIds: [socketId], place, pairs: score.pairs, points: score.points });
      return;
    }
    prev.socketIds.push(socketId);
    if (place >= 1 && (prev.place < 1 || place < prev.place)) {
      prev.place = place;
      prev.pairs = score.pairs;
      prev.points = score.points;
    }
  });
  return Array.from(byUser.values());
}

/**
 * Fim da partida: ranking (record_cofre_result) e moedas (award_match_coins) de cada conta.
 * Sala esvaziada por abandono (players-left) nao paga, nao conta vitoria e nao entra no ranking:
 * evita farmar com conta secundaria saindo da sala.
 * Tudo e capturado agora: "Jogar de novo" zera a partida antes das RPCs voltarem.
 */
export function recordCofreMatch(room: CofreRoom, onCoins: (socketIds: string[], result: CofreCoins) => void): void {
  const supabase = getClient();
  if (!supabase || !room.matchId || room.endReason !== "finished") return;
  const matchId = room.matchId;
  const accounts = cofreAccountResults(room);
  for (const { userId, socketIds, place, pairs, points } of accounts) {
    supabase
      .rpc("record_cofre_result", { p_user_id: userId, p_won: place === 1, p_pairs: pairs, p_points: points })
      .then(({ error }) => {
        if (error) console.error("[cofre-stats] falha ao gravar resultado:", error.message);
      });
    supabase
      .rpc("award_match_coins", {
        p_user_id: userId,
        p_game: "cofre",
        p_placement: place,
        p_logged_players: accounts.length,
        p_match_id: matchId,
      })
      .then(({ data, error }) => {
        if (error) {
          console.error("[cofre-stats] falha ao pagar moedas:", error.message);
          return;
        }
        const result = parseCoins(data);
        if (result) onCoins(socketIds, result);
      });
  }
}
