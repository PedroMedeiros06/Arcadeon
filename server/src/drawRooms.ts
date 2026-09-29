import { randomBytes, randomInt } from "crypto";
import { PlayerAvatar } from "./rooms";
import { Difficulty, WordEntry, normalizeWord, pickWordOptions } from "./drawWords";

/** classic = um desenha, todos chutam; teams = dois times; impostor = Artista Impostor */
export type GameMode = "classic" | "teams" | "impostor";

/**
 * Regras extras sorteadas por turno (classico e times):
 * blind = desenhista nao ve o proprio canvas; mono = so preto e branco; noUndo = sem borracha,
 * desfazer e limpar; fading = tracos somem depois de alguns segundos; lightning = 30s valendo 1,5x.
 */
export type Modifier = "blind" | "mono" | "noUndo" | "fading" | "lightning";
export const MODIFIERS: Modifier[] = ["blind", "mono", "noUndo", "fading", "lightning"];

export type Team = "a" | "b";

export interface DrawRoomConfig {
  roundsPerPlayer: number;
  turnSeconds: number;
  visibility: "public" | "private";
  maxPlayers: number; // 2-16
  mode: GameMode;
  modifiers: Modifier[];
}

/**
 * Jogador identificado por `id` estavel (nao pelo socket.id, que muda a cada reconexao/F5).
 * `token` e o segredo que so o dono recebe: com id + token o client retoma o lugar na sala.
 */
export interface DrawPlayer {
  id: string;
  token: string;
  /** null = desconectado, dentro da janela de reconexao */
  socketId: string | null;
  name: string;
  score: number;
  avatar: PlayerAvatar | null;
  team: Team;
  hasGuessedThisTurn: boolean;
  lastGuessAt: number;
  disconnectedAt: number | null;
  /** timers de "saiu de vez" / "perde host e vez"; limpos quando reconecta */
  disconnectTimers: NodeJS.Timeout[];
}

export type DrawRoomPhase =
  | "lobby"
  | "picking-word"
  | "drawing"
  | "turn-results"
  | "impostor-drawing"
  | "impostor-voting"
  | "impostor-guess"
  | "impostor-reveal"
  | "results";

export interface Point {
  x: number;
  y: number;
}

export interface StrokeEvent {
  type: "stroke";
  id: string;
  points: Point[];
  color: string;
  width: number;
  /** horario do servidor em que o evento comecou (modificador "some aos poucos") */
  at: number;
}

export interface FillEvent {
  type: "fill";
  id: string;
  x: number;
  y: number;
  color: string;
  at: number;
}

export type ShapeKind = "line" | "rect" | "ellipse";

export interface ShapeEvent {
  type: "shape";
  id: string;
  shape: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  at: number;
}

export interface ClearEvent {
  type: "clear";
  id: string;
  at: number;
}

export type DrawEvent = StrokeEvent | FillEvent | ShapeEvent | ClearEvent;

export type TurnEndReason = "timeout" | "all-guessed" | "drawer-left" | "stolen";

/** Estado de uma rodada do Artista Impostor (ver drawImpostor.ts). */
export interface ImpostorRound {
  impostorId: string;
  word: string;
  category: string;
  /** ordem dos tracos: cada jogador aparece uma vez por volta */
  strokeOrder: string[];
  strokeIndex: number;
  /** id do traco em andamento do jogador da vez (so 1 traco por vez) */
  currentStrokeId: string | null;
  colors: Map<string, string>;
  votes: Map<string, string>;
  caught: boolean | null;
  impostorGuess: string | null;
  impostorGuessedRight: boolean | null;
  gained: Map<string, number>;
  /** motivo especial de fim (impostor saiu da sala) */
  aborted: boolean;
}

export interface DrawRoom {
  code: string;
  hostId: string;
  config: DrawRoomConfig;
  players: Map<string, DrawPlayer>;
  phase: DrawRoomPhase;
  turnOrder: string[];
  currentTurnIndex: number;
  turnsCompletedByPlayer: Map<string, number>;
  drawerId: string | null;
  currentWord: string | null;
  currentDifficulty: Difficulty | null;
  wordOptions: WordEntry[] | null;
  pickEndsAt: number | null;
  turnEndsAt: number | null;
  /** modificador sorteado pro turno atual (so classico/times) */
  turnModifier: Modifier | null;
  /** times: quem roubou o turno do time adversario */
  stolenBy: string | null;
  events: DrawEvent[];
  usedWords: Set<string>;
  /** categorias das ultimas escolhas, pra variar o tema entre turnos */
  recentCategories: string[];
  guessOrder: string[];
  /** pontos ganhos por jogador no turno atual (acertadores + desenhista), mostrado no resumo do turno */
  turnPoints: Map<string, number>;
  /** impostor: rodada atual (1-based) e estado dela */
  impostorRoundNumber: number;
  impostor: ImpostorRound | null;
  lastImpostorId: string | null;
  /** fim da fase atual do impostor (traco da vez, votacao, chute) */
  phaseEndsAt: number | null;
  /** unico timer de fase da sala (escolha, turno, resumo); invalidado por token */
  phaseTimer: NodeJS.Timeout | null;
  timerToken: number;
}

