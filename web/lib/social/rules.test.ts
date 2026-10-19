import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyStatusRow,
  friendshipEventRelevant,
  inviteNavigation,
  liveInvites,
  inviteHref,
  inviteText,
  isOnline,
  joinHref,
  nextStatus,
  normalizeUsername,
  parseFriends,
  parseInvites,
  presenceText,
  routeStatus,
  sortFriends,
  splitFriends,
  timeAgo,
  type Presence,
} from "./rules.ts";

const NOW = Date.parse("2026-10-14T21:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const presence = (over: Partial<Presence> = {}): Presence => ({
  state: "online",
  place: "hub",
  game: null,
  roomCode: null,
  players: null,
  maxPlayers: null,
  updatedAt: ago(10_000),
  ...over,
});

test("rota vira lugar do hub ou jogo", () => {
  assert.deepEqual(routeStatus("/"), { kind: "hub", place: "hub" });
  assert.deepEqual(routeStatus("/shop"), { kind: "hub", place: "shop" });
  assert.deepEqual(routeStatus("/leaderboard"), { kind: "hub", place: "leaderboard" });
  assert.deepEqual(routeStatus("/profile"), { kind: "hub", place: "profile" });
  assert.deepEqual(routeStatus("/inventory"), { kind: "hub", place: "profile" });
  assert.deepEqual(routeStatus("/amigos"), { kind: "hub", place: "hub" });
  assert.deepEqual(routeStatus("/games/drawit"), { kind: "game", game: "drawit" });
  assert.deepEqual(routeStatus("/games/corrida/sala"), { kind: "game", game: "corrida" });
});

test("hub sempre marca a pagina", () => {
  const inRoom = { state: "online" as const, place: "lobby" as const, game: "drawit", roomCode: "K7M2Q", players: 3, maxPlayers: 8 };
  assert.deepEqual(nextStatus(inRoom, "/shop"), {
    state: "online",
    place: "shop",
    game: null,
    roomCode: null,
    players: null,
    maxPlayers: null,
  });
});

test("na rota do jogo, o hub nao apaga a sala que o jogo marcou", () => {
  const inRoom = { state: "playing" as const, place: "match" as const, game: "drawit", roomCode: "K7M2Q", players: 3, maxPlayers: 8 };
  assert.equal(nextStatus(inRoom, "/games/drawit"), null);
});

test("chegando num jogo, o hub marca so a chegada", () => {
  assert.deepEqual(nextStatus(null, "/games/termo"), {
    state: "online",
    place: "hub",
    game: "termo",
    roomCode: null,
    players: null,
    maxPlayers: null,
  });
});

test("online so com batida recente e data valida", () => {
  assert.equal(isOnline(presence(), NOW), true);
  assert.equal(isOnline(presence({ updatedAt: ago(121_000) }), NOW), false);
  assert.equal(isOnline(presence({ updatedAt: "ontem" }), NOW), false);
  assert.equal(isOnline(null, NOW), false);
});

test("relogio um pouco atrasado conta como agora", () => {
  assert.equal(isOnline(presence({ updatedAt: ago(-30_000) }), NOW), true);
  assert.equal(timeAgo(-30_000), "agora");
});

test("batida muito no futuro (relogio de quem ve atrasado) nao vira online pra sempre", () => {
  assert.equal(isOnline(presence({ updatedAt: ago(-5 * 60_000) }), NOW), false);
  assert.equal(presenceText(presence({ updatedAt: ago(-5 * 60_000) }), NOW).label, "Offline");
});

test("convites vencem enquanto a lista esta aberta", () => {
  const list = parseInvites([invite(), invite({ id: "i2", expires_at: new Date(NOW + 60_000).toISOString() })], NOW)!;
  assert.deepEqual(liveInvites(list, NOW + 120_000).map((i) => i.id), ["i1"]);
  assert.deepEqual(liveInvites(list, NOW + 400_000), []);
});

test("link colado com rastreio, ancora, pontuacao ou @ com espaco", () => {
  assert.equal(normalizeUsername("https://arcadeon.com.br/amigo/raposa?utm_source=whatsapp"), "raposa");
  assert.equal(normalizeUsername("arcadeon.com.br/amigo/raposa#x"), "raposa");
  assert.equal(normalizeUsername("arcadeon.com.br/amigo/raposa."), "raposa");
  assert.equal(normalizeUsername("@ raposa"), "raposa");
  assert.equal(normalizeUsername("raposa,"), "raposa");
});

test("aceitar convite do jogo em que a pessoa ja esta recarrega a pagina", () => {
  assert.equal(inviteNavigation("/games/corrida", "/games/corrida?join=AB2CD"), "reload");
  assert.equal(inviteNavigation("/games/corrida/sala", "/games/corrida?join=AB2CD"), "reload");
  assert.equal(inviteNavigation("/", "/games/corrida?join=AB2CD"), "push");
  assert.equal(inviteNavigation("/games/drawit", "/games/corrida?join=AB2CD"), "push");
});

