# Fase 4: social — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para seguir este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** entregar a parte de tela do social: página de amigos, link pessoal `/amigo/<username>`, status ao vivo dos amigos, convites para partida (aviso e sino), amigos online na barra lateral e os componentes que as sessões dos jogos põem na sala de espera e na tela de resultado. Tudo funciona antes do banco existir: sem RPC, nada novo aparece.

**Arquitetura:** regras de exibição e validação ficam num módulo puro (`web/lib/social/rules.ts`), testado com `node --test`. Um módulo de API fino chama as RPCs. Um `FriendsProvider` no layout raiz guarda amigos, pedidos e convites, ouve o Realtime numa assinatura só e entrega tudo por contexto. O status do próprio usuário sai de `web/lib/social/presence.ts`: o hub marca a página atual, as sessões dos jogos marcam sala de espera e partida, e um batimento a cada 30 s reenvia o último status com a aba visível. Banco e servidor são pedidos no vault (já escritos em 2026-10-14, seção "Fase 4: social" de `Pedidos-ao-Servidor.md`).

**Tecnologia:** Next.js 16 (App Router, `PageProps` global), React 19, Tailwind 4, lucide-react, Supabase JS (RPC e `postgres_changes`), `node --test` do Node 24 (sem dependência nova).

**Spec:** `docs/superpowers/specs/2026-10-12-arcadeon-escopo-final-design.md`, seção 8. A fase 3 (cosméticos) ficou pra depois por decisão do usuário em 2026-10-14: onde o spec fala em cosmético equipado, usar o avatar.

## Restrições globais

- A sessão Frontend nunca edita `server/`, migrations ou o banco. Nada de `apply_migration` nem SQL de escrita.
- Arquivos dos jogos (`components/termo|buggle|draw|race`, `app/games/*`, `lib/termo|buggle|draw|race`) são das sessões de cada jogo. Este plano entrega `setStatus`, `InviteFriendsButton` e `AddFriendButton`; encaixar é pedido.
- Loja (`components/shop/*`, `app/(hub)/shop/*`) fica intocada.
- O hub nunca sobrescreve o status que uma sessão de jogo marcou enquanto a pessoa está na rota daquele jogo.
- Aviso de convite nunca cobre a partida: com status `match`, o convite vai só pro sino.
- Commits só por caminho. Mensagem em português, prosa normal, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comentários em português sem acento. Módulos testados sem alias `@/`.
- Nenhuma dependência nova. Textos em caixa normal, voz ativa. Tudo que se move respeita `prefers-reduced-motion`.
- Páginas pessoais (`/amigos`, `/amigo/*`) fora da busca (`robots: { index: false, follow: false }`).

## Foco da revisão

1. Status com `updated_at` velho, inválido ou no futuro: aparece "Offline", nunca "Online" pra sempre nem "visto há -3 min". Teste na Task 1.
2. Pessoa que entra numa sala do Rabiscado e volta pra home: a home marca "Online", e voltar pra rota do Rabiscado não apaga a sala que o jogo marcou. Teste na Task 1 (`nextStatus`).
3. Convite expirado, de jogo desconhecido ou chegando no meio da partida: some da lista ou fica só no sino. Testes na Task 1, verificação na Task 6.
4. Nome digitado com `@`, espaços, link inteiro colado ou caracteres inválidos: normalizado ou recusado antes da RPC. Teste na Task 1.
5. Aba oculta: o batimento para; ao voltar, reenvia na hora. Verificado na Task 3 contando requisições no Playwright.

## Uso de skills e MCPs

- **superpowers:test-driven-development** no módulo puro.
- **frontend-design** e **design-taste-frontend** nas tasks visuais (5 a 9).
- **Playwright MCP** com a sessão falsa do plano da fase 2 (Task 4 de lá; script no diretório de rascunho): prints em 1440 e 390, claro e escuro. O Realtime não tem como ser simulado assim; o relatório final diz isso.
- **Supabase MCP** só leitura.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `web/lib/social/rules.ts` (novo) | tipos; `routeStatus`, `nextStatus`, `isOnline`, `timeAgo`, `presenceText`, `joinHref`, `sortFriends`, `parseFriends`, `splitFriends`, `normalizeUsername`, `parseInvites`, `inviteText`, `inviteHref` |
| `web/lib/social/rules.test.ts` (novo) | testes |
| `web/lib/social/api.ts` (novo) | chamadas das RPCs |
| `web/lib/social/presence.ts` (novo) | `setStatus`, `getStatus`, `startPresence` (usado pelos jogos) |
| `web/lib/social/FriendsProvider.tsx` (novo) | contexto + Realtime + pedido pendente do link pessoal |
| `web/components/social/useNow.ts` (novo) | relógio que avança a cada minuto (offline derivado) |
| `web/components/social/PresenceSync.tsx` (novo) | status da página atual do hub |
| `web/components/social/SocialToaster.tsx` (novo) | aviso de convite e de pedido enviado |
| `web/components/social/FriendRow.tsx` (novo) | linha de amigo com status e "Entrar" |
| `web/components/social/FriendsPageContent.tsx` (novo) | conteúdo de `/amigos` |
| `web/components/social/FriendLinkContent.tsx` (novo) | conteúdo de `/amigo/<username>` |
| `web/components/social/NotificationBell.tsx` (novo) | sino do header |
| `web/components/social/SidebarFriends.tsx` (novo) | amigos online na barra lateral |
| `web/components/social/AddFriendButton.tsx` (novo) | para a tela de resultado dos jogos |
| `web/components/social/InviteFriendsButton.tsx` (novo) | para a sala de espera dos jogos |
| `web/app/(hub)/amigos/page.tsx`, `web/app/(hub)/amigo/[username]/page.tsx` (novos) | rotas |
| `web/app/layout.tsx` | `FriendsProvider`, `PresenceSync`, `SocialToaster` |
| `web/components/Header.tsx`, `Sidebar.tsx`, `navItems.ts` | sino, amigos online, item "Amigos" |

---

### Task 0: branch

- [ ] **Passo 1:** com a fase 2 terminada e commitada, `git checkout -b feat/fase-4-social` a partir de `feat/fase-2-economia`. As duas ainda não estão na `main`; o usuário decide o merge.

---

### Task 1: regras do social

**Arquivos:**
- Criar: `web/lib/social/rules.ts`
- Criar: `web/lib/social/rules.test.ts`