const RATE_LIMIT_MS = 350;
export const PICK_SECONDS = 20;
export const LIGHTNING_SECONDS = 30;
export const LIGHTNING_MULTIPLIER = 1.5;
/** times: janela final em que o time adversario pode roubar */
export const STEAL_WINDOW_MS = 10_000;
const MAX_POINTS_PER_FRAGMENT = 400;
const MAX_EVENTS_PER_TURN = 3000;
/** quem caiu ha menos que isso ainda recebe a vez (provavel F5); mais que isso perde a vez */
const RECENT_DISCONNECT_MS = 8000;

const rooms = new Map<string, DrawRoom>();
/** socket.id -> jogador. Um socket so pode estar em uma sala. */
const socketIndex = new Map<string, { code: string; playerId: string }>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

export function randomId(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- sanitizacao (nada vindo do client e confiavel) ----------

export function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, 10) : "";
  return name || "Jogador";
}

export function sanitizeConfig(raw: unknown): DrawRoomConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
    return Math.min(max, Math.max(min, n));
  };
  const mode: GameMode = c.mode === "teams" || c.mode === "impostor" ? c.mode : "classic";
  const modifiers = Array.isArray(c.modifiers)
    ? MODIFIERS.filter((m) => (c.modifiers as unknown[]).includes(m))
    : [];
  return {
    roundsPerPlayer: int(c.roundsPerPlayer, 1, 10, 2),
    turnSeconds: int(c.turnSeconds, 30, 240, 90),
    visibility: c.visibility === "public" ? "public" : "private",
    maxPlayers: int(c.maxPlayers, 2, 16, 8),
    mode,
    // impostor nao usa modificadores
    modifiers: mode === "impostor" ? [] : modifiers,
  };
}

export function sanitizeColor(raw: unknown): string | null {
  return typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : null;
}

export function sanitizeWidth(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw <= 60 ? raw : null;
}

function sanitizeCoord(raw: unknown, max: number): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.round(Math.min(max + 50, Math.max(-50, raw)) * 10) / 10;
}

export function sanitizeId(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 && raw.length <= 40 ? raw : null;
}

export function sanitizePoints(raw: unknown): Point[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_POINTS_PER_FRAGMENT) return null;
  const points: Point[] = [];
  for (const p of raw) {
    const x = sanitizeCoord(p?.x, 800);
    const y = sanitizeCoord(p?.y, 600);
    if (x === null || y === null) return null;
    points.push({ x, y });
  }
  return points;
}

// ---------- sala e sessao ----------

function newPlayer(socketId: string, name: string, avatar: PlayerAvatar | null, team: Team): DrawPlayer {
  return {
    id: randomId(9),
    token: randomId(18),
    socketId,
    name,
    score: 0,
    avatar,
    team,
    hasGuessedThisTurn: false,
    lastGuessAt: 0,
    disconnectedAt: null,
    disconnectTimers: [],
  };
}

export function isConnected(player: DrawPlayer): boolean {
  return player.socketId !== null;
}

export function connectedCount(room: DrawRoom): number {
  let n = 0;
  for (const p of room.players.values()) if (isConnected(p)) n++;
  return n;
}

/** Time com menos gente (empate = A): quem entra cai nele. */
function smallerTeam(room: DrawRoom): Team {
  let a = 0;
  let b = 0;
  for (const p of room.players.values()) {
    if (p.team === "a") a++;
    else b++;
  }
  return b < a ? "b" : "a";
}

