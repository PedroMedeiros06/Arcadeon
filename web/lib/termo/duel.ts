import { createClient } from "@/lib/supabase/client";
import { rpcErrorMessage } from "@/lib/economy/errors";
import type { BoardCount } from "./logic";
import { parseDuelState, type DuelState } from "./duelRules";

/** Chamada que devolve o estado da sala; erro de regra do banco vira a mensagem dele. */
async function call(name: string, args: Record<string, unknown>): Promise<DuelState> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw new Error(rpcErrorMessage(error, "Não deu certo agora. Tente de novo."));
  const state = parseDuelState(data, Date.now());
  if (!state) throw new Error("Não deu certo agora. Tente de novo.");
  return state;
}

export const createDuel = (boardCount: BoardCount) => call("termo_duel_create", { p_board_count: boardCount });
export const joinDuel = (code: string) => call("termo_duel_join", { p_code: code });
export const startDuel = (code: string) => call("termo_duel_start", { p_code: code });
export const fetchDuel = (code: string) => call("termo_duel_state", { p_code: code });
export const guessDuel = (code: string, guess: string) => call("termo_duel_guess", { p_code: code, p_guess: guess });
/** Pede a revanche ou aceita a do rival (ai o duelo novo ja comeca). */
export const rematchDuel = (code: string) => call("termo_duel_rematch", { p_code: code });
export const claimDuel = (code: string) => call("termo_duel_claim", { p_code: code });

/** Desistir. Convidado saindo da sala de espera recebe null (a sala continua do dono). */
export async function forfeitDuel(code: string): Promise<DuelState | null> {
  const { data, error } = await createClient().rpc("termo_duel_forfeit", { p_code: code });
  if (error) throw new Error(rpcErrorMessage(error, "Não deu certo agora. Tente de novo."));
  return data == null ? null : parseDuelState(data, Date.now());
}

/** Sinal de vida; falha de rede nao importa (o proximo cobre). */
export async function pingDuel(code: string): Promise<void> {
  try {
    await createClient().rpc("termo_duel_ping", { p_code: code });
  } catch {
    // sem rede agora
  }
}

export async function fetchDuelRecord(friendId: string): Promise<{ wins: number; losses: number } | null> {
  try {
    const { data, error } = await createClient().rpc("termo_duel_record", { p_friend: friendId });
    const d = data as { wins?: unknown; losses?: unknown } | null;
    if (error || typeof d?.wins !== "number" || typeof d?.losses !== "number") return null;
    return { wins: d.wins, losses: d.losses };
  } catch {
    return null;
  }
}

/**
 * Avisa quando a sala ou um dos jogadores muda (Realtime). O evento so diz "mudou": quem chama busca o
 * estado de novo pela RPC, que e' a unica que sabe montar a visao de cada jogador.
 */
export function subscribeDuel(duelId: string, onChange: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    // topico unico por montagem: um canal antigo ainda saindo nao engole a assinatura nova
    .channel(`duel:${duelId}:${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "termo_duels", filter: `id=eq.${duelId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "termo_duel_players", filter: `duel_id=eq.${duelId}` }, onChange)
    // reconectou: o que mudou enquanto estava fora nao chega por evento
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onChange();
    });
  return () => {
    supabase.removeChannel(channel);
  };
}