**Interfaces:**
- Produz: `Place`, `PresenceState`, `StatusInput`, `Presence`, `FriendAvatar`, `Friend`, `GameInvite`, `GAME_NAMES`, `OFFLINE_AFTER_MS`, e as funções da tabela acima com as assinaturas do código abaixo.

- [ ] **Passo 1: testes.** Criar `web/lib/social/rules.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
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

test("relogio do amigo adiantado conta como agora", () => {
  assert.equal(isOnline(presence({ updatedAt: ago(-30_000) }), NOW), true);
  assert.equal(timeAgo(-30_000), "agora");
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
```

- [ ] **Passo 2:** `cd web && node --test lib/social/rules.test.ts`. Esperado: falha com `Cannot find module`.

- [ ] **Passo 3: implementação.** Criar `web/lib/social/rules.ts`:

```ts
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

function sinceMs(p: Presence, now: number): number | null {
  const at = Date.parse(p.updatedAt);
  return Number.isNaN(at) ? null : Math.max(0, now - at);
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
  const link = s.match(/\/amigo\/([^/?#\s]+)\/?$/);
  if (link) s = link[1];
  s = s.replace(/^@/, "");
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
```

- [ ] **Passo 4:** `cd web && node --test lib/social/rules.test.ts`. Esperado: `# pass 17`, `# fail 0`.
- [ ] **Passo 5:** `cd web && npm test && npx tsc --noEmit`. Esperado: tudo passando.
- [ ] **Passo 6: commit.**

```bash
git add web/lib/social/rules.ts web/lib/social/rules.test.ts
git commit -m "feat: regras de status, amigos e convites"
```

---

### Task 2: API do social

**Arquivos:**
- Criar: `web/lib/social/api.ts`

**Interfaces:**
- Consome: `parseFriends`, `parseInvites`, `StatusInput` (Task 1).
- Produz: `fetchFriends(): Promise<Friend[] | null>`, `fetchInvites(): Promise<GameInvite[] | null>`, `fetchAppearOffline(): Promise<boolean | null>`, `pushStatus(s: StatusInput): Promise<void>` (nunca lança), e as escritas que lançam `Error` com a mensagem do servidor: `sendFriendRequest(username): Promise<"pending" | "accepted">`, `sendFriendRequestTo(userId)`, `respondFriendRequest(id, accept)`, `removeFriend(userId)`, `sendGameInvite(toUserId, game, roomCode)`, `respondGameInvite(id, accept)`, `setAppearOffline(value)`.

- [ ] **Passo 1:** criar `web/lib/social/api.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
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

/** Escrita: o servidor manda as mensagens em portugues, prontas pra mostrar. */
async function write(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw new Error(error.message || "Não deu certo agora. Tente de novo.");
  return data;
}

export async function fetchFriends(): Promise<Friend[] | null> {
  return parseFriends(await read("my_friends"));
}

export async function fetchInvites(): Promise<GameInvite[] | null> {
  return parseInvites(await read("my_invites"), Date.now());
}

export async function fetchAppearOffline(): Promise<boolean | null> {
  const d = (await read("my_status")) as { appear_offline?: unknown } | null;
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
  return (data as { status?: unknown } | null)?.status === "accepted" ? "accepted" : "pending";
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
```

- [ ] **Passo 2:** `cd web && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Passo 3: commit.**

```bash
git add web/lib/social/api.ts
git commit -m "feat: chamadas de amizade, status e convites"
```

---

### Task 3: status do próprio usuário

**Arquivos:**
- Criar: `web/lib/social/presence.ts`
- Criar: `web/components/social/PresenceSync.tsx`
- Modificar: `web/app/layout.tsx`

**Interfaces:**
- Consome: `pushStatus` (Task 2), `nextStatus`, `StatusInput` (Task 1).
- Produz: `setStatus(s: Pick<StatusInput, "state" | "place"> & Partial<StatusInput>): void`, `getStatus(): StatusInput | null`, `startPresence(): () => void`, `<PresenceSync />`.

- [ ] **Passo 1:** criar `web/lib/social/presence.ts`:

```ts
import { pushStatus } from "./api";
import type { StatusInput } from "./rules";

export type { StatusInput };

const HEARTBEAT_MS = 30_000;
let current: StatusInput | null = null;
let enabled = false;

function visible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/**
 * Marca o status do proprio usuario. Os jogos chamam na sala de espera e na partida.
 * Nunca lanca, nao precisa de await e nao faz nada sem login.
 */
export function setStatus(s: Pick<StatusInput, "state" | "place"> & Partial<StatusInput>): void {
  current = { game: null, roomCode: null, players: null, maxPlayers: null, ...s };
  if (enabled && visible()) void pushStatus(current);
}

export function getStatus(): StatusInput | null {
  return current;
}

/** Liga o envio do status pro usuario logado: agora, a cada 30 s com a aba visivel e ao voltar pra aba. */
export function startPresence(): () => void {
  enabled = true;
  const beat = () => {
    if (current && visible()) void pushStatus(current);
  };
  beat();
  const timer = setInterval(beat, HEARTBEAT_MS);
  const onVisibility = () => {
    if (visible()) beat();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    enabled = false;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
```

- [ ] **Passo 2:** criar `web/components/social/PresenceSync.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getStatus, setStatus, startPresence } from "@/lib/social/presence";
import { nextStatus } from "@/lib/social/rules";

/** Marca a pagina atual no status; na rota de um jogo, quem marca sala e partida e o proprio jogo. */
export function PresenceSync() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pathname = usePathname();

  useEffect(() => {
    if (!userId) return;
    return startPresence();
  }, [userId]);

  useEffect(() => {
    const next = nextStatus(getStatus(), pathname);
    if (next) setStatus(next);
  }, [pathname]);

  return null;
}
```

- [ ] **Passo 3:** em `web/app/layout.tsx`, import `import { PresenceSync } from "@/components/social/PresenceSync";` e, dentro do `AuthProvider`, depois do `TransitionProvider`:

```tsx
          <AuthProvider>
            <TransitionProvider>{children}</TransitionProvider>
            <PresenceSync />
          </AuthProvider>