export function createDrawRoom(
  socketId: string,
  config: DrawRoomConfig,
  name: string,
  avatar: PlayerAvatar | null
): { room: DrawRoom; player: DrawPlayer } {
  const player = newPlayer(socketId, name, avatar, "a");
  const room: DrawRoom = {
    code: generateCode(),
    hostId: player.id,
    config,
    players: new Map([[player.id, player]]),
    phase: "lobby",
    turnOrder: [],
    currentTurnIndex: -1,
    turnsCompletedByPlayer: new Map(),
    drawerId: null,
    currentWord: null,
    currentDifficulty: null,
    wordOptions: null,
    pickEndsAt: null,
    turnEndsAt: null,
    turnModifier: null,
    stolenBy: null,
    events: [],
    usedWords: new Set(),
    recentCategories: [],
    guessOrder: [],
    turnPoints: new Map(),
    impostorRoundNumber: 0,
    impostor: null,
    lastImpostorId: null,
    phaseEndsAt: null,
    phaseTimer: null,
    timerToken: 0,
  };
  rooms.set(room.code, room);
  socketIndex.set(socketId, { code: room.code, playerId: player.id });
  return { room, player };
}

export function getDrawRoom(code: string): DrawRoom | undefined {
  return rooms.get(code);
}

export function isRoomAlive(room: DrawRoom): boolean {
  return rooms.get(room.code) === room;
}

export type JoinResult = { room: DrawRoom; player: DrawPlayer } | { error: string };

export function joinDrawRoom(code: string, socketId: string, name: string, avatar: PlayerAvatar | null): JoinResult {
  const room = rooms.get(code);
  if (!room) return { error: "Sala não encontrada." };
  if (room.phase !== "lobby") return { error: "A partida dessa sala já começou." };
  if (room.players.size >= room.config.maxPlayers) return { error: "Sala cheia." };
  const player = newPlayer(socketId, name, avatar, smallerTeam(room));
  room.players.set(player.id, player);
  socketIndex.set(socketId, { code: room.code, playerId: player.id });
  return { room, player };
}

/**
 * Retoma o lugar de um jogador (F5, queda de rede, troca de aba no celular). Devolve o socket
 * antigo (se ainda constava como conectado) pra ele ser tirado da sala socket.io.
 */
export function resumeDrawSession(
  code: unknown,
  playerId: unknown,
  token: unknown,
  socketId: string
): { room: DrawRoom; player: DrawPlayer; oldSocketId: string | null } | null {
  if (typeof code !== "string" || typeof playerId !== "string" || typeof token !== "string") return null;
  const room = rooms.get(code.toUpperCase());
  const player = room?.players.get(playerId);
  if (!room || !player || player.token !== token) return null;

  const oldSocketId = player.socketId && player.socketId !== socketId ? player.socketId : null;
  if (oldSocketId) socketIndex.delete(oldSocketId);
  player.socketId = socketId;
  player.disconnectedAt = null;
  for (const t of player.disconnectTimers) clearTimeout(t);
  player.disconnectTimers = [];
  socketIndex.set(socketId, { code: room.code, playerId: player.id });
  return { room, player, oldSocketId };
}

export function getSession(socketId: string): { room: DrawRoom; player: DrawPlayer } | null {
  const entry = socketIndex.get(socketId);
  if (!entry) return null;
  const room = rooms.get(entry.code);
  const player = room?.players.get(entry.playerId);
  if (!room || !player || player.socketId !== socketId) {
    socketIndex.delete(socketId);
    return null;
  }
  return { room, player };
}

/** Socket caiu: jogador continua na sala (desconectado) ate reconectar ou o timer tirar. */
export function markDisconnected(socketId: string): { room: DrawRoom; player: DrawPlayer } | null {
  const session = getSession(socketId);
  socketIndex.delete(socketId);
  if (!session) return null;
  session.player.socketId = null;
  session.player.disconnectedAt = Date.now();
  return session;
}

/** Tira o jogador de vez. Retorna se a sala fechou e se ele era o desenhista no meio do turno. */
export function removeDrawPlayer(
  room: DrawRoom,
  playerId: string
): { closed: boolean; drawerLeftDuringTurn: boolean } {
  const player = room.players.get(playerId);
  if (!player) return { closed: false, drawerLeftDuringTurn: false };

  for (const t of player.disconnectTimers) clearTimeout(t);
  if (player.socketId) socketIndex.delete(player.socketId);

  const wasDrawer = room.drawerId === playerId && (room.phase === "picking-word" || room.phase === "drawing");
  room.players.delete(playerId);
  room.turnOrder = room.turnOrder.filter((id) => id !== playerId);
  room.turnsCompletedByPlayer.delete(playerId);

  if (room.players.size === 0) {
    clearPhaseTimer(room);
    rooms.delete(room.code);
    return { closed: true, drawerLeftDuringTurn: false };
  }

  if (room.hostId === playerId) reassignHost(room);
  return { closed: false, drawerLeftDuringTurn: wasDrawer };
}

