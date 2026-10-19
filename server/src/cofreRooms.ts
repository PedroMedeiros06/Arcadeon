import { randomUUID } from "crypto";
import { PlayerAvatar } from "./rooms";
import { sanitizeAvatar, sanitizeName } from "./raceRooms";
import {
  BOARD_SIZES,
  BoardSize,
  GameState,
  activePlayers,
  createGame,
  flip,
  passTurn,
  placements,
  removePlayer,
  resolveMiss,
} from "./cofreEngine";

export { sanitizeAvatar, sanitizeName };

export type TurnSeconds = 0 | 8 | 12 | 20;

export interface CofreRoomConfig {
  size: BoardSize;
  maxPlayers: number; // 2-8
  /** 0 = sem limite */
  turnSeconds: TurnSeconds;
  movingBoard: boolean;
  coringa: boolean;
  peek: boolean;
}

export interface CofrePlayer {
  socketId: string;
  name: string;
  avatar: PlayerAvatar | null;
  userId: string | null;
  joinSeq: number;
}

export type CofrePhase = "lobby" | "countdown" | "peek" | "playing" | "results";

export type CofreEvent =
  | { seq: number; kind: "match"; by: string; a: number; b: number; points: 1 | 3 }
  | { seq: number; kind: "miss"; by: string; a: number; b: number }
  | { seq: number; kind: "timeout"; by: string }
  | { seq: number; kind: "left"; by: string };

export type GameEndReason = "finished" | "players-left";

export interface CofreRoom {
  code: string;
  hostSocketId: string;
  config: CofreRoomConfig;
  players: Map<string, CofrePlayer>;
  phase: CofrePhase;
  nextJoinSeq: number;
  game: GameState | null;
  /** socketId de cada indice de game.players (fixo durante a partida) */
  seats: string[];
  /** nomes/avatares de quem saiu, pra tela final */
  seatInfo: { name: string; avatar: PlayerAvatar | null }[];
  phaseEndsAt: number | null;
  /** ninguem vira carta antes disso (animacao da troca do tabuleiro movel) */
  lockedUntil: number;
  swap: { a: number; b: number; seq: number } | null;
  lastEvent: CofreEvent | null;
  eventSeq: number;
  endReason: GameEndReason | null;
  /** id da partida pras moedas (award_match_coins e idempotente por ele) */
  matchId: string | null;
  timer: NodeJS.Timeout | null;
  timerToken: number;
}

// COFRE_FAST_TIMERS so encurta duracoes (simulador); regras e validacoes sao as mesmas
const FAST = process.env.COFRE_FAST_TIMERS === "1";
export const COUNTDOWN_MS = FAST ? 300 : 3800;
export const PEEK_MS = FAST ? 300 : 3000;
/** tempo que as duas cartas erradas ficam a mostra */
export const MISS_REVEAL_MS = FAST ? 150 : 1000;
/** virada de volta (300 ms) + deslize da troca (600 ms) */
export const SWAP_LOCK_MS = FAST ? 100 : 950;
/** ultimo par aparece antes da tela final */
export const FINISH_DELAY_MS = FAST ? 100 : 1200;
const FAST_TURN_MS = 400;

const SIZES = Object.keys(BOARD_SIZES) as BoardSize[];
const TURN_SECONDS: TurnSeconds[] = [0, 8, 12, 20];

const rooms = new Map<string, CofreRoom>();
const socketToRoom = new Map<string, string>();

type RoomListener = (room: CofreRoom) => void;
let onAutoAdvance: RoomListener = () => {};
let onPeek: (room: CofreRoom, faces: string[], endsAt: number) => void = () => {};
let onGameFinished: RoomListener = () => {};

/** cofreSocket registra aqui o broadcast disparado quando um timer muda o estado sozinho. */
export function setCofreAutoAdvanceListener(listener: RoomListener): void {
  onAutoAdvance = listener;
}

/** Espiada inicial: unico momento em que faces escondidas saem do servidor (de proposito). */
export function setCofrePeekListener(listener: (room: CofreRoom, faces: string[], endsAt: number) => void): void {
  onPeek = listener;
}

/** Chamado uma vez quando a partida termina (moedas e ranking). */
export function setCofreGameFinishedListener(listener: RoomListener): void {
  onGameFinished = listener;
}

export function setCofrePlayerUser(socketId: string, userId: string | null): void {
  const player = getRoomForSocket(socketId)?.players.get(socketId);
  if (player) player.userId = userId;
}

export function sanitizeConfig(input: unknown): CofreRoomConfig {
  const c = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const rawMax = typeof c.maxPlayers === "number" && Number.isFinite(c.maxPlayers) ? Math.round(c.maxPlayers) : 4;
  return {
    size: SIZES.includes(c.size as BoardSize) ? (c.size as BoardSize) : "6x4",
    maxPlayers: Math.min(8, Math.max(2, rawMax)),
    turnSeconds: TURN_SECONDS.includes(c.turnSeconds as TurnSeconds) ? (c.turnSeconds as TurnSeconds) : 12,
    movingBoard: c.movingBoard === true,
    coringa: c.coringa === true,
    peek: c.peek === true,
  };
}

