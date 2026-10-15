export type Place = "hub" | "shop" | "leaderboard" | "profile" | "lobby" | "match";
export type PresenceState = "online" | "playing";

/** O que o proprio usuario manda em `set_status`. */
export interface StatusInput {
  state: PresenceState;
  place: Place;
  game: string | null;
  roomCode: string | null;
  players: number | null;
  maxPlayers: number | null;
}

/** Status de um amigo, como vem de `my_friends()`. */
export interface Presence extends StatusInput {
  updatedAt: string;
}

export interface FriendAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  avatar: FriendAvatar;
  status: "accepted" | "pending";
  direction: "incoming" | "outgoing" | null;
  presence: Presence | null;
}

export interface GameInvite {
  id: string;
  game: string;
  roomCode: string;
  expiresAt: string;
  from: { userId: string; username: string; avatar: FriendAvatar };
}

/** Nome publico do jogo e as preposicoes que ele pede ("do Rabiscado", "na Corrida", "pro Letrado"). */
export const GAME_NAMES: Record<string, { name: string; of: string; at: string; to: string }> = {
  termo: { name: "Letrado", of: "do", at: "no", to: "pro" },
  buggle: { name: "Buggle", of: "do", at: "no", to: "pro" },
  drawit: { name: "Rabiscado", of: "do", at: "no", to: "pro" },
  corrida: { name: "Corrida", of: "da", at: "na", to: "pra" },
};
const MULTIPLAYER = ["buggle", "drawit", "corrida"];
const PLACES: Place[] = ["hub", "shop", "leaderboard", "profile", "lobby", "match"];
export const OFFLINE_AFTER_MS = 120_000;

const EMPTY = { game: null, roomCode: null, players: null, maxPlayers: null };