/** Passa o host pra alguem conectado (se tiver), senao pra qualquer um que sobrou. */
export function reassignHost(room: DrawRoom): void {
  const players = Array.from(room.players.values());
  const next = players.find((p) => p.id !== room.hostId && isConnected(p)) ?? players.find((p) => p.id !== room.hostId);
  if (next) room.hostId = next.id;
}

export function renameDrawPlayer(player: DrawPlayer, raw: unknown): boolean {
  if (typeof raw !== "string" || !raw.trim()) return false;
  player.name = sanitizeName(raw);
  return true;
}

export function updateDrawConfig(room: DrawRoom, config: DrawRoomConfig): boolean {
  if (config.maxPlayers < room.players.size) return false;
  room.config = config;
  return true;
}

export function transferDrawHost(room: DrawRoom, newHostId: unknown): boolean {
  if (typeof newHostId !== "string" || !room.players.has(newHostId)) return false;
  room.hostId = newHostId;
  return true;
}

// ---------- times ----------

/** Jogador troca de time no lobby (ou o host troca alguem). */
export function setPlayerTeam(room: DrawRoom, playerId: unknown, team: unknown): boolean {
  if (room.phase !== "lobby" || (team !== "a" && team !== "b") || typeof playerId !== "string") return false;
  const player = room.players.get(playerId);
  if (!player || player.team === team) return false;
  player.team = team;
  return true;
}

/** Embaralha e divide ao meio (sobra vai pro A). */
export function shuffleTeams(room: DrawRoom): boolean {
  if (room.phase !== "lobby") return false;
  const players = shuffle(Array.from(room.players.values()));
  players.forEach((p, i) => (p.team = i % 2 === 0 ? "a" : "b"));
  return true;
}

function teamMembers(room: DrawRoom, team: Team, connectedOnly = false): DrawPlayer[] {
  return Array.from(room.players.values()).filter((p) => p.team === team && (!connectedOnly || isConnected(p)));
}

// ---------- timer de fase (um por sala) ----------

export function clearPhaseTimer(room: DrawRoom): void {
  room.timerToken++;
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
}

/** Agenda o proximo passo da sala; qualquer mudanca de fase posterior invalida este timer. */
export function schedulePhaseTimer(room: DrawRoom, at: number, fn: () => void): void {
  clearPhaseTimer(room);
  const token = room.timerToken;
  room.phaseTimer = setTimeout(() => {
    room.phaseTimer = null;
    if (room.timerToken !== token || !isRoomAlive(room)) return;
    fn();
  }, Math.max(0, at - Date.now()));
}

// ---------- partida ----------

export function resetTurnState(room: DrawRoom): void {
  room.drawerId = null;
  room.currentWord = null;
  room.currentDifficulty = null;
  room.wordOptions = null;
  room.pickEndsAt = null;
  room.turnEndsAt = null;
  room.turnModifier = null;
  room.stolenBy = null;
  room.events = [];
  room.guessOrder = [];
  room.turnPoints.clear();
  room.impostor = null;
  room.phaseEndsAt = null;
  for (const player of room.players.values()) player.hasGuessedThisTurn = false;
}

/** Valida e prepara o inicio. Retorna uma mensagem de erro pro host ou null se pode comecar. */
export function startGame(room: DrawRoom): string | null {
  if (room.phase !== "lobby") return "A partida já começou.";
  const connected = connectedCount(room);
  if (room.config.mode === "impostor" && connected < 3) return "O Artista Impostor precisa de pelo menos 3 jogadores.";
  if (connected < 2) return "Precisa de pelo menos 2 jogadores.";
  if (room.config.mode === "teams") {
    const a = teamMembers(room, "a", true);
    const b = teamMembers(room, "b", true);
    if (a.length < 2 || b.length < 2) return "Cada time precisa de pelo menos 2 jogadores.";
  }

  room.turnOrder = [];
  room.currentTurnIndex = -1;
  room.turnsCompletedByPlayer.clear();
  room.impostorRoundNumber = 0;
  room.lastImpostorId = null;
  for (const player of room.players.values()) player.score = 0;

  if (room.config.mode === "teams") {
    // alterna os times: A1, B1, A2, B2... (quem sobrar no time maior vai no fim)
    const a = shuffle(teamMembers(room, "a"));
    const b = shuffle(teamMembers(room, "b"));
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) room.turnOrder.push(a[i].id);
      if (b[i]) room.turnOrder.push(b[i].id);
    }
  }
  return null;
}