// ---------- ciclo de vida da sala ----------

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

export function hasCofreRoom(code: string): boolean {
  return rooms.has(code);
}

export function getRoomForSocket(socketId: string): CofreRoom | undefined {
  const code = socketToRoom.get(socketId);
  return code ? rooms.get(code) : undefined;
}

export function createCofreRoom(hostSocketId: string, config: CofreRoomConfig, name: string, avatar: PlayerAvatar | null): CofreRoom {
  const room: CofreRoom = {
    code: generateCode(),
    hostSocketId,
    config,
    players: new Map(),
    phase: "lobby",
    nextJoinSeq: 1,
    game: null,
    seats: [],
    seatInfo: [],
    phaseEndsAt: null,
    lockedUntil: 0,
    swap: null,
    lastEvent: null,
    eventSeq: 0,
    endReason: null,
    matchId: null,
    timer: null,
    timerToken: 0,
  };
  room.players.set(hostSocketId, { socketId: hostSocketId, name, avatar, userId: null, joinSeq: 0 });
  rooms.set(room.code, room);
  socketToRoom.set(hostSocketId, room.code);
  return room;
}

export type JoinResult = { room: CofreRoom } | { error: string };

export function joinCofreRoom(code: string, socketId: string, name: string, avatar: PlayerAvatar | null): JoinResult {
  const room = rooms.get(code);
  if (!room) return { error: "Sala não encontrada." };
  if (room.phase !== "lobby") return { error: "A partida já começou." };
  if (room.players.size >= room.config.maxPlayers) return { error: "Sala cheia." };
  room.players.set(socketId, { socketId, name, avatar, userId: null, joinSeq: room.nextJoinSeq++ });
  socketToRoom.set(socketId, room.code);
  return { room };
}

export function renameCofrePlayer(room: CofreRoom, socketId: string, name: string): boolean {
  const player = room.players.get(socketId);
  if (!player || room.phase !== "lobby") return false;
  player.name = name;
  return true;
}

export function updateCofrePlayerAvatar(room: CofreRoom, socketId: string, avatar: PlayerAvatar | null): boolean {
  const player = room.players.get(socketId);
  if (!player || room.phase !== "lobby") return false;
  player.avatar = avatar;
  return true;
}

export function updateCofreConfig(room: CofreRoom, config: CofreRoomConfig): boolean {
  if (room.phase !== "lobby" || config.maxPlayers < room.players.size) return false;
  room.config = config;
  return true;
}

export function transferCofreHost(room: CofreRoom, newHostSocketId: string): boolean {
  if (room.phase !== "lobby" || !room.players.has(newHostSocketId)) return false;
  room.hostSocketId = newHostSocketId;
  return true;
}

// ---------- timers (um por sala, invalidados por token) ----------

function clearRoomTimer(room: CofreRoom): void {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.timerToken++;
}

function scheduleRoomTimer(room: CofreRoom, at: number, action: (room: CofreRoom) => void): void {
  clearRoomTimer(room);
  const token = room.timerToken;
  room.timer = setTimeout(() => {
    // timer de uma fase antiga nunca mexe na fase atual, nem em sala ja apagada
    if (room.timerToken !== token || rooms.get(room.code) !== room) return;
    room.timer = null;
    action(room);
    onAutoAdvance(room);
  }, Math.max(0, at - Date.now()));
}

function nextEvent<T extends Omit<CofreEvent, "seq">>(room: CofreRoom, event: T): T & { seq: number } {
  room.eventSeq++;
  return { ...event, seq: room.eventSeq };
}

// ---------- fases ----------

export function startCofreGame(room: CofreRoom): boolean {
  if (room.phase !== "lobby" || room.players.size < 2) return false;
  const players = Array.from(room.players.values()).sort((a, b) => a.joinSeq - b.joinSeq);
  room.seats = players.map((p) => p.socketId);
  room.seatInfo = players.map((p) => ({ name: p.name, avatar: p.avatar }));
  const { size, movingBoard, coringa } = room.config;
  room.game = createGame({ size, movingBoard, coringa }, players.length, Math.random);
  // quem comeca e sorteado
  room.game = { ...room.game, turn: Math.floor(Math.random() * players.length) };
  room.swap = null;
  room.lastEvent = null;
  room.endReason = null;
  room.matchId = randomUUID();
  room.lockedUntil = 0;
  room.phase = "countdown";
  room.phaseEndsAt = Date.now() + COUNTDOWN_MS;
  scheduleRoomTimer(room, room.phaseEndsAt, afterCountdown);
  return true;
}

function afterCountdown(room: CofreRoom): void {
  if (!room.config.peek || !room.game) {
    startTurn(room);
    return;
  }
  room.phase = "peek";
  room.phaseEndsAt = Date.now() + PEEK_MS;
  onPeek(room, room.game.cells.map((c) => c.face), room.phaseEndsAt);
  scheduleRoomTimer(room, room.phaseEndsAt, startTurn);
}

function turnMs(room: CofreRoom): number {
  if (room.config.turnSeconds === 0) return 0;
  return FAST ? FAST_TURN_MS : room.config.turnSeconds * 1000;
}

