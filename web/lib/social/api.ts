import { createClient } from "@/lib/supabase/client";
import { rpcErrorMessage } from "@/lib/economy/errors";
import { parseFriends, parseInvites, type Friend, type GameInvite, type StatusInput } from "./rules";

/** Leitura que nunca lanca: RPC que ainda nao existe ou rede fora viram null. */
async function read(name: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    const { data, error } = await createClient().rpc(name, args);
    return error ? null : data;
  } catch {
    return null;
  }
}

/** Escrita: mostra a mensagem da regra do servidor; rede e infraestrutura viram texto padrao. */
async function write(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw new Error(rpcErrorMessage(error, "Não deu certo agora. Tente de novo."));
  return data;
}

export async function fetchFriends(): Promise<Friend[] | null> {
  return parseFriends(await read("my_friends"));
}

export async function fetchInvites(): Promise<GameInvite[] | null> {
  return parseInvites(await read("my_invites"), Date.now());
}

export async function fetchAppearOffline(): Promise<boolean | null> {
  const raw = await read("my_status");
  // RPC escrita como `returns table` chega como lista de uma linha
  const d = (Array.isArray(raw) ? raw[0] : raw) as { appear_offline?: unknown } | null;
  return d && typeof d.appear_offline === "boolean" ? d.appear_offline : null;
}

export async function pushStatus(s: StatusInput): Promise<void> {
  await read("set_status", {
    p_state: s.state,
    p_place: s.place,
    p_game: s.game,
    p_room_code: s.roomCode,
    p_players: s.players,
    p_max_players: s.maxPlayers,
  });
}

function requestStatus(data: unknown): "pending" | "accepted" {
  const d = Array.isArray(data) ? data[0] : data;
  return (d as { status?: unknown } | null)?.status === "accepted" ? "accepted" : "pending";
}

export async function sendFriendRequest(username: string): Promise<"pending" | "accepted"> {
  return requestStatus(await write("send_friend_request", { p_username: username }));
}

export async function sendFriendRequestTo(userId: string): Promise<"pending" | "accepted"> {
  return requestStatus(await write("send_friend_request_to", { p_user_id: userId }));
}

export async function respondFriendRequest(id: string, accept: boolean): Promise<void> {
  await write("respond_friend_request", { p_id: id, p_accept: accept });
}

export async function removeFriend(userId: string): Promise<void> {
  await write("remove_friend", { p_user_id: userId });
}

export async function sendGameInvite(toUserId: string, game: string, roomCode: string): Promise<void> {
  await write("send_game_invite", { p_to: toUserId, p_game: game, p_room_code: roomCode });
}

export async function respondGameInvite(id: string, accept: boolean): Promise<void> {
  await write("respond_game_invite", { p_id: id, p_accept: accept });
}

export async function setAppearOffline(value: boolean): Promise<void> {
  await write("set_appear_offline", { p_value: value });
}
