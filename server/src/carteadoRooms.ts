import { PlayerAvatar } from "./rooms";
import { sanitizeAvatar, sanitizeName } from "./cofreRooms";
import { COLORS, CardColor, FlipEvent, GameState, chooseColor, createGame, flip, removePlayer } from "./carteadoEngine";

export { sanitizeAvatar, sanitizeName };

export type TurnSeconds = 0 | 10 | 20;

export interface CarteadoRoomConfig {
  /** 0 = sem limite; acabou o tempo, o servidor vira (ou escolhe a cor) pelo jogador */
  turnSeconds: TurnSeconds;
}

/** O jogo e' 1x1. */
export const MAX_PLAYERS = 2;

export interface CarteadoPlayer {
  socketId: string;
  name: string;
  avatar: PlayerAvatar | null;
  userId: string | null;
  joinSeq: number;
}

export type CarteadoPhase = "lobby" | "countdown" | "playing" | "results";

type CardEventKind = Exclude<FlipEvent["kind"], "invalid">;

export type CarteadoEvent =
  | { seq: number; kind: CardEventKind; by: string; auto: boolean; required?: CardColor }
  | { seq: number; kind: "color"; by: string; color: CardColor; auto: boolean }
  | { seq: number; kind: "left"; by: string };

export type GameEndReason = "finished" | "players-left";

export interface CarteadoRoom {
  code: string;
  hostSocketId: string;
  config: CarteadoRoomConfig;
  players: Map<string, CarteadoPlayer>;
  phase: CarteadoPhase;
  nextJoinSeq: number;
  game: GameState | null;
  /** socketId de cada indice de game.players (fixo durante a partida) */
  seats: string[];
  seatInfo: { name: string; avatar: PlayerAvatar | null }[];
  phaseEndsAt: number | null;
  /** ninguem vira carta antes disso (animacao da carta virando) */
  lockedUntil: number;
  lastEvent: CarteadoEvent | null;
  eventSeq: number;
  endReason: GameEndReason | null;
  timer: NodeJS.Timeout | null;
  timerToken: number;
}

// CARTEADO_FAST_TIMERS so encurta duracoes (simulador); regras e validacoes sao as mesmas
const FAST = process.env.CARTEADO_FAST_TIMERS === "1";
export const COUNTDOWN_MS = FAST ? 300 : 3800;
/** carta virando + tempo pra ler o que saiu */
export const FLIP_LOCK_MS = FAST ? 60 : 1100;
export const FINISH_DELAY_MS = FAST ? 100 : 1600;
const FAST_TURN_MS = 400;
const TURN_SECONDS: TurnSeconds[] = [0, 10, 20];

const rooms = new Map<string, CarteadoRoom>();
const socketToRoom = new Map<string, string>();

let onAutoAdvance: (room: CarteadoRoom) => void = () => {};

/** carteadoSocket registra aqui o broadcast disparado quando um timer muda o estado sozinho. */
export function setCarteadoAutoAdvanceListener(listener: (room: CarteadoRoom) => void): void {
  onAutoAdvance = listener;
}

export function setCarteadoPlayerUser(socketId: string, userId: string | null): void {
  const player = getRoomForSocket(socketId)?.players.get(socketId);
  if (player) player.userId = userId;
}