/** Comeca (ou renova) o relogio da vez atual, a partir do fim da trava de animacao. */
function startTurn(room: CofreRoom): void {
  room.phase = "playing";
  const ms = turnMs(room);
  if (ms === 0) {
    clearRoomTimer(room);
    room.phaseEndsAt = null;
    return;
  }
  room.phaseEndsAt = Math.max(Date.now(), room.lockedUntil) + ms;
  scheduleRoomTimer(room, room.phaseEndsAt, timeoutTurn);
}

function timeoutTurn(room: CofreRoom): void {
  if (room.phase !== "playing" || !room.game) return;
  const by = room.seats[room.game.turn];
  room.game = passTurn(room.game);
  room.lastEvent = nextEvent(room, { kind: "timeout", by });
  startTurn(room);
}

export type FlipRejection = "not-in-game" | "not-your-turn" | "locked" | "invalid";

/** Sala decide quem pode virar: so o jogador da vez, fora da trava de animacao. */
export function flipCofreCard(room: CofreRoom, socketId: string, index: unknown): { ok: true } | { ok: false; reason: FlipRejection } {
  const game = room.game;
  if (room.phase !== "playing" || !game) return { ok: false, reason: "not-in-game" };
  if (room.seats[game.turn] !== socketId) return { ok: false, reason: "not-your-turn" };
  if (Date.now() < room.lockedUntil) return { ok: false, reason: "locked" };
  if (typeof index !== "number") return { ok: false, reason: "invalid" };
  const result = flip(game, index);
  const event = result.event;
  if (event.kind === "invalid") return { ok: false, reason: "invalid" };
  room.game = result.state;

  if (event.kind === "match") {
    room.lastEvent = nextEvent(room, { kind: "match", by: socketId, a: event.a, b: event.b, points: event.points });
    if (event.finished) {
      clearRoomTimer(room);
      room.phaseEndsAt = null;
      scheduleRoomTimer(room, Date.now() + FINISH_DELAY_MS, (r) => finishGame(r, "finished"));
    } else {
      // achou par: joga de novo com relogio cheio
      startTurn(room);
    }
  } else if (event.kind === "miss") {
    room.lastEvent = nextEvent(room, { kind: "miss", by: socketId, a: event.a, b: event.b });
    room.phaseEndsAt = null;
    scheduleRoomTimer(room, Date.now() + MISS_REVEAL_MS, afterMiss);
  }
  return { ok: true };
}

function afterMiss(room: CofreRoom): void {
  if (!room.game?.pendingMiss) return;
  const resolved = resolveMiss(room.game, Math.random);
  room.game = resolved.state;
  if (resolved.swap) {
    room.swap = { a: resolved.swap[0], b: resolved.swap[1], seq: (room.swap?.seq ?? 0) + 1 };
    room.lockedUntil = Date.now() + SWAP_LOCK_MS;
  }
  startTurn(room);
}

function finishGame(room: CofreRoom, reason: GameEndReason): void {
  clearRoomTimer(room);
  room.phase = "results";
  room.endReason = reason;
  room.phaseEndsAt = null;
  onGameFinished(room);
}

export function restartCofreGame(room: CofreRoom): boolean {
  if (room.phase !== "results") return false;
  clearRoomTimer(room);
  room.phase = "lobby";
  room.game = null;
  room.seats = [];
  room.seatInfo = [];
  room.swap = null;
  room.lastEvent = null;
  room.endReason = null;
  room.phaseEndsAt = null;
  room.lockedUntil = 0;
  return true;
}

export function cofrePlacements(room: CofreRoom): number[] {
  return room.game ? placements(room.game.players) : [];
}

/** Remove o jogador de tudo. Retorna a sala (se ainda existe) ou o codigo da sala fechada. */
export function leaveCofreRoom(socketId: string): { room: CofreRoom | null; closedCode: string | null } {
  const code = socketToRoom.get(socketId);
  socketToRoom.delete(socketId);
  const room = code ? rooms.get(code) : undefined;
  if (!room || !room.players.has(socketId)) return { room: null, closedCode: null };

  room.players.delete(socketId);

  if (room.players.size === 0) {
    clearRoomTimer(room);
    rooms.delete(room.code);
    return { room: null, closedCode: room.code };
  }

  if (room.hostSocketId === socketId) {
    room.hostSocketId = room.players.keys().next().value as string;
  }

  const seat = room.seats.indexOf(socketId);
  const inGame = room.phase === "countdown" || room.phase === "peek" || room.phase === "playing";
  if (inGame && room.game && seat >= 0) {
    const wasTurn = room.game.turn === seat;
    room.game = removePlayer(room.game, seat);
    room.lastEvent = nextEvent(room, { kind: "left", by: socketId });
    if (activePlayers(room.game).length < 2) {
      finishGame(room, "players-left");
    } else if (wasTurn && room.phase === "playing" && !room.game.finished) {
      // miss pendente ou relogio da vez dele: tudo substituido por uma vez nova
      startTurn(room);
    }
  }

  return { room, closedCode: null };
}