const statusRow = (over: Record<string, unknown> = {}) => ({
  user_id: "u1",
  state: "online",
  place: "shop",
  game: null,
  room_code: null,
  players: null,
  max_players: null,
  appear_offline: false,
  updated_at: ago(0),
  ...over,
});

test("batida de amigo atualiza so a linha dele, sem buscar a lista de novo", () => {
  const list = parseFriends([row(), row({ friendship_id: "f2", user_id: "u2", username: "bia" })])!;
  const next = applyStatusRow(list, statusRow())!;
  assert.equal(next[0].presence?.place, "shop");
  assert.equal(next[1], list[1]);
});

test("batida de quem nao e amigo aceito e ignorada", () => {
  const list = parseFriends([row(), row({ friendship_id: "f2", user_id: "u2", status: "pending", direction: "outgoing" })])!;
  assert.equal(applyStatusRow(list, statusRow({ user_id: "u9" })), null);
  assert.equal(applyStatusRow(list, statusRow({ user_id: "u2" })), null);
  assert.equal(applyStatusRow(list, null), null);
});

test("amigo que passou a aparecer offline perde o status", () => {
  const list = parseFriends([row({ presence: { state: "online", place: "hub", updated_at: ago(0) } })])!;
  assert.equal(applyStatusRow(list, statusRow({ appear_offline: true }))![0].presence, null);
});

test("evento de amizade so recarrega quando envolve a pessoa", () => {
  const list = parseFriends([row()])!;
  assert.equal(friendshipEventRelevant({ new: { requester_id: "me", addressee_id: "x" }, old: {} }, "me", list), true);
  assert.equal(friendshipEventRelevant({ new: { requester_id: "x", addressee_id: "me" }, old: {} }, "me", list), true);
  assert.equal(friendshipEventRelevant({ new: {}, old: { id: "f1" } }, "me", list), true);
  assert.equal(friendshipEventRelevant({ new: {}, old: { id: "zz" } }, "me", list), false);
  assert.equal(friendshipEventRelevant({ new: { requester_id: "a", addressee_id: "b" }, old: {} }, "me", list), false);
});

test("tempo desde a ultima batida", () => {
  assert.equal(timeAgo(30_000), "agora");
  assert.equal(timeAgo(5 * 60_000), "há 5 min");
  assert.equal(timeAgo(2 * 3_600_000 + 60_000), "há 2 h");
  assert.equal(timeAgo(26 * 3_600_000), "há 1 dia");
  assert.equal(timeAgo(3 * 86_400_000), "há 3 dias");
});

test("textos de status do spec", () => {
  assert.deepEqual(
    presenceText(presence({ state: "playing", place: "match", game: "drawit", roomCode: "K7M2Q", players: 3, maxPlayers: 8 }), NOW),
    { label: "Jogando Rabiscado · 3 de 8 na sala", tone: "playing" },
  );
  assert.deepEqual(presenceText(presence({ place: "lobby", game: "corrida", roomCode: "K7M2Q" }), NOW), {
    label: "Online · na sala de espera da Corrida",
    tone: "online",
  });
  assert.deepEqual(presenceText(presence({ place: "shop" }), NOW), { label: "Online · na loja", tone: "online" });
  assert.deepEqual(presenceText(presence({ updatedAt: ago(2 * 3_600_000) }), NOW), {
    label: "Offline · visto há 2 h",
    tone: "offline",
  });
});

test("outros textos", () => {
  assert.equal(presenceText(presence(), NOW).label, "Online");
  assert.equal(presenceText(presence({ place: "leaderboard" }), NOW).label, "Online · nos placares");
  assert.equal(presenceText(presence({ place: "profile" }), NOW).label, "Online · no perfil");
  assert.equal(presenceText(presence({ game: "termo" }), NOW).label, "Online · no Letrado");
  assert.equal(presenceText(presence({ game: "corrida" }), NOW).label, "Online · na Corrida");
  assert.equal(presenceText(presence({ state: "playing", place: "match", game: "termo" }), NOW).label, "Jogando Letrado");
  assert.equal(presenceText(presence({ state: "playing", place: "match", game: "xadrez" }), NOW).label, "Jogando");
  assert.deepEqual(presenceText(null, NOW), { label: "Offline", tone: "offline" });
});

test("botao entrar so pra sala de jogo em grupo com amigo online", () => {
  assert.equal(joinHref(presence({ place: "lobby", game: "drawit", roomCode: "K7M2Q" }), NOW), "/games/drawit?join=K7M2Q");
  assert.equal(joinHref(presence({ state: "playing", place: "match", game: "buggle", roomCode: "AB2CD" }), NOW), "/games/buggle?join=AB2CD");
  assert.equal(joinHref(presence({ place: "lobby", game: "termo", roomCode: "K7M2Q" }), NOW), null);
  assert.equal(joinHref(presence({ place: "shop", game: "drawit", roomCode: "K7M2Q" }), NOW), null);
  assert.equal(joinHref(presence({ place: "lobby", game: "drawit", roomCode: null }), NOW), null);
  assert.equal(joinHref(presence({ place: "lobby", game: "drawit", roomCode: "K7M2Q", updatedAt: ago(600_000) }), NOW), null);
});