```

- [ ] **Passo 4:** `cd web && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Passo 5: batimento no Playwright.** Com a sessão falsa (fixture `set_status` → `{}`), abrir `/`, depois `/shop`, e contar as chamadas a `/rest/v1/rpc/set_status` com `browser_network_requests`. Esperado: uma ao abrir, uma ao trocar de página, uma a cada 30 s. Com `document.dispatchEvent` não dá pra esconder a aba; usar `browser_run_code_unsafe` com `await page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }))`, esperar 65 s e conferir que nenhuma chamada nova saiu; voltar pra `"visible"`, disparar `visibilitychange` e conferir uma chamada na hora. Corpo da chamada em `/shop`: `p_place: "shop"`.
- [ ] **Passo 6:** sem sessão: nenhuma chamada a `set_status`.
- [ ] **Passo 7: commit.**

```bash
git add web/lib/social/presence.ts web/components/social/PresenceSync.tsx web/app/layout.tsx
git commit -m "feat: status do usuario por pagina com batimento a cada 30 s"
```

---

### Task 4: provedor de amigos e convites

**Arquivos:**
- Criar: `web/lib/social/FriendsProvider.tsx`
- Criar: `web/components/social/useNow.ts`
- Modificar: `web/app/layout.tsx`

**Interfaces:**
- Consome: Tasks 1 e 2, `useAuth`, `createClient`.
- Produz: `<FriendsProvider>`, `useFriends(): FriendsValue`, `rememberPendingFriend(username: string): void`, `useNow(intervalMs?: number): number`.

```ts
interface FriendsValue {
  /** false sem login ou enquanto o banco nao tem `my_friends` */
  available: boolean;
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  invites: GameInvite[];
  refresh: () => Promise<void>;
  /** convite que acabou de chegar, pro aviso */
  toast: GameInvite | null;
  dismissToast: () => void;
  /** resultado do pedido guardado pelo link pessoal antes do login */
  notice: string | null;
  clearNotice: () => void;
}
```

- [ ] **Passo 1:** criar `web/components/social/useNow.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

/** Hora atual que avanca sozinha; o "offline" dos amigos e derivado dela. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
```

- [ ] **Passo 2:** criar `web/lib/social/FriendsProvider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { fetchFriends, fetchInvites, sendFriendRequest } from "./api";
import { splitFriends, type Friend, type GameInvite } from "./rules";

const PENDING_KEY = "arcadeon_pending_friend";
const PENDING_TTL_MS = 3_600_000;

interface FriendsValue {
  available: boolean;
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  invites: GameInvite[];
  refresh: () => Promise<void>;
  toast: GameInvite | null;
  dismissToast: () => void;
  notice: string | null;
  clearNotice: () => void;
}

const FriendsContext = createContext<FriendsValue | undefined>(undefined);

/** Guarda o pedido feito pelo link pessoal por quem ainda nao entrou; sai assim que a pessoa entra. */
export function rememberPendingFriend(username: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ username, at: Date.now() }));
  } catch {
    // storage bloqueado: a pessoa manda o pedido de novo depois de entrar
  }
}

function takePendingFriend(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    const p = raw ? (JSON.parse(raw) as { username?: unknown; at?: unknown }) : null;
    if (typeof p?.username !== "string" || typeof p.at !== "number" || Date.now() - p.at > PENDING_TTL_MS) return null;
    return p.username;
  } catch {
    return null;
  }
}

interface Loaded {
  userId: string;
  list: Friend[] | null;
  invites: GameInvite[];
}

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [toast, setToast] = useState<GameInvite | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [list, invites] = await Promise.all([fetchFriends(), fetchInvites()]);
    setLoaded({ userId, list, invites: invites ?? [] });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // varias mudancas juntas (amigo trocando de pagina) viram uma busca so
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => alive && refresh(), 400);
    };

    const pending = takePendingFriend();
    (pending
      ? sendFriendRequest(pending)
          .then((s) => alive && setNotice(s === "accepted" ? `Agora você e ${pending} são amigos` : `Pedido enviado pra ${pending}`))
          .catch((err: Error) => alive && setNotice(err.message))
      : Promise.resolve()
    ).finally(() => alive && refresh());

    const supabase = createClient();
    const channel = supabase
      .channel(`social:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_status" }, (payload) => {
        // o proprio batimento a cada 30 s nao precisa recarregar a lista
        if ((payload.new as { user_id?: string } | null)?.user_id === userId) return;
        soon();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_invites", filter: `to_id=eq.${userId}` },
        async () => {
          const invites = await fetchInvites();
          if (!alive || !invites) return;
          setLoaded((l) => (l && l.userId === userId ? { ...l, invites } : l));
          const newest = [...invites].sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0];
          if (newest) setToast(newest);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const value = useMemo<FriendsValue>(() => {
    const mine = loaded && loaded.userId === userId ? loaded : null;
    const split = splitFriends(mine?.list ?? []);
    return {
      available: !!mine?.list,
      ...split,
      invites: mine?.invites ?? [],
      refresh,
      toast: userId ? toast : null,
      dismissToast: () => setToast(null),
      notice: userId ? notice : null,
      clearNotice: () => setNotice(null),
    };
  }, [loaded, userId, refresh, toast, notice]);

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriends must be used within FriendsProvider");
  return ctx;
}
```

- [ ] **Passo 3:** em `web/app/layout.tsx`, import `import { FriendsProvider } from "@/lib/social/FriendsProvider";` e envolver o conteúdo do `AuthProvider`:

```tsx
          <AuthProvider>
            <FriendsProvider>
              <TransitionProvider>{children}</TransitionProvider>
              <PresenceSync />
            </FriendsProvider>
          </AuthProvider>
```

- [ ] **Passo 4:** `cd web && npx tsc --noEmit && npx eslint lib/social components/social`. Esperado: sem erros novos.
- [ ] **Passo 5:** sessão falsa sem fixture de `my_friends`: o site abre normal, nenhum erro no console além do 404 das RPCs.
- [ ] **Passo 6: commit.**

```bash
git add web/lib/social/FriendsProvider.tsx web/components/social/useNow.ts web/app/layout.tsx
git commit -m "feat: provedor de amigos e convites com Realtime"
```

---

### Task 5: página de amigos

**Arquivos:**
- Criar: `web/components/social/FriendRow.tsx`
- Criar: `web/components/social/FriendsPageContent.tsx`
- Criar: `web/app/(hub)/amigos/page.tsx`
- Modificar: `web/components/navItems.ts`

**Interfaces:**
- Consome: `useFriends`, `useNow`, Tasks 1 e 2, `Avatar`, `LoginPrompt`.
- Produz: `<FriendRow friend now compact? actions? />`.

- [ ] **Passo 1:** criar `web/components/social/FriendRow.tsx`:

```tsx
import Link from "next/link";
import { LogIn } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { joinHref, presenceText, type Friend } from "@/lib/social/rules";