export function routeStatus(pathname: string): { kind: "hub"; place: Place } | { kind: "game"; game: string } {
  const game = pathname.match(/^\/games\/([^/?#]+)/);
  if (game) return { kind: "game", game: game[1] };
  if (pathname.startsWith("/shop")) return { kind: "hub", place: "shop" };
  if (pathname.startsWith("/leaderboard")) return { kind: "hub", place: "leaderboard" };
  if (pathname.startsWith("/profile") || pathname.startsWith("/inventory")) return { kind: "hub", place: "profile" };
  return { kind: "hub", place: "hub" };
}

/** Status que a troca de pagina manda. null = manter o atual (a sessao do jogo e quem marca sala e partida). */
export function nextStatus(current: StatusInput | null, pathname: string): StatusInput | null {
  const route = routeStatus(pathname);
  if (route.kind === "hub") return { state: "online", place: route.place, ...EMPTY };
  if (current?.game === route.game) return null;
  return { state: "online", place: "hub", ...EMPTY, game: route.game };
}

// relogio de quem ve pode estar um pouco atrasado; batida mais no futuro que isso nao vale
const FUTURE_TOLERANCE_MS = 60_000;

function sinceMs(p: Presence, now: number): number | null {
  const at = Date.parse(p.updatedAt);
  if (Number.isNaN(at) || at - now > FUTURE_TOLERANCE_MS) return null;
  return Math.max(0, now - at);
}

export function isOnline(p: Presence | null, now: number): boolean {
  if (!p) return false;
  const since = sinceMs(p, now);
  return since !== null && since < OFFLINE_AFTER_MS;
}

export function timeAgo(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

export function presenceText(p: Presence | null, now: number): { label: string; tone: "playing" | "online" | "offline" } {
  if (!p || !isOnline(p, now)) {
    const since = p ? sinceMs(p, now) : null;
    return { label: since === null ? "Offline" : `Offline · visto ${timeAgo(since)}`, tone: "offline" };
  }
  const g = p.game ? GAME_NAMES[p.game] : undefined;
  if (p.state === "playing") {
    if (!g) return { label: "Jogando", tone: "playing" };
    const room = p.players && p.maxPlayers ? ` · ${p.players} de ${p.maxPlayers} na sala` : "";
    return { label: `Jogando ${g.name}${room}`, tone: "playing" };
  }
  let where: string | null = null;
  if (p.place === "lobby" && g) where = `na sala de espera ${g.of} ${g.name}`;
  else if (p.place === "shop") where = "na loja";
  else if (p.place === "leaderboard") where = "nos placares";
  else if (p.place === "profile") where = "no perfil";
  else if (g) where = `${g.at} ${g.name}`;
  return { label: where ? `Online · ${where}` : "Online", tone: "online" };
}

/** Link do botao "Entrar" no amigo que esta numa sala de jogo em grupo. */
export function joinHref(p: Presence | null, now: number): string | null {
  if (!p || !isOnline(p, now) || !p.roomCode || !p.game) return null;
  if (p.place !== "lobby" && p.place !== "match") return null;
  if (!MULTIPLAYER.includes(p.game)) return null;
  return `/games/${p.game}?join=${p.roomCode}`;
}

export function sortFriends<T extends { username: string; presence: Presence | null }>(list: T[], now: number): T[] {
  const rank = (f: T) => (!isOnline(f.presence, now) ? 2 : f.presence!.state === "playing" ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username, "pt-BR"));
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

function parseAvatar(raw: unknown): FriendAvatar {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { emoji: str(a.emoji), bgColor: str(a.bg_color), imageUrl: str(a.image_url) };
}

function parsePresence(raw: unknown): Presence | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const updatedAt = str(p.updated_at);
  if ((p.state !== "online" && p.state !== "playing") || !PLACES.includes(p.place as Place) || !updatedAt) return null;
  return {
    state: p.state,
    place: p.place as Place,
    game: str(p.game),
    roomCode: str(p.room_code),
    players: num(p.players),
    maxPlayers: num(p.max_players),
    updatedAt,
  };
}

/** Retorno de `my_friends()`. null quando a RPC nao respondeu uma lista. */
export function parseFriends(raw: unknown): Friend[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Friend[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const friendshipId = str(r.friendship_id);
    const userId = str(r.user_id);
    const username = str(r.username);
    if (!friendshipId || !userId || !username || (r.status !== "accepted" && r.status !== "pending")) continue;
    out.push({
      friendshipId,
      userId,
      username,
      avatar: parseAvatar(r.avatar),
      status: r.status,
      direction: r.direction === "incoming" || r.direction === "outgoing" ? r.direction : null,
      presence: r.status === "accepted" ? parsePresence(r.presence) : null,
    });
  }
  return out;
}

export function splitFriends(list: Friend[]) {
  return {
    friends: list.filter((f) => f.status === "accepted"),
    incoming: list.filter((f) => f.status === "pending" && f.direction === "incoming"),
    outgoing: list.filter((f) => f.status === "pending" && f.direction === "outgoing"),
  };
}

/** Aceita "@raposa", " raposa " ou o link pessoal colado. null quando nao pode ser um nome. */
export function normalizeUsername(input: string): string | null {
  let s = input.trim();
  // link colado do WhatsApp vem com ?utm, #ancora ou pontuacao da frase
  const link = s.match(/\/amigo\/([^/?#\s]+)/);
  if (link) s = link[1];
  s = s.replace(/^@/, "").trim().replace(/[.,;:!?]+$/, "");
  return /^[A-Za-z0-9_.-]{3,20}$/.test(s) ? s : null;
}

/** Retorno de `my_invites()`, sem os vencidos e sem jogo que o site nao conhece. */
export function parseInvites(raw: unknown, now: number): GameInvite[] | null {
  if (!Array.isArray(raw)) return null;
  const out: GameInvite[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = str(r.id);
    const game = str(r.game);
    const roomCode = str(r.room_code);
    const expiresAt = str(r.expires_at);
    const from = (r.from && typeof r.from === "object" ? r.from : null) as Record<string, unknown> | null;
    const fromId = str(from?.user_id);
    const fromName = str(from?.username);
    if (!id || !game || !MULTIPLAYER.includes(game) || !roomCode || !expiresAt || !fromId || !fromName) continue;
    const expires = Date.parse(expiresAt);
    if (Number.isNaN(expires) || expires <= now) continue;
    out.push({ id, game, roomCode, expiresAt, from: { userId: fromId, username: fromName, avatar: parseAvatar(from?.avatar) } });
  }
  return out;
}

export function inviteText(i: GameInvite): string {
  const g = GAME_NAMES[i.game];
  return `${i.from.username} te chamou ${g.to} ${g.name}`;
}

export function inviteHref(i: GameInvite): string {
  return `/games/${i.game}?join=${i.roomCode}`;
}

/** Convites que ainda valem agora (a lista fica aberta e eles vencem). */
export function liveInvites(list: GameInvite[], now: number): GameInvite[] {
  return list.filter((i) => Date.parse(i.expiresAt) > now);
}

/**
 * Ja estando na rota do jogo, trocar so o `?join=` nao faz o jogo entrar na sala nova
 * (ele le o codigo ao montar); nesse caso a pagina recarrega.
 */
export function inviteNavigation(pathname: string, href: string): "push" | "reload" {
  const target = href.split("?")[0];
  return pathname === target || pathname.startsWith(`${target}/`) ? "reload" : "push";
}

/**
 * Aplica uma batida recebida pelo Realtime na lista em memoria.
 * null quando a linha nao e de um amigo aceito (ai nao ha o que mudar).
 */
export function applyStatusRow(list: Friend[], row: unknown): Friend[] | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const index = list.findIndex((f) => f.userId === r.user_id && f.status === "accepted");
  if (index < 0) return null;
  const presence = r.appear_offline === true ? null : parsePresence(r);
  const next = [...list];
  next[index] = { ...list[index], presence };
  return next;
}

/** Evento de `friendships` que mexe na lista desta pessoa (o Realtime nao filtra DELETE por RLS). */
export function friendshipEventRelevant(
  payload: { new?: unknown; old?: unknown },
  myId: string,
  list: Friend[],
): boolean {
  const n = (payload.new && typeof payload.new === "object" ? payload.new : {}) as Record<string, unknown>;
  const o = (payload.old && typeof payload.old === "object" ? payload.old : {}) as Record<string, unknown>;
  if (n.requester_id === myId || n.addressee_id === myId) return true;
  return typeof o.id === "string" && list.some((f) => f.friendshipId === o.id);
}