export function restartGame(room: DrawRoom): boolean {
  if (room.phase !== "results") return false;
  clearPhaseTimer(room);
  room.phase = "lobby";
  room.turnOrder = [];
  room.currentTurnIndex = -1;
  room.turnsCompletedByPlayer.clear();
  room.impostorRoundNumber = 0;
  resetTurnState(room);
  // usedWords NAO e limpo: "jogar novamente" na mesma sala continua sem repetir palavra
  for (const player of room.players.values()) player.score = 0;
  return true;
}

function allPlayersCompletedRounds(room: DrawRoom): boolean {
  for (const id of room.players.keys()) {
    if ((room.turnsCompletedByPlayer.get(id) ?? 0) < room.config.roundsPerPlayer) return false;
  }
  return true;
}

export function finishGame(room: DrawRoom): void {
  clearPhaseTimer(room);
  resetTurnState(room);
  room.phase = "results";
}

/**
 * Proximo desenhista na ordem. Pula quem ja fez todas as rodadas; quem esta desconectado ha mais
 * de alguns segundos perde a vez (conta como feita) pra partida nunca travar esperando alguem.
 * Retorna false se a partida acabou (fase vira "results").
 */
export function startNextTurn(room: DrawRoom): boolean {
  room.turnOrder = room.turnOrder.filter((id) => room.players.has(id));
  for (const id of room.players.keys()) {
    if (!room.turnOrder.includes(id)) room.turnOrder.push(id);
  }

  const n = room.turnOrder.length;
  if (room.players.size < 2) {
    finishGame(room);
    return false;
  }

  const now = Date.now();
  for (let attempt = 0; attempt < n * 2; attempt++) {
    if (allPlayersCompletedRounds(room)) break;
    room.currentTurnIndex = (room.currentTurnIndex + 1) % n;
    const id = room.turnOrder[room.currentTurnIndex];
    const player = room.players.get(id)!;
    const done = room.turnsCompletedByPlayer.get(id) ?? 0;
    if (done >= room.config.roundsPerPlayer) continue;
    if (!isConnected(player) && now - (player.disconnectedAt ?? 0) > RECENT_DISCONNECT_MS) {
      room.turnsCompletedByPlayer.set(id, done + 1);
      continue;
    }

    resetTurnState(room);
    room.drawerId = id;
    // modificador sorteado ja na escolha: o desenhista escolhe a palavra sabendo a regra
    const mods = room.config.modifiers;
    room.turnModifier = mods.length > 0 ? mods[randomInt(mods.length)] : null;
    room.wordOptions = pickWordOptions(room.usedWords, room.recentCategories);
    // as 3 oferecidas ficam queimadas (inclusive as nao escolhidas): nenhuma palavra reaparece na sessao
    for (const option of room.wordOptions) room.usedWords.add(option.word);
    room.phase = "picking-word";
    room.pickEndsAt = now + PICK_SECONDS * 1000;
    return true;
  }

  finishGame(room);
  return false;
}

/** Rodada atual (1-based) = menor numero de turnos completos entre os vivos + 1, limitado ao total. */
export function currentRound(room: DrawRoom): number {
  if (room.config.mode === "impostor") return Math.max(1, room.impostorRoundNumber);
  let min = Infinity;
  for (const id of room.players.keys()) {
    min = Math.min(min, room.turnsCompletedByPlayer.get(id) ?? 0);
  }
  if (!Number.isFinite(min)) return 1;
  return Math.min(min + 1, room.config.roundsPerPlayer);
}

/** Duracao do turno de desenho (o modificador relampago encurta). */
export function turnDurationMs(room: DrawRoom): number {
  const seconds =
    room.turnModifier === "lightning" ? Math.min(room.config.turnSeconds, LIGHTNING_SECONDS) : room.config.turnSeconds;
  return seconds * 1000;
}

function pointsMultiplier(room: DrawRoom): number {
  return room.turnModifier === "lightning" ? LIGHTNING_MULTIPLIER : 1;
}

export function chooseWord(room: DrawRoom, playerId: string, word: unknown): boolean {
  if (room.phase !== "picking-word" || room.drawerId !== playerId) return false;
  const entry = room.wordOptions?.find((w) => w.word === word);
  if (!entry) return false;
  beginDrawing(room, entry);
  return true;
}

/** Tempo de escolha estourou: servidor escolhe uma das opcoes. */
export function autoChooseWord(room: DrawRoom): void {
  if (room.phase !== "picking-word" || !room.wordOptions?.length) return;
  beginDrawing(room, room.wordOptions[Math.floor(Math.random() * room.wordOptions.length)]);
}