const row = (over: Record<string, unknown> = {}) => ({
  friendship_id: "f1",
  user_id: "u1",
  username: "raposa",
  avatar: { emoji: "🦊", bg_color: "#f59e0b", image_url: null },
  status: "accepted",
  direction: null,
  presence: null,
  ...over,
});

test("le amigos e descarta linhas quebradas", () => {
  const list = parseFriends([
    row({ presence: { state: "online", place: "shop", game: null, room_code: null, players: null, max_players: null, updated_at: ago(0) } }),
    row({ user_id: 5 }),
    "lixo",
  ])!;
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], {
    friendshipId: "f1",
    userId: "u1",
    username: "raposa",
    avatar: { emoji: "🦊", bgColor: "#f59e0b", imageUrl: null },
    status: "accepted",
    direction: null,
    presence: { state: "online", place: "shop", game: null, roomCode: null, players: null, maxPlayers: null, updatedAt: ago(0) },
  });
  assert.equal(parseFriends(null), null);
  assert.deepEqual(parseFriends([]), []);
});

test("status ou lugar desconhecido vira sem status", () => {
  const [f] = parseFriends([row({ presence: { state: "dormindo", place: "hub", updated_at: ago(0) } })])!;
  assert.equal(f.presence, null);
});

test("separa amigos e pedidos", () => {
  const list = parseFriends([
    row(),
    row({ user_id: "u2", status: "pending", direction: "incoming" }),
    row({ user_id: "u3", status: "pending", direction: "outgoing" }),
  ])!;
  const { friends, incoming, outgoing } = splitFriends(list);
  assert.deepEqual([friends, incoming, outgoing].map((l) => l.map((f) => f.userId)), [["u1"], ["u2"], ["u3"]]);
});

test("ordem: jogando, online, offline; depois nome", () => {
  const list = parseFriends([
    row({ user_id: "a", username: "zeca" }),
    row({ user_id: "b", username: "bia", presence: { state: "online", place: "hub", updated_at: ago(0) } }),
    row({ user_id: "c", username: "caio", presence: { state: "playing", place: "match", game: "drawit", updated_at: ago(0) } }),
    row({ user_id: "d", username: "ana" }),
  ])!;
  assert.deepEqual(sortFriends(list, NOW).map((f) => f.username), ["caio", "bia", "ana", "zeca"]);
});

test("nome digitado ou link colado", () => {
  assert.equal(normalizeUsername("  @Raposa "), "Raposa");
  assert.equal(normalizeUsername("https://arcadeon.com.br/amigo/raposa_01"), "raposa_01");
  assert.equal(normalizeUsername("arcadeon.com.br/amigo/raposa/"), "raposa");
  assert.equal(normalizeUsername("ra"), null);
  assert.equal(normalizeUsername("nome com espaco"), null);
  assert.equal(normalizeUsername("a".repeat(21)), null);
  assert.equal(normalizeUsername(""), null);
});

const invite = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  game: "drawit",
  room_code: "K7M2Q",
  expires_at: new Date(NOW + 300_000).toISOString(),
  from: { user_id: "u1", username: "raposa", avatar: { emoji: "🦊", bg_color: "#f59e0b", image_url: null } },
  ...over,
});

test("convites validos, sem expirados nem jogo desconhecido", () => {
  const list = parseInvites(
    [invite(), invite({ id: "i2", expires_at: new Date(NOW - 1).toISOString() }), invite({ id: "i3", game: "xadrez" }), invite({ id: "i4", from: null })],
    NOW,
  )!;
  assert.deepEqual(list.map((i) => i.id), ["i1"]);
  assert.equal(list[0].from.username, "raposa");
  assert.equal(parseInvites("x", NOW), null);
});

test("texto e link do convite", () => {
  const [i] = parseInvites([invite()], NOW)!;
  assert.equal(inviteText(i), "raposa te chamou pro Rabiscado");
  assert.equal(inviteHref(i), "/games/drawit?join=K7M2Q");
  const [c] = parseInvites([invite({ game: "corrida" })], NOW)!;
  assert.equal(inviteText(c), "raposa te chamou pra Corrida");
});

test("Cofre: status, botao entrar e convite", () => {
  assert.equal(presenceText(presence({ place: "lobby", game: "cofre", roomCode: "K7M2Q" }), NOW).label, "Online · na sala de espera do Cofre");
  assert.equal(joinHref(presence({ place: "lobby", game: "cofre", roomCode: "K7M2Q" }), NOW), "/games/cofre?join=K7M2Q");
  const [c] = parseInvites([invite({ game: "cofre" })], NOW)!;
  assert.equal(inviteText(c), "raposa te chamou pro Cofre");
  assert.equal(inviteHref(c), "/games/cofre?join=K7M2Q");
});