const DOT = { playing: "bg-[var(--game-termo)]", online: "bg-[var(--game-termo)]", offline: "bg-[var(--border-hover)]" };

/** Amigo com avatar, status e "Entrar" quando ele esta numa sala de jogo em grupo. */
export function FriendRow({
  friend,
  now,
  compact = false,
  hideJoin = false,
  actions,
}: {
  friend: Friend;
  now: number;
  compact?: boolean;
  /** na lista de convite da sala de espera, "Entrar" na sala do amigo nao faz sentido */
  hideJoin?: boolean;
  /** botoes extras a direita (aceitar, remover...) */
  actions?: React.ReactNode;
}) {
  const status = friend.status === "accepted" ? presenceText(friend.presence, now) : null;
  const join = friend.status === "accepted" && !hideJoin ? joinHref(friend.presence, now) : null;

  return (
    <div className="flex items-center gap-3">
      <span className="relative shrink-0">
        <Avatar
          emoji={friend.avatar.emoji}
          bgColor={friend.avatar.bgColor}
          imageUrl={friend.avatar.imageUrl}
          fallbackLetter={friend.username.charAt(0).toUpperCase()}
          size={compact ? "sm" : "md"}
        />
        {status && (
          <span
            aria-hidden
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--card)] ${DOT[status.tone]}`}
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate font-bold text-[var(--fg)] ${compact ? "text-xs" : "text-sm"}`}>{friend.username}</span>
        {status && <span className={`truncate text-[var(--fg-muted)] ${compact ? "text-[0.7rem]" : "text-xs"}`}>{status.label}</span>}
      </div>
      {join && (
        <Link
          href={join}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden /> Entrar
        </Link>
      )}
      {actions}
    </div>
  );
}
```

- [ ] **Passo 2:** criar `web/components/social/FriendsPageContent.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Check, Copy, UserPlus, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFriends } from "@/lib/social/FriendsProvider";
import {
  fetchAppearOffline,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  setAppearOffline,
} from "@/lib/social/api";
import { normalizeUsername, sortFriends } from "@/lib/social/rules";
import { LoginPrompt } from "@/components/LoginPrompt";
import { FriendRow } from "./FriendRow";
import { useNow } from "./useNow";

const CARD = "flex flex-col gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5";
const SMALL_BTN =
  "inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--bg)] disabled:opacity-60";