function beginDrawing(room: DrawRoom, entry: WordEntry): void {
  room.currentWord = entry.word;
  room.currentDifficulty = entry.difficulty;
  room.recentCategories = [entry.category, ...room.recentCategories].slice(0, 3);
  room.wordOptions = null;
  room.pickEndsAt = null;
  room.phase = "drawing";
  room.turnEndsAt = Date.now() + turnDurationMs(room);
}

// ---------- desenho ----------

export type DrawPermission = { ok: true; forcedColor: string | null } | { ok: false };

/**
 * Quem pode desenhar agora e com qual cor. No impostor so o jogador da vez, na cor dele; no
 * modificador "uma cor" so preto e branco (branco = borracha).
 */
function drawPermission(room: DrawRoom, playerId: string): DrawPermission {
  if (room.events.length >= MAX_EVENTS_PER_TURN) return { ok: false };
  if (room.phase === "drawing" && room.drawerId === playerId) return { ok: true, forcedColor: null };
  if (room.phase === "impostor-drawing" && room.impostor) {
    const turnOf = room.impostor.strokeOrder[room.impostor.strokeIndex];
    if (turnOf === playerId) return { ok: true, forcedColor: room.impostor.colors.get(playerId) ?? "#000000" };
  }
  return { ok: false };
}

function colorAllowed(room: DrawRoom, color: string): boolean {
  return room.turnModifier !== "mono" || color === "#000000" || color === "#ffffff";
}

/**
 * Um traco chega em varios fragmentos (a cada ~40ms) com o mesmo id: os pontos sao concatenados
 * num unico evento, entao desfazer sempre remove o traco inteiro. Retorna so o fragmento novo pro
 * broadcast.
 */
export function addStrokeFragment(room: DrawRoom, playerId: string, data: Record<string, unknown>): StrokeEvent | null {
  const permission = drawPermission(room, playerId);
  if (!permission.ok) return null;
  const id = sanitizeId(data.id);
  const points = sanitizePoints(data.points);
  const color = permission.forcedColor ?? sanitizeColor(data.color);
  const width = sanitizeWidth(data.width);
  if (!id || !points || !color || width === null || !colorAllowed(room, color)) return null;

  // impostor: 1 traco por vez; outro id na mesma vez e recusado
  if (room.phase === "impostor-drawing" && room.impostor) {
    if (room.impostor.currentStrokeId && room.impostor.currentStrokeId !== id) return null;
    room.impostor.currentStrokeId = id;
  }

  const last = room.events[room.events.length - 1];
  const existing =
    last?.type === "stroke" && last.id === id
      ? last
      : room.events.find((e): e is StrokeEvent => e.type === "stroke" && e.id === id);
  if (existing) {
    if (existing.points.length + points.length > 20000) return null;
    existing.points.push(...points);
    return { type: "stroke", id, points, color: existing.color, width: existing.width, at: existing.at };
  }
  const event: StrokeEvent = { type: "stroke", id, points, color, width, at: Date.now() };
  room.events.push(event);
  return event;
}

export function addFill(room: DrawRoom, playerId: string, data: Record<string, unknown>): FillEvent | null {
  // balde nao combina com "some aos poucos" (pintaria a tela toda quando a borda sumir) nem com o impostor
  if (room.phase !== "drawing" || room.turnModifier === "fading") return null;
  const permission = drawPermission(room, playerId);
  if (!permission.ok) return null;
  const id = sanitizeId(data.id);
  const x = sanitizeCoord(data.x, 800);
  const y = sanitizeCoord(data.y, 600);
  const color = sanitizeColor(data.color);
  if (!id || x === null || y === null || !color || !colorAllowed(room, color)) return null;
  if (x < 0 || x >= 800 || y < 0 || y >= 600) return null;
  const event: FillEvent = { type: "fill", id, x, y, color, at: Date.now() };
  room.events.push(event);
  return event;
}

const SHAPES: ShapeKind[] = ["line", "rect", "ellipse"];