export function sanitizeConfig(input: unknown): CarteadoRoomConfig {
  const c = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  return { turnSeconds: TURN_SECONDS.includes(c.turnSeconds as TurnSeconds) ? (c.turnSeconds as TurnSeconds) : 10 };
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

export function hasCarteadoRoom(code: string): boolean {
  return rooms.has(code);
}

export function getRoomForSocket(socketId: string): CarteadoRoom | undefined {
  const code = socketToRoom.get(socketId);
  return code ? rooms.get(code) : undefined;
}

export function createCarteadoRoom(hostSocketId: string, config: CarteadoRoomConfig, name: string, avatar: PlayerAvatar | null): CarteadoRoom {
  const room: CarteadoRoom = {
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
    lastEvent: null,
    eventSeq: 0,
    endReason: null,
    timer: null,
    timerToken: 0,
  };
  room.players.set(hostSocketId, { socketId: hostSocketId, name, avatar, userId: null, joinSeq: 0 });
  rooms.set(room.code, room);
  socketToRoom.set(hostSocketId, room.code);
  return room;
}

export type JoinResult = { room: CarteadoRoom } | { error: string };

export function joinCarteadoRoom(code: string, socketId: string, name: string, avatar: PlayerAvatar | null): JoinResult {
  const room = rooms.get(code);
  if (!room) return { error: "Sala não encontrada." };
  if (room.phase !== "lobby") return { error: "A partida já começou." };
  if (room.players.size >= MAX_PLAYERS) return { error: "Sala cheia." };
  room.players.set(socketId, { socketId, name, avatar, userId: null, joinSeq: room.nextJoinSeq++ });
  socketToRoom.set(socketId, room.code);
  return { room };
}

export function renameCarteadoPlayer(room: CarteadoRoom, socketId: string, name: string): boolean {
  const player = room.players.get(socketId);
  if (!player || room.phase !== "lobby") return false;
  player.name = name;
  return true;
}

export function updateCarteadoPlayerAvatar(room: CarteadoRoom, socketId: string, avatar: PlayerAvatar | null): boolean {
  const player = room.players.get(socketId);
  if (!player || room.phase !== "lobby") return false;
  player.avatar = avatar;
  return true;
}

export function updateCarteadoConfig(room: CarteadoRoom, config: CarteadoRoomConfig): boolean {
  if (room.phase !== "lobby") return false;
  room.config = config;
  return true;
}

// ---------- timers (um por sala, invalidados por token) ----------

function clearRoomTimer(room: CarteadoRoom): void {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.timerToken++;
}

function scheduleRoomTimer(room: CarteadoRoom, at: number, action: (room: CarteadoRoom) => void): void {
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

type NewEvent = CarteadoEvent extends infer E ? (E extends CarteadoEvent ? Omit<E, "seq"> : never) : never;

function pushEvent(room: CarteadoRoom, event: NewEvent): void {
  room.eventSeq++;
  room.lastEvent = { ...event, seq: room.eventSeq } as CarteadoEvent;
}

// ---------- fases ----------

export function startCarteadoGame(room: CarteadoRoom): boolean {
  if (room.phase !== "lobby" || room.players.size < 2) return false;
  const players = Array.from(room.players.values()).sort((a, b) => a.joinSeq - b.joinSeq);
  room.seats = players.map((p) => p.socketId);
  room.seatInfo = players.map((p) => ({ name: p.name, avatar: p.avatar }));
  // quem comeca e sorteado
  room.game = { ...createGame(players.length, Math.random), turn: Math.floor(Math.random() * players.length) };
  room.lastEvent = null;
  room.endReason = null;
  room.lockedUntil = 0;
  room.phase = "countdown";
  room.phaseEndsAt = Date.now() + COUNTDOWN_MS;
  scheduleRoomTimer(room, room.phaseEndsAt, startTurn);
  return true;
}

function turnMs(room: CarteadoRoom): number {
  if (room.config.turnSeconds === 0) return 0;
  return FAST ? FAST_TURN_MS : room.config.turnSeconds * 1000;
}

/** Comeca (ou renova) o relogio da vez atual, a partir do fim da trava de animacao. */
function startTurn(room: CarteadoRoom): void {
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

/** Tempo acabou: o servidor joga pelo jogador (sorte pura, entao nao ha penalidade). */
function timeoutTurn(room: CarteadoRoom): void {
  if (room.phase !== "playing" || !room.game) return;
  const by = room.seats[room.game.turn];
  if (room.game.pendingWild) applyColor(room, by, COLORS[Math.floor(Math.random() * COLORS.length)], true);
  else applyFlip(room, by, true);
}

function applyFlip(room: CarteadoRoom, socketId: string, auto: boolean): void {
  const game = room.game!;
  const { state, event } = flip(game, Math.random);
  if (event.kind === "invalid") return;
  room.game = state;
  pushEvent(room, { kind: event.kind, by: socketId, auto, ...(event.kind === "wrong-color" ? { required: event.required } : {}) });
  room.lockedUntil = Date.now() + FLIP_LOCK_MS;
  if (state.finished) {
    clearRoomTimer(room);
    room.phaseEndsAt = null;
    scheduleRoomTimer(room, Date.now() + FINISH_DELAY_MS, (r) => finishGame(r, "finished"));
  } else {
    startTurn(room);
  }
}

function applyColor(room: CarteadoRoom, socketId: string, color: CardColor, auto: boolean): void {
  room.game = chooseColor(room.game!, color);
  pushEvent(room, { kind: "color", by: socketId, color, auto });
  startTurn(room);
}

export type ActionRejection = "not-in-game" | "not-your-turn" | "locked" | "invalid";
type ActionResult = { ok: true } | { ok: false; reason: ActionRejection };

function canAct(room: CarteadoRoom, socketId: string): ActionResult {
  const game = room.game;
  if (room.phase !== "playing" || !game || game.finished) return { ok: false, reason: "not-in-game" };
  if (room.seats[game.turn] !== socketId) return { ok: false, reason: "not-your-turn" };
  if (Date.now() < room.lockedUntil) return { ok: false, reason: "locked" };
  return { ok: true };
}

export function flipCarteadoCard(room: CarteadoRoom, socketId: string): ActionResult {
  const check = canAct(room, socketId);
  if (!check.ok) return check;
  if (room.game!.pendingWild) return { ok: false, reason: "invalid" };
  applyFlip(room, socketId, false);
  return { ok: true };
}

export function chooseCarteadoColor(room: CarteadoRoom, socketId: string, color: unknown): ActionResult {
  const check = canAct(room, socketId);
  if (!check.ok) return check;
  if (!room.game!.pendingWild || !COLORS.includes(color as CardColor)) return { ok: false, reason: "invalid" };
  applyColor(room, socketId, color as CardColor, false);
  return { ok: true };
}

function finishGame(room: CarteadoRoom, reason: GameEndReason): void {
  clearRoomTimer(room);
  room.phase = "results";
  room.endReason = reason;
  room.phaseEndsAt = null;
}

export function restartCarteadoGame(room: CarteadoRoom): boolean {
  if (room.phase !== "results") return false;
  clearRoomTimer(room);
  room.phase = "lobby";
  room.game = null;
  room.seats = [];
  room.seatInfo = [];
  room.lastEvent = null;
  room.endReason = null;
  room.phaseEndsAt = null;
  room.lockedUntil = 0;
  return true;
}

/** Remove o jogador de tudo. Retorna a sala (se ainda existe) ou o codigo da sala fechada. */
export function leaveCarteadoRoom(socketId: string): { room: CarteadoRoom | null; closedCode: string | null } {
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
  const inGame = room.phase === "countdown" || room.phase === "playing";
  if (inGame && room.game && seat >= 0) {
    room.game = removePlayer(room.game, seat);
    pushEvent(room, { kind: "left", by: socketId });
    // 1x1: quem fica vence
    if (room.game.finished) finishGame(room, "players-left");
  }

  return { room, closedCode: null };
}