export function FriendsPageContent() {
  const { user, username, loading } = useAuth();
  const { available, friends, incoming, outgoing, refresh, notice, clearNotice } = useFriends();
  const now = useNow();
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offline, setOffline] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchAppearOffline().then((v) => alive && setOffline(v));
    return () => {
      alive = false;
    };
  }, [user]);

  if (loading) return null;
  if (!user) {
    return <LoginPrompt title="Seus amigos ficam aqui" text="Entre na sua conta pra adicionar amigos, ver quem está online e chamar pra jogar." />;
  }
  if (!available) {
    return <p className="rounded-3xl border-2 border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--fg-muted)]">A lista de amigos ainda não está disponível. Volte daqui a pouco.</p>;
  }

  const link = typeof window !== "undefined" && username ? `${window.location.origin}/amigo/${username}` : "";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const target = normalizeUsername(name);
    if (!target) {
      setMessage({ text: "Digite um nome de usuário com 3 a 20 letras, números, ponto, hífen ou _.", error: true });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const status = await sendFriendRequest(target);
      setMessage({ text: status === "accepted" ? `Agora você e ${target} são amigos` : `Pedido enviado pra ${target}`, error: false });
      setName("");
      await refresh();
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setSending(false);
    }
  }

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setMessage(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleOffline() {
    if (offline === null) return;
    const next = !offline;
    setOffline(next);
    try {
      await setAppearOffline(next);
    } catch (err) {
      setOffline(!next);
      setMessage({ text: (err as Error).message, error: true });
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ text: "Não deu pra copiar. Selecione o link e copie à mão.", error: true });
    }
  }

  const sorted = sortFriends(friends, now);
  const onlineCount = sorted.filter((f) => f.presence && now - Date.parse(f.presence.updatedAt) < 120_000).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        {notice && (
          <p role="status" className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--primary-tint)] px-4 py-3 text-sm font-bold text-[var(--primary)]">
            {notice}
            <button type="button" onClick={clearNotice} aria-label="Fechar aviso" className="rounded-lg p-1 hover:bg-[var(--card)]">
              <X className="h-4 w-4" />
            </button>
          </p>
        )}

        {incoming.length > 0 && (
          <section className={CARD}>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Pedidos recebidos</h2>
            <ul className="flex flex-col gap-3">
              {incoming.map((f) => (
                <li key={f.friendshipId}>
                  <FriendRow
                    friend={f}
                    now={now}
                    actions={
                      <span className="flex gap-2">
                        <button type="button" disabled={busyId === f.friendshipId} onClick={() => act(f.friendshipId, () => respondFriendRequest(f.friendshipId, true))} className={`${SMALL_BTN} border-transparent bg-[var(--primary)] text-white hover:bg-[var(--primary)] hover:brightness-110`}>
                          <Check className="h-3.5 w-3.5" aria-hidden /> Aceitar
                        </button>
                        <button type="button" disabled={busyId === f.friendshipId} onClick={() => act(f.friendshipId, () => respondFriendRequest(f.friendshipId, false))} className={SMALL_BTN}>
                          Recusar
                        </button>
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={CARD}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Amigos</h2>
            {sorted.length > 0 && (
              <p className="text-xs font-medium text-[var(--fg-muted)]">
                {onlineCount} de {sorted.length} online
              </p>
            )}
          </div>
          {sorted.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">Você ainda não tem amigos aqui. Mande um pedido pelo nome ou compartilhe seu link.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sorted.map((f) => (
                <li key={f.friendshipId}>
                  <FriendRow
                    friend={f}
                    now={now}
                    actions={
                      <button
                        type="button"
                        disabled={busyId === f.friendshipId}
                        onClick={() => {
                          if (window.confirm(`Remover ${f.username} dos amigos?`)) act(f.friendshipId, () => removeFriend(f.userId));
                        }}
                        aria-label={`Remover ${f.username}`}
                        className="shrink-0 rounded-xl p-2 text-[var(--fg-muted)] transition hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {outgoing.length > 0 && (
          <section className={CARD}>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Pedidos enviados</h2>
            <ul className="flex flex-col gap-3">
              {outgoing.map((f) => (
                <li key={f.friendshipId}>
                  <FriendRow
                    friend={f}
                    now={now}
                    actions={
                      <button type="button" disabled={busyId === f.friendshipId} onClick={() => act(f.friendshipId, () => removeFriend(f.userId))} className={SMALL_BTN}>
                        Cancelar
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-6 self-start">
        <section className={CARD}>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Adicionar amigo</h2>
          <form onSubmit={add} className="flex flex-col gap-2">
            <label htmlFor="friend-name" className="text-sm font-bold text-[var(--fg)]">
              Nome de usuário
            </label>
            <div className="flex gap-2">
              <input
                id="friend-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="raposa"
                className="min-w-0 flex-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--primary)]"
              />
              <button
                type="submit"
                disabled={sending || name.trim() === ""}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" aria-hidden /> {sending ? "Mandando..." : "Mandar pedido"}
              </button>
            </div>
            {message && (
              <p role={message.error ? "alert" : "status"} className={`text-sm font-bold ${message.error ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>
                {message.text}
              </p>
            )}
          </form>
        </section>

        {link && (
          <section className={CARD}>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Seu link</h2>
            <p className="text-sm text-[var(--fg-muted)]">Quem abrir o link manda um pedido pra você, mesmo sem conta ainda.</p>
            <div className="flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Seu link pessoal" className="min-w-0 flex-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg-muted)]" />
              <button type="button" onClick={copyLink} className={SMALL_BTN}>
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </section>
        )}

        {offline !== null && (
          <section className={CARD}>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="flex flex-col">
                <span className="text-sm font-bold text-[var(--fg)]">Aparecer offline</span>
                <span className="text-xs text-[var(--fg-muted)]">Seus amigos não veem onde você está.</span>
              </span>
              <input type="checkbox" role="switch" checked={offline} onChange={toggleOffline} className="h-5 w-5 accent-[var(--primary)]" />
            </label>
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Passo 3:** criar `web/app/(hub)/amigos/page.tsx`:

```tsx
import type { Metadata } from "next";
import { FriendsPageContent } from "@/components/social/FriendsPageContent";

// pagina pessoal: fora da busca
export const metadata: Metadata = { title: "Amigos", robots: { index: false, follow: false } };

export default function FriendsPage() {
  return (
    <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--fg)] sm:text-3xl">Amigos</h1>
        <FriendsPageContent />
      </div>
    </main>
  );
}
```

- [ ] **Passo 4:** em `web/components/navItems.ts`, importar `Users` de `lucide-react` e pôr o item antes de "Perfil":

```ts
  { href: "/leaderboard", label: "Placares", icon: Trophy },
  { href: "/amigos", label: "Amigos", icon: Users },
  { href: "/profile", label: "Perfil", icon: User },
```

- [ ] **Passo 5:** `cd web && npx tsc --noEmit && npm test`. Esperado: sem erros.
- [ ] **Passo 6: verificação visual com a sessão falsa.** Fixtures: `my_friends` com 1 jogando no Rabiscado (`players: 3, max_players: 8, room_code: "K7M2Q"`), 1 online na loja, 1 offline há 2 h, 1 pedido recebido e 1 enviado; `my_status` → `{ appear_offline: false }`; `send_friend_request` → `{ id: "x", status: "pending" }`. Prints 1440/390, claro/escuro. Conferir:
  1. ordem jogando, online, offline; botão "Entrar" só no que está jogando, levando a `/games/drawit?join=K7M2Q`;
  2. "@Raposa" no campo → chamada com `p_username: "Raposa"`; "ra" → mensagem de formato, sem chamada;
  3. erro do servidor (`send_friend_request` → status 400, `{ message: "Usuário não encontrado" }`) aparece em vermelho;
  4. sem `my_friends`: "A lista de amigos ainda não está disponível";
  5. deslogado: "Seus amigos ficam aqui" com "Entrar";
  6. barra de baixo do celular com 5 itens sem quebrar o texto em 390 px;
  7. teclado: Tab passa por campo, botão, copiar, interruptor, Entrar, remover, todos com foco visível.
- [ ] **Passo 7: commit.**

```bash
git add web/components/social/FriendRow.tsx web/components/social/FriendsPageContent.tsx "web/app/(hub)/amigos/page.tsx" web/components/navItems.ts
git commit -m "feat: pagina de amigos com pedidos, status e link pessoal"
```

---

### Task 6: aviso de convite e sino

**Arquivos:**
- Criar: `web/components/social/SocialToaster.tsx`
- Criar: `web/components/social/NotificationBell.tsx`
- Modificar: `web/app/layout.tsx`, `web/components/Header.tsx`

**Interfaces:**
- Consome: `useFriends`, `getStatus`, `respondGameInvite`, `respondFriendRequest`, `inviteText`, `inviteHref`.

- [ ] **Passo 1:** criar `web/components/social/SocialToaster.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useFriends } from "@/lib/social/FriendsProvider";
import { respondGameInvite } from "@/lib/social/api";
import { getStatus } from "@/lib/social/presence";
import { inviteHref, inviteText } from "@/lib/social/rules";

/** Aviso no canto: convite que acabou de chegar ou resultado do pedido feito pelo link pessoal. */
export function SocialToaster() {
  const { toast, dismissToast, notice, clearNotice, refresh } = useFriends();
  const router = useRouter();
  const pathname = usePathname();
  const inGame = pathname.startsWith("/games/");
  // no meio da partida o convite fica so no sino
  const invite = toast && getStatus()?.place !== "match" ? toast : null;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, Math.max(0, Date.parse(toast.expiresAt) - Date.now()));
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  useEffect(() => {
    if (!notice || pathname.startsWith("/amigo")) return;
    const t = setTimeout(clearNotice, 6000);
    return () => clearTimeout(t);
  }, [notice, clearNotice, pathname]);

  if (!invite && (!notice || pathname.startsWith("/amigo"))) return null;

  async function answer(accept: boolean) {
    if (!invite) return;
    dismissToast();
    try {
      await respondGameInvite(invite.id, accept);
    } catch {
      // convite vencido ou ja respondido: ainda da pra tentar entrar pela sala
    }
    refresh();
    if (accept) router.push(inviteHref(invite));
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-4 right-4 z-50 flex flex-col gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4 shadow-xl shadow-black/10 animate-[scaleIn_0.15s_ease-out] motion-reduce:animate-none sm:right-auto sm:w-96 ${
        inGame ? "bottom-4" : "bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6"
      }`}
    >
      {invite ? (
        <>
          <p className="text-sm font-bold text-[var(--fg)]">{inviteText(invite)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => answer(true)} className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98]">
              Entrar na sala
            </button>
            <button type="button" onClick={() => answer(false)} className="flex-1 rounded-xl border-2 border-[var(--border)] px-3 py-2 text-sm font-bold text-[var(--fg)] transition hover:bg-[var(--bg)]">
              Agora não
            </button>
          </div>
        </>
      ) : (
        <p className="flex items-center justify-between gap-3 text-sm font-bold text-[var(--fg)]">
          {notice}
          <button type="button" onClick={clearNotice} aria-label="Fechar aviso" className="rounded-lg p-1 text-[var(--fg-muted)] hover:bg-[var(--bg)]">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Passo 2:** criar `web/components/social/NotificationBell.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useFriends } from "@/lib/social/FriendsProvider";
import { respondFriendRequest, respondGameInvite } from "@/lib/social/api";
import { inviteHref, inviteText } from "@/lib/social/rules";

/** Pedidos de amizade e convites que chegaram, inclusive com a aba fechada. */
export function NotificationBell() {
  const { available, incoming, invites, refresh } = useFriends();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!available) return null;
  const count = incoming.length + invites.length;

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
    } catch {
      // ja respondido em outra aba: a lista nova resolve
    }
    refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={count > 0 ? `Notificações, ${count} novas` : "Notificações"}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] transition hover:border-[var(--border-hover)]"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[0.65rem] font-extrabold tabular-nums text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-3 shadow-xl shadow-black/10 animate-[scaleIn_0.15s_ease-out] motion-reduce:animate-none">
          {count === 0 ? (
            <p className="px-2 py-3 text-sm text-[var(--fg-muted)]">Nada novo por aqui.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 rounded-xl bg-[var(--bg)] p-3">
                  <p className="text-sm font-bold text-[var(--fg)]">{inviteText(i)}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        run(() => respondGameInvite(i.id, true));
                        router.push(inviteHref(i));
                      }}
                      className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110"
                    >
                      Entrar na sala
                    </button>
                    <button type="button" onClick={() => run(() => respondGameInvite(i.id, false))} className="flex-1 rounded-xl border-2 border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--card)]">
                      Agora não
                    </button>
                  </div>
                </li>
              ))}
              {incoming.map((f) => (
                <li key={f.friendshipId} className="flex flex-col gap-2 rounded-xl bg-[var(--bg)] p-3">
                  <p className="text-sm font-bold text-[var(--fg)]">{f.username} quer ser seu amigo</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => run(() => respondFriendRequest(f.friendshipId, true))} className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110">
                      Aceitar
                    </button>
                    <button type="button" onClick={() => run(() => respondFriendRequest(f.friendshipId, false))} className="flex-1 rounded-xl border-2 border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--card)]">
                      Recusar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/amigos" onClick={() => setOpen(false)} className="mt-2 block rounded-xl px-2 py-2 text-center text-sm font-bold text-[var(--primary)] hover:bg-[var(--bg)]">
            Ver amigos
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Passo 3:** em `web/app/layout.tsx`, import `import { SocialToaster } from "@/components/social/SocialToaster";` e pôr `<SocialToaster />` logo depois de `<PresenceSync />`.
- [ ] **Passo 4:** em `web/components/Header.tsx`, import `import { NotificationBell } from "./social/NotificationBell";` e, no ramo logado, antes do `<span>` das moedas: `<NotificationBell />`.
- [ ] **Passo 5:** `cd web && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Passo 6: verificação.** Fixtures `my_invites` com um convite pro Rabiscado vencendo em 5 min e `my_friends` com um pedido recebido.
  1. sino com "2", lista com os dois, "Entrar na sala" leva a `/games/drawit?join=K7M2Q`;
  2. o aviso não chega por Realtime na sessão falsa: forçar com `browser_run_code_unsafe` não é possível sem mexer no código, então conferir só o desenho do aviso renderizando o estado do sino; registrar no relatório que o caminho Realtime fica pra quando o Servidor entregar;
  3. convite vencido na fixture: some da lista;
  4. celular 390: o menu do sino cabe na tela; o aviso fica acima da barra de baixo.
- [ ] **Passo 7: commit.**

```bash
git add web/components/social/SocialToaster.tsx web/components/social/NotificationBell.tsx web/app/layout.tsx web/components/Header.tsx
git commit -m "feat: aviso de convite e sino de notificacoes"
```

---

### Task 7: link pessoal `/amigo/<username>`

**Arquivos:**
- Criar: `web/components/social/FriendLinkContent.tsx`
- Criar: `web/app/(hub)/amigo/[username]/page.tsx`

**Interfaces:**
- Consome: `useFriends`, `rememberPendingFriend` (Task 4), `sendFriendRequest`, `normalizeUsername`, `LoginModal`.

- [ ] **Passo 1:** criar `web/components/social/FriendLinkContent.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { rememberPendingFriend, useFriends } from "@/lib/social/FriendsProvider";
import { sendFriendRequest } from "@/lib/social/api";
import { normalizeUsername } from "@/lib/social/rules";
import { LoginModal } from "@/components/LoginModal";

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2 disabled:opacity-70";

export function FriendLinkContent({ rawUsername }: { rawUsername: string }) {
  const { user, username: me, loading } = useAuth();
  const { available, friends, outgoing, refresh, notice } = useFriends();
  const [loginOpen, setLoginOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  const target = normalizeUsername(rawUsername);
  const same = (a: string) => a.toLowerCase() === target?.toLowerCase();

  if (loading) return null;
  if (!target) return <Shell title="Link inválido" text="Esse link de amigo não existe. Peça o link de novo pra quem te mandou." />;

  if (!user) {
    return (
      <Shell title={`${target} te chamou pro Arcadeon`} text="Entre ou crie sua conta e o pedido de amizade sai na hora.">
        <button
          type="button"
          className={PRIMARY}
          onClick={() => {
            rememberPendingFriend(target);
            setLoginOpen(true);
          }}
        >
          <LogIn className="h-4 w-4" aria-hidden /> Entrar e adicionar
        </button>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </Shell>
    );
  }

  if (me && same(me)) {
    return (
      <Shell title="Esse é o seu link" text="Mande pra quem você quer adicionar. Quem abrir manda um pedido pra você.">
        <Link href="/amigos" className={PRIMARY}>Ver amigos</Link>
      </Shell>
    );
  }

  const already = friends.some((f) => same(f.username));
  const pending = outgoing.some((f) => same(f.username));

  async function add() {
    setSending(true);
    setResult(null);
    try {
      const status = await sendFriendRequest(target!);
      setResult({ text: status === "accepted" ? `Agora você e ${target} são amigos` : `Pedido enviado pra ${target}`, error: false });
      await refresh();
    } catch (err) {
      setResult({ text: (err as Error).message, error: true });
    } finally {
      setSending(false);
    }
  }

  const message = result ?? (notice ? { text: notice, error: false } : null);

  return (
    <Shell title={`Adicionar ${target}`} text="Amigos veem quando você está online e podem te chamar pra jogar.">
      {already ? (
        <p className="text-sm font-bold text-[var(--primary)]">Vocês já são amigos.</p>
      ) : pending && !result ? (
        <p className="text-sm font-bold text-[var(--fg-muted)]">Pedido enviado. Falta {target} aceitar.</p>
      ) : result && !result.error ? null : (
        // depois de um envio certo o botao some; depois de erro, continua pra tentar de novo
        <button type="button" className={PRIMARY} onClick={add} disabled={sending || !available}>
          <UserPlus className="h-4 w-4" aria-hidden /> {sending ? "Mandando..." : `Adicionar ${target}`}
        </button>
      )}
      {message && (
        <p role={message.error ? "alert" : "status"} className={`text-sm font-bold ${message.error ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>
          {message.text}
        </p>
      )}
      {!available && <p className="text-sm text-[var(--fg-muted)]">Amizades ainda não estão disponíveis. Volte daqui a pouco.</p>}
      <Link href="/amigos" className="text-sm font-bold text-[var(--primary)] hover:underline">Ver meus amigos</Link>
    </Shell>
  );
}

function Shell({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] px-6 py-10 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--fg)]">{title}</h1>
      <p className="text-sm text-[var(--fg-muted)]">{text}</p>
      {children && <div className="mt-2 flex flex-col items-center gap-3">{children}</div>}
    </div>
  );
}
```

- [ ] **Passo 2:** criar `web/app/(hub)/amigo/[username]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { FriendLinkContent } from "@/components/social/FriendLinkContent";

export async function generateMetadata(props: PageProps<"/amigo/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `Adicionar ${decodeURIComponent(username)}`, robots: { index: false, follow: false } };
}

export default async function FriendLinkPage(props: PageProps<"/amigo/[username]">) {
  const { username } = await props.params;
  return (
    <main className="w-full flex-1 px-4 py-10 sm:px-6">
      <FriendLinkContent rawUsername={decodeURIComponent(username)} />
    </main>
  );
}
```

- [ ] **Passo 3:** `cd web && npx next typegen && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Passo 4: verificação.**
  1. deslogado em `/amigo/raposa`: "raposa te chamou pro Arcadeon"; clicar em "Entrar e adicionar" grava `arcadeon_pending_friend` no `localStorage` (conferir com `browser_evaluate`);
  2. com a sessão falsa e a chave gravada: recarregar qualquer página do hub; uma chamada a `send_friend_request` com `p_username: "raposa"`, a chave some e o aviso "Pedido enviado pra raposa" aparece;
  3. logado em `/amigo/raposa` com `raposa` nos amigos: "Vocês já são amigos.";
  4. `/amigo/<seu nome>`: "Esse é o seu link";
  5. `/amigo/a b`: "Link inválido".
- [ ] **Passo 5: commit.**

```bash
git add web/components/social/FriendLinkContent.tsx "web/app/(hub)/amigo/[username]/page.tsx"
git commit -m "feat: link pessoal de amizade"
```

---

### Task 8: amigos online na barra lateral

**Arquivos:**
- Criar: `web/components/social/SidebarFriends.tsx`
- Modificar: `web/components/Sidebar.tsx`

- [ ] **Passo 1:** criar `web/components/social/SidebarFriends.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useFriends } from "@/lib/social/FriendsProvider";
import { isOnline, sortFriends } from "@/lib/social/rules";
import { FriendRow } from "./FriendRow";
import { useNow } from "./useNow";

const MAX = 4;

/** Ate 4 amigos online acima do Letrado de hoje. */
export function SidebarFriends() {
  const { available, friends } = useFriends();
  const now = useNow();
  if (!available || friends.length === 0) return null;
  const online = sortFriends(friends, now).filter((f) => isOnline(f.presence, now));

  return (
    <div className="mb-3 flex flex-col gap-2.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-4">
      <p className="text-sm font-extrabold text-[var(--fg)]">Amigos online</p>
      {online.length === 0 ? (
        <p className="text-xs text-[var(--fg-muted)]">Ninguém online agora.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {online.slice(0, MAX).map((f) => (
            <li key={f.friendshipId}>
              <FriendRow friend={f} now={now} compact />
            </li>
          ))}
        </ul>
      )}
      <Link href="/amigos" className="text-xs font-bold text-[var(--primary)] hover:underline">
        {online.length > MAX ? `Ver todos (${online.length})` : "Ver amigos"}
      </Link>
    </div>
  );
}
```

- [ ] **Passo 2:** em `web/components/Sidebar.tsx`, import `import { SidebarFriends } from "./social/SidebarFriends";` e trocar `<SidebarDaily />` por:

```tsx
      <SidebarFriends />
      <SidebarDaily />
```

  Também trocar o comentário de `SidebarDaily.tsx` ("Na fase 4 ganha os amigos online") por "Progresso do Letrado de hoje e quanto falta pra palavra nova."

- [ ] **Passo 3:** `cd web && npx tsc --noEmit`.
- [ ] **Passo 4: verificação.** 1440 px com a fixture de amigos: até 4 linhas, "Entrar" cabe na largura da barra (se não couber, `FriendRow` com `compact` esconde o rótulo do botão e deixa só o ícone com `aria-label="Entrar na sala de <nome>"`; registrar como ruling). Sem amigos: o bloco some. Altura: com 4 amigos a barra não rola em 768 px de altura; se rolar, `MAX = 3`.
- [ ] **Passo 5: commit.**

```bash
git add web/components/social/SidebarFriends.tsx web/components/Sidebar.tsx web/components/SidebarDaily.tsx
git commit -m "feat: amigos online na barra lateral"
```

---

### Task 9: componentes para as sessões dos jogos

**Arquivos:**
- Criar: `web/components/social/AddFriendButton.tsx`
- Criar: `web/components/social/InviteFriendsButton.tsx`

**Interfaces:**
- Produz: `<AddFriendButton userId={string} username={string} />` (tela de resultado) e `<InviteFriendsButton game={"buggle" | "drawit" | "corrida"} roomCode={string} />` (sala de espera). Os dois somem sem login ou sem a RPC.

- [ ] **Passo 1:** criar `web/components/social/AddFriendButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFriends } from "@/lib/social/FriendsProvider";
import { sendFriendRequestTo } from "@/lib/social/api";

/** "Adicionar" ao lado de um jogador logado na tela de resultado. */
export function AddFriendButton({ userId, username }: { userId: string; username: string }) {
  const { user } = useAuth();
  const { available, friends, outgoing, refresh } = useFriends();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!user || !available || user.id === userId) return null;
  if (friends.some((f) => f.userId === userId)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--fg-muted)]">
        <Check className="h-3.5 w-3.5" aria-hidden /> Amigos
      </span>
    );
  }
  if (state === "sent" || outgoing.some((f) => f.userId === userId)) {
    return <span className="text-xs font-bold text-[var(--fg-muted)]">Pedido enviado</span>;
  }

  async function add() {
    setState("sending");
    setError(null);
    try {
      await sendFriendRequestTo(userId);
      setState("sent");
      refresh();
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={add}
        disabled={state === "sending"}
        aria-label={`Adicionar ${username} aos amigos`}
        className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--bg)] disabled:opacity-60"
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden /> {state === "sending" ? "Mandando..." : "Adicionar"}
      </button>
      {error && (
        <span role="alert" className="text-xs font-bold text-[var(--danger)]">
          {error}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Passo 2:** criar `web/components/social/InviteFriendsButton.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, UserPlus, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFriends } from "@/lib/social/FriendsProvider";
import { sendGameInvite } from "@/lib/social/api";
import { sortFriends } from "@/lib/social/rules";
import { FriendRow } from "./FriendRow";
import { useNow } from "./useNow";

/** Botao da sala de espera: abre a lista de amigos (online primeiro) com "Convidar". */
export function InviteFriendsButton({ game, roomCode }: { game: "buggle" | "drawit" | "corrida"; roomCode: string }) {
  const { user } = useAuth();
  const { available, friends } = useFriends();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<Record<string, "sending" | "sent" | string>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user || !available) return null;

  async function invite(userId: string) {
    setSent((s) => ({ ...s, [userId]: "sending" }));
    try {
      await sendGameInvite(userId, game, roomCode);
      setSent((s) => ({ ...s, [userId]: "sent" }));
    } catch (err) {
      setSent((s) => ({ ...s, [userId]: (err as Error).message }));
    }
  }

  const sorted = sortFriends(friends, now);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-bold text-[var(--fg)] transition hover:bg-[var(--bg)]"
      >
        <UserPlus className="h-4 w-4" aria-hidden /> Convidar amigos
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80dvh] w-full max-w-md flex-col gap-4 overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="invite-title" className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">
                Convidar amigos
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-xl p-2 text-[var(--fg-muted)] hover:bg-[var(--bg)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            {sorted.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">
                Você ainda não tem amigos no Arcadeon.{" "}
                <Link href="/amigos" className="font-bold text-[var(--primary)] hover:underline">
                  Adicionar amigos
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-3 overflow-y-auto">
                {sorted.map((f) => {
                  const s = sent[f.userId];
                  return (
                    <li key={f.friendshipId} className="flex flex-col gap-1">
                      <FriendRow
                        friend={f}
                        now={now}
                        actions={
                          s === "sent" ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--fg-muted)]">
                              <Check className="h-3.5 w-3.5" aria-hidden /> Convidado
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => invite(f.userId)}
                              disabled={s === "sending"}
                              className="shrink-0 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
                            >
                              {s === "sending" ? "Mandando..." : "Convidar"}
                            </button>
                          )
                        }
                      />
                      {s && s !== "sent" && s !== "sending" && (
                        <p role="alert" className="pl-12 text-xs font-bold text-[var(--danger)]">
                          {s}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

  No `<FriendRow>` da lista acima, passar `hideJoin` (a prop já existe desde a Task 5).

- [ ] **Passo 3:** `cd web && npx tsc --noEmit`.
- [ ] **Passo 4: ver os dois sem mexer em arquivo de jogo.** Renderizar temporariamente `<InviteFriendsButton game="drawit" roomCode="K7M2Q" />` e `<AddFriendButton userId="u9" username="bia" />` no topo de `FriendsPageContent`, prints com a sessão falsa (modal aberto, "Convidado", erro "Convite já enviado pra essa sala"), foco preso no diálogo ao abrir com teclado (se não ficar, mover o foco pro botão de fechar ao abrir com `autoFocus`; registrar). **Desfazer** antes do commit.
- [ ] **Passo 5: commit.**

```bash
git add web/components/social/AddFriendButton.tsx web/components/social/InviteFriendsButton.tsx
git commit -m "feat: botoes de adicionar e convidar amigos para as sessoes dos jogos"
```

---

### Task 10: fechamento

- [ ] **Passo 1:** `cd web && npm test && npx tsc --noEmit && npx next build`. Esperado: tudo passando.
- [ ] **Passo 2:** `cd web && npx eslint`: nenhum erro novo em arquivo desta fase.
- [ ] **Passo 3:** Supabase MCP `list_tables`: anotar quais pedidos da fase 4 já existem.
- [ ] **Passo 4: vault.** `Frontend/Handoff-Frontend.md`, seção "2026-10-14: fase 4, telas do social": o que entrou, o que espera o Servidor e as sessões dos jogos, e que o Realtime (aviso de convite, status ao vivo) não foi verificado e precisa do teste com 2 contas em 2 navegadores do spec 8 quando o banco existir.
- [ ] **Passo 5:** revisão final da branch inteira (subagente novo, modelo mais capaz), com este plano, o spec e as rulings do ledger.