export function addShape(room: DrawRoom, playerId: string, data: Record<string, unknown>): ShapeEvent | null {
  if (room.phase !== "drawing") return null;
  const permission = drawPermission(room, playerId);
  if (!permission.ok) return null;
  const id = sanitizeId(data.id);
  const shape = SHAPES.find((s) => s === data.shape);
  const x1 = sanitizeCoord(data.x1, 800);
  const y1 = sanitizeCoord(data.y1, 600);
  const x2 = sanitizeCoord(data.x2, 800);
  const y2 = sanitizeCoord(data.y2, 600);
  const color = sanitizeColor(data.color);
  const width = sanitizeWidth(data.width);
  if (!id || !shape || x1 === null || y1 === null || x2 === null || y2 === null || !color || width === null) {
    return null;
  }
  if (!colorAllowed(room, color)) return null;
  const event: ShapeEvent = { type: "shape", id, shape, x1, y1, x2, y2, color, width, at: Date.now() };
  room.events.push(event);
  return event;
}

/** Desfaz a ultima acao (traco, balde, forma ou o proprio "limpar"). Retorna o id removido. */
export function undoLast(room: DrawRoom, playerId: string): string | null {
  if (room.phase !== "drawing" || room.drawerId !== playerId || room.turnModifier === "noUndo") return null;
  const event = room.events.pop();
  return event ? event.id : null;
}

export function clearCanvas(room: DrawRoom, playerId: string, rawId: unknown): ClearEvent | null {
  if (room.phase !== "drawing" || room.turnModifier === "noUndo") return null;
  if (!drawPermission(room, playerId).ok) return null;
  const event: ClearEvent = { type: "clear", id: sanitizeId(rawId) ?? randomId(6), at: Date.now() };
  room.events.push(event);
  return event;
}

/**
 * Todos os eventos do turno, pra reconstruir o canvas de quem reconectou. Vai a lista inteira (nao
 * so desde o ultimo "limpar") porque desfazer um "limpar" traz de volta o que estava antes dele.
 */
export function canvasSnapshot(room: DrawRoom): DrawEvent[] {
  return room.events;
}

// ---------- palpites e pontuacao ----------

/** Distancia de edicao (Levenshtein), usada so pra detectar palpite "quase certo". */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function isCloseGuess(guess: string, word: string): boolean {
  const g = normalizeWord(guess);
  const w = normalizeWord(word);
  return w.length >= 4 && g !== w && editDistance(g, w) === 1;
}

export interface GuessOutcome {
  correct: boolean;
  /** errou por 1 letra (so o autor fica sabendo, nao vai pro feed dos outros) */
  close: boolean;
  points: number;
  rank: number | null;
  alreadyGuessed: boolean;
  tooFast: boolean;
  /** times: adversario tentando antes da janela de roubo */
  notYourTurn: boolean;
  /** times: acerto do time adversario na janela final */
  stole: boolean;
}

// Pontuacao:
// - quem acerta: base 50 + ate 100 proporcional ao tempo restante + bonus de ordem (1o/2o/3o).
//   Acertar rapido vale bem mais que so ser o primeiro, e acertar no fim ainda vale algo.
// - desenhista: media dos pontos dos adivinhadores (quem nao acertou conta 0). Escala sozinho
//   com o tamanho da sala e premia desenho claro (todos acertam rapido = muitos pontos).
const GUESS_BASE = 50;
const GUESS_TIME_BONUS = 100;
const RANK_BONUS = [40, 25, 10];
/** times: roubo vale como um acerto de 1o lugar com o tempo que restava + esse bonus */
const STEAL_BONUS = 50;

export function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

// palavra mais dificil vale mais (pra quem acerta e, pela media, pro desenhista)
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { 1: 1, 2: 1.25, 3: 1.5 };

export function scoreForGuess(rank: number, timeLeftRatio: number, difficulty: Difficulty = 1): number {
  const ratio = Math.min(1, Math.max(0, timeLeftRatio));
  const raw = GUESS_BASE + GUESS_TIME_BONUS * ratio + (RANK_BONUS[rank - 1] ?? 0);
  return roundTo5(raw * DIFFICULTY_MULTIPLIER[difficulty]);
}

/** Maximo possivel por acerto (1o lugar, na hora): mostrado na escolha de palavra. */
export function maxPointsFor(difficulty: Difficulty, room?: DrawRoom): number {
  return roundTo5(scoreForGuess(1, 1, difficulty) * (room ? pointsMultiplier(room) : 1));
}

export function drawerScore(guesserPoints: number[], nonDrawerCount: number): number {
  if (nonDrawerCount <= 0 || guesserPoints.length === 0) return 0;
  const total = guesserPoints.reduce((sum, p) => sum + p, 0);
  return roundTo5(total / nonDrawerCount);
}

const EMPTY_OUTCOME: GuessOutcome = {
  correct: false,
  close: false,
  points: 0,
  rank: null,
  alreadyGuessed: false,
  tooFast: false,
  notYourTurn: false,
  stole: false,
};

