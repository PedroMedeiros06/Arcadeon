import { PlayerAvatar } from "./rooms";
import { WordEntry, pickWordOptions } from "./drawWords";

export interface DrawRoomConfig {
  roundsPerPlayer: number;
  turnSeconds: number;
  visibility: "public" | "private";
  maxPlayers: number; // 2-16
}

export interface DrawPlayer {
  socketId: string;
  name: string;
  score: number;
  avatar: PlayerAvatar | null;
  hasGuessedThisTurn: boolean;
  lastGuessAt: number;
}

export type DrawRoomPhase = "lobby" | "picking-word" | "drawing" | "turn-results" | "results";

export interface StrokeEvent {
  type: "stroke";
  strokeId: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface ClearEvent {
  type: "clear";
  eventId: string;
}

export type DrawEvent = StrokeEvent | ClearEvent;

export type TurnEndReason = "timeout" | "all-guessed" | "drawer-left";

export interface DrawRoom {
  code: string;
  hostSocketId: string;
  config: DrawRoomConfig;
  players: Map<string, DrawPlayer>;
  phase: DrawRoomPhase;
  turnOrder: string[];
  currentTurnIndex: number;
  turnsCompletedByPlayer: Map<string, number>;
  currentDrawerSocketId: string | null;
  currentWord: string | null;
  wordOptions: WordEntry[] | null;
  turnEndsAt: number | null;
  events: DrawEvent[];
  usedWords: Set<string>;
  guessOrder: string[];
  turnTimeout: NodeJS.Timeout | null;
}

const RATE_LIMIT_MS = 350;

const rooms = new Map<string, DrawRoom>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

export function createDrawRoom(hostSocketId: string, config: DrawRoomConfig, hostName: string): DrawRoom {
  const code = generateCode();
  const room: DrawRoom = {
    code,
    hostSocketId,
    config,
    players: new Map(),
    phase: "lobby",
    turnOrder: [],
    currentTurnIndex: -1,
    turnsCompletedByPlayer: new Map(),
    currentDrawerSocketId: null,
    currentWord: null,
    wordOptions: null,
    turnEndsAt: null,
    events: [],
    usedWords: new Set(),
    guessOrder: [],
    turnTimeout: null,
  };
  room.players.set(hostSocketId, {
    socketId: hostSocketId,
    name: hostName.trim().slice(0, 10) || "Jogador",
    score: 0,
    avatar: null,
    hasGuessedThisTurn: false,
    lastGuessAt: 0,
  });
  rooms.set(code, room);
  return room;
}

export function getDrawRoom(code: string): DrawRoom | undefined {
  return rooms.get(code);
}

export function joinDrawRoom(
  code: string,
  socketId: string,
  name: string,
  avatar?: PlayerAvatar | null
): DrawRoom | null {
  const room = rooms.get(code);
  if (!room || room.phase !== "lobby") return null;
  if (room.players.size >= room.config.maxPlayers) return null;
  room.players.set(socketId, {
    socketId,
    name,
    score: 0,
    avatar: avatar ?? null,
    hasGuessedThisTurn: false,
    lastGuessAt: 0,
  });
  return room;
}

export function renameDrawPlayer(room: DrawRoom, socketId: string, name: string): boolean {
  const player = room.players.get(socketId);
  const trimmed = name.trim().slice(0, 10);
  if (!player || !trimmed) return false;
  player.name = trimmed;
  return true;
}

export function updateDrawPlayerAvatar(room: DrawRoom, socketId: string, avatar: PlayerAvatar): boolean {
  const player = room.players.get(socketId);
  if (!player) return false;
  player.avatar = avatar;
  return true;
}

export function updateDrawConfig(room: DrawRoom, config: DrawRoomConfig): boolean {
  if (config.maxPlayers < room.players.size) return false;
  room.config = config;
  return true;
}

export function transferDrawHost(room: DrawRoom, newHostSocketId: string): boolean {
  if (!room.players.has(newHostSocketId)) return false;
  room.hostSocketId = newHostSocketId;
  return true;
}

export function restartGame(room: DrawRoom): boolean {
  if (room.phase !== "results") return false;
  room.phase = "lobby";
  room.turnOrder = [];
  room.currentTurnIndex = -1;
  room.turnsCompletedByPlayer.clear();
  room.currentDrawerSocketId = null;
  room.currentWord = null;
  room.wordOptions = null;
  room.turnEndsAt = null;
  room.events = [];
  room.usedWords.clear();
  room.guessOrder = [];
  for (const player of room.players.values()) {
    player.score = 0;
    player.hasGuessedThisTurn = false;
  }
  return true;
}

function clearTurnTimeout(room: DrawRoom): void {
  if (room.turnTimeout) {
    clearTimeout(room.turnTimeout);
    room.turnTimeout = null;
  }
}

/** Remove jogador da sala e de toda estrutura derivada (turnOrder, progress). Retorna a sala fechada (code) se ficou vazia. */
export function leaveDrawRoom(
  socketId: string
): { room: DrawRoom | null; closedCode: string | null; drawerLeftDuringTurn: boolean } {
  for (const room of rooms.values()) {
    if (!room.players.has(socketId)) continue;

    const wasDrawer =
      room.currentDrawerSocketId === socketId && (room.phase === "picking-word" || room.phase === "drawing");

    room.players.delete(socketId);
    room.turnOrder = room.turnOrder.filter((id) => id !== socketId);
    room.turnsCompletedByPlayer.delete(socketId);

    if (room.players.size === 0) {
      clearTurnTimeout(room);
      rooms.delete(room.code);
      return { room: null, closedCode: room.code, drawerLeftDuringTurn: false };
    }

    if (room.hostSocketId === socketId) {
      room.hostSocketId = room.players.keys().next().value as string;
    }

    if (wasDrawer) {
      clearTurnTimeout(room);
    }

    return { room, closedCode: null, drawerLeftDuringTurn: wasDrawer };
  }
  return { room: null, closedCode: null, drawerLeftDuringTurn: false };
}

function allPlayersCompletedRounds(room: DrawRoom): boolean {
  for (const socketId of room.players.keys()) {
    const completed = room.turnsCompletedByPlayer.get(socketId) ?? 0;
    if (completed < room.config.roundsPerPlayer) return false;
  }
  return true;
}

function scheduleTurnTimeout(room: DrawRoom, onExpire: () => void): void {
  clearTurnTimeout(room);
  const ms = room.turnEndsAt! - Date.now();
  room.turnTimeout = setTimeout(() => {
    room.turnTimeout = null;
    onExpire();
  }, Math.max(0, ms));
}

export function startNextTurn(room: DrawRoom): void {
  const aliveIds = Array.from(room.players.keys());
  if (aliveIds.length === 0) return;

  // recalcula turnOrder mantendo quem ja estava, adicionando quem entrou
  room.turnOrder = room.turnOrder.filter((id) => room.players.has(id));
  for (const id of aliveIds) {
    if (!room.turnOrder.includes(id)) room.turnOrder.push(id);
  }

  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  const drawerId = room.turnOrder[room.currentTurnIndex];

  room.currentDrawerSocketId = drawerId;
  room.currentWord = null;
  room.wordOptions = pickWordOptions(room.usedWords, 3);
  room.phase = "picking-word";
  room.events = [];
  room.guessOrder = [];
  for (const player of room.players.values()) player.hasGuessedThisTurn = false;
}

export function chooseWord(
  room: DrawRoom,
  socketId: string,
  word: string,
  onTurnTimeout: (room: DrawRoom) => void
): boolean {
  if (room.phase !== "picking-word" || room.currentDrawerSocketId !== socketId) return false;
  const entry = room.wordOptions?.find((w) => w.word === word);
  if (!entry) return false;

  room.currentWord = entry.word;
  room.usedWords.add(entry.word);
  room.wordOptions = null;
  room.phase = "drawing";
  room.turnEndsAt = Date.now() + room.config.turnSeconds * 1000;

  scheduleTurnTimeout(room, () => onTurnTimeout(room));
  return true;
}

export function addStrokeEvent(
  room: DrawRoom,
  socketId: string,
  strokeId: string,
  points: { x: number; y: number }[],
  color: string,
  width: number
): StrokeEvent | null {
  if (room.phase !== "drawing" || room.currentDrawerSocketId !== socketId) return null;

  const existing = room.events.find(
    (e): e is StrokeEvent => e.type === "stroke" && e.strokeId === strokeId
  );
  if (existing) {
    existing.points.push(...points);
    // retorna so o fragmento novo (nao o evento consolidado inteiro), senao o
    // broadcast reenvia todos os pontos ja enviados antes e o client redesenha
    // o trace inteiro por cima de si mesmo a cada flush
    return { type: "stroke", strokeId, points: [...points], color, width };
  }
  const event: StrokeEvent = { type: "stroke", strokeId, points: [...points], color, width };
  room.events.push(event);
  return event;
}

export function undoLastStroke(room: DrawRoom, socketId: string): string | null {
  if (room.phase !== "drawing" || room.currentDrawerSocketId !== socketId) return null;
  for (let i = room.events.length - 1; i >= 0; i--) {
    const event = room.events[i];
    if (event.type === "stroke") {
      room.events.splice(i, 1);
      return event.strokeId;
    }
  }
  return null;
}

export function clearCanvasEvent(room: DrawRoom, socketId: string): ClearEvent | null {
  if (room.phase !== "drawing" || room.currentDrawerSocketId !== socketId) return null;
  const event: ClearEvent = { type: "clear", eventId: `${Date.now()}-${Math.random()}` };
  room.events.push(event);
  return event;
}

function normalizeGuess(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export interface GuessOutcome {
  correct: boolean;
  points: number;
  rank: number | null;
  alreadyGuessed: boolean;
  tooFast: boolean;
}

const RANK_SCORES = [100, 80, 60, 40];
function scoreForGuessRank(rank: number): number {
  return RANK_SCORES[rank - 1] ?? 20;
}
function drawerScore(correctGuessers: number): number {
  return 20 * correctGuessers;
}

export function submitGuess(room: DrawRoom, socketId: string, guess: string): GuessOutcome {
  const player = room.players.get(socketId);
  if (
    !player ||
    room.phase !== "drawing" ||
    socketId === room.currentDrawerSocketId ||
    !room.currentWord
  ) {
    return { correct: false, points: 0, rank: null, alreadyGuessed: false, tooFast: false };
  }

  if (player.hasGuessedThisTurn) {
    return { correct: false, points: 0, rank: null, alreadyGuessed: true, tooFast: false };
  }

  const now = Date.now();
  if (now - player.lastGuessAt < RATE_LIMIT_MS) {
    return { correct: false, points: 0, rank: null, alreadyGuessed: false, tooFast: true };
  }
  player.lastGuessAt = now;

  if (normalizeGuess(guess) !== normalizeGuess(room.currentWord)) {
    return { correct: false, points: 0, rank: null, alreadyGuessed: false, tooFast: false };
  }

  player.hasGuessedThisTurn = true;
  room.guessOrder.push(socketId);
  const rank = room.guessOrder.length;
  const points = scoreForGuessRank(rank);
  player.score += points;

  return { correct: true, points, rank, alreadyGuessed: false, tooFast: false };
}

export function allNonDrawersGuessed(room: DrawRoom): boolean {
  for (const [socketId, player] of room.players) {
    if (socketId === room.currentDrawerSocketId) continue;
    if (!player.hasGuessedThisTurn) return false;
  }
  return true;
}

export function endTurn(room: DrawRoom, reason: TurnEndReason): void {
  clearTurnTimeout(room);

  const drawer = room.currentDrawerSocketId ? room.players.get(room.currentDrawerSocketId) : null;
  if (drawer && reason !== "drawer-left") {
    drawer.score += drawerScore(room.guessOrder.length);
  }

  if (room.currentDrawerSocketId) {
    const prev = room.turnsCompletedByPlayer.get(room.currentDrawerSocketId) ?? 0;
    // "drawer-left" nao conta como turno completo (jogador nem esta mais na sala)
    if (reason !== "drawer-left") {
      room.turnsCompletedByPlayer.set(room.currentDrawerSocketId, prev + 1);
    }
  }

  room.turnEndsAt = null;

  if (room.players.size === 0) return;

  if (allPlayersCompletedRounds(room)) {
    room.phase = "results";
    room.currentDrawerSocketId = null;
    room.currentWord = null;
  } else {
    room.phase = "turn-results";
  }
}

export function roomToJson(room: DrawRoom) {
  return room;
}