/** Times: o adversario so pode chutar nos ultimos segundos (janela de roubo). */
export function inStealWindow(room: DrawRoom, now = Date.now()): boolean {
  return room.phase === "drawing" && room.turnEndsAt !== null && room.turnEndsAt - now <= STEAL_WINDOW_MS;
}

export function isOpponent(room: DrawRoom, player: DrawPlayer): boolean {
  if (room.config.mode !== "teams" || !room.drawerId) return false;
  const drawer = room.players.get(room.drawerId);
  return !!drawer && drawer.team !== player.team;
}

export function submitGuess(room: DrawRoom, player: DrawPlayer, guess: string): GuessOutcome {
  if (room.phase !== "drawing" || player.id === room.drawerId || !room.currentWord) {
    return { ...EMPTY_OUTCOME };
  }
  if (player.hasGuessedThisTurn) return { ...EMPTY_OUTCOME, alreadyGuessed: true };

  const now = Date.now();
  const opponent = isOpponent(room, player);
  if (opponent && !inStealWindow(room, now)) return { ...EMPTY_OUTCOME, notYourTurn: true };
  if (now - player.lastGuessAt < RATE_LIMIT_MS) return { ...EMPTY_OUTCOME, tooFast: true };
  player.lastGuessAt = now;

  if (normalizeWord(guess) !== normalizeWord(room.currentWord)) {
    return { ...EMPTY_OUTCOME, close: isCloseGuess(guess, room.currentWord) };
  }

  const totalMs = turnDurationMs(room);
  const timeLeftRatio = room.turnEndsAt ? (room.turnEndsAt - now) / totalMs : 0;
  const multiplier = pointsMultiplier(room);
  player.hasGuessedThisTurn = true;

  if (opponent) {
    // roubo: o time adversario leva os pontos e o turno acaba na hora
    const points = roundTo5((scoreForGuess(1, timeLeftRatio, room.currentDifficulty ?? 1) + STEAL_BONUS) * multiplier);
    player.score += points;
    room.turnPoints.set(player.id, points);
    room.stolenBy = player.id;
    return { ...EMPTY_OUTCOME, correct: true, points, rank: 1, stole: true };
  }

  room.guessOrder.push(player.id);
  const rank = room.guessOrder.length;
  const points = roundTo5(scoreForGuess(rank, timeLeftRatio, room.currentDifficulty ?? 1) * multiplier);
  player.score += points;
  room.turnPoints.set(player.id, points);
  return { ...EMPTY_OUTCOME, correct: true, points, rank };
}

/**
 * Quem conta como adivinhador no turno: conectado, ou desconectado mas que ja acertou. Nos times,
 * so o time do desenhista (o adversario so rouba).
 */
function activeGuessers(room: DrawRoom): DrawPlayer[] {
  const drawer = room.drawerId ? room.players.get(room.drawerId) : null;
  return Array.from(room.players.values()).filter(
    (p) =>
      p.id !== room.drawerId &&
      (isConnected(p) || p.hasGuessedThisTurn) &&
      (room.config.mode !== "teams" || !drawer || p.team === drawer.team)
  );
}

/** Todos os adivinhadores conectados ja acertaram (quem caiu nao segura o turno). */
export function allNonDrawersGuessed(room: DrawRoom): boolean {
  if (room.phase !== "drawing") return false;
  const guessers = activeGuessers(room);
  return guessers.length > 0 && guessers.every((p) => p.hasGuessedThisTurn);
}

export function endTurn(room: DrawRoom, reason: TurnEndReason): void {
  clearPhaseTimer(room);

  const drawer = room.drawerId ? room.players.get(room.drawerId) : null;
  if (drawer && reason !== "drawer-left") {
    const guesserPoints = room.guessOrder.map((id) => room.turnPoints.get(id) ?? 0);
    const points = drawerScore(guesserPoints, activeGuessers(room).length);
    drawer.score += points;
    room.turnPoints.set(drawer.id, points);
  }

  // "drawer-left" nao conta como turno feito: se ele voltar, ainda desenha
  if (room.drawerId && reason !== "drawer-left") {
    const prev = room.turnsCompletedByPlayer.get(room.drawerId) ?? 0;
    room.turnsCompletedByPlayer.set(room.drawerId, prev + 1);
  }

  room.turnEndsAt = null;
  room.pickEndsAt = null;
  room.wordOptions = null;
  room.phase = "turn-results";
}
