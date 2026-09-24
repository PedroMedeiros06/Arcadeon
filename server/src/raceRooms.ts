import { PlayerAvatar } from "./rooms";
import { RACE_QUESTIONS, RaceCategory, RaceDifficulty, RaceQuestion } from "./raceQuestions";
import { FINISH_PROGRESS, MAX_QUESTIONS, compareStandings, distanceFor, pointsFor } from "./raceScoring";

export interface RaceRoomConfig {
  questionSeconds: 10 | 15 | 20;
  visibility: "public" | "private";
  maxPlayers: number; // 2-16
}

export interface RaceAnswer {
  questionId: string;
  answerIndex: number;
  receivedAt: number;
  responseMs: number;
}

export interface RacePlayer {
  socketId: string;
  name: string;
  avatar: PlayerAvatar | null;
  /** conta Supabase verificada pelo servidor (null = convidado, nao entra no ranking) */
  userId: string | null;
  joinSeq: number;
  distance: number;
  points: number;
  correctCount: number;
  correctTimeMsTotal: number;
  answeredCount: number;
  answeredTimeMsTotal: number;
  streak: number;
  maxStreak: number;
  /** indice da pergunta em que o jogador esta congelado (nao anda). null = livre. */
  frozenQuestionIndex: number | null;
  answer: RaceAnswer | null;
}

export type RacePhase = "lobby" | "countdown" | "question" | "question-results" | "results";

export interface RevealEntry {
  socketId: string;
  answerIndex: number | null;
  correct: boolean;
  responseMs: number | null;
  distanceGained: number;
  pointsGained: number;
  /** estava congelado nesta rodada — nao andou mesmo acertando */
  wasFrozen: boolean;
  streakAfter: number;
  /** tinha sequencia e errou/nao respondeu */
  lostStreak: boolean;
  /** vai ficar congelado na proxima rodada */
  froze: boolean;
}

export interface QuestionReveal {
  questionId: string;
  correctIndex: number;
  entries: RevealEntry[];
}

export type GameEndReason = "finished" | "limit" | "players-left";

export interface RaceRoom {
  code: string;
  hostSocketId: string;
  config: RaceRoomConfig;
  players: Map<string, RacePlayer>;
  phase: RacePhase;
  nextJoinSeq: number;
  questions: RaceQuestion[];
  questionIndex: number;
  phaseStartsAt: number | null;
  phaseEndsAt: number | null;
  lastReveal: QuestionReveal | null;
  /** alguem cruzou a linha nesta rodada: o reveal atual e' o ultimo */
  finishing: boolean;
  winnerSocketId: string | null;
  endReason: GameEndReason | null;
  recentQuestionIds: string[];
  timer: NodeJS.Timeout | null;
  timerToken: number;
}

// RACE_FAST_TIMERS so encurta duracoes (simulador); regras e validacoes sao as mesmas
const FAST = process.env.RACE_FAST_TIMERS === "1";
// "3, 2, 1" (3s) + "VAI!" (0.8s)
export const COUNTDOWN_MS = FAST ? 1200 : 3800;
// pergunta chega antes do relogio comecar — todos recebem antes de poder responder
export const QUESTION_LEAD_MS = FAST ? 200 : 600;
// respostas ate endsAt + isso ainda contam (rede lenta)
export const LATE_GRACE_MS = 400;
export const QUESTION_RESULTS_MS = FAST ? 800 : 4500;
const RECENT_QUESTIONS_LIMIT = 80;

// primeiras 10 com a curva de aquecimento, depois ciclo equilibrado
const OPENING_DIFFICULTIES: RaceDifficulty[] = [1, 1, 2, 2, 1, 2, 3, 2, 3, 3];
const CYCLE_DIFFICULTIES: RaceDifficulty[] = [2, 3, 2, 1, 3, 2];

function difficultyFor(index: number): RaceDifficulty {
  if (index < OPENING_DIFFICULTIES.length) return OPENING_DIFFICULTIES[index];
  return CYCLE_DIFFICULTIES[(index - OPENING_DIFFICULTIES.length) % CYCLE_DIFFICULTIES.length];
}

const rooms = new Map<string, RaceRoom>();
const socketToRoom = new Map<string, string>();

type RoomListener = (room: RaceRoom) => void;
let onAutoAdvance: RoomListener = () => {};

/** raceSocket registra aqui o broadcast disparado quando um timer muda a fase sozinho. */
export function setRaceAutoAdvanceListener(listener: RoomListener): void {
  onAutoAdvance = listener;
}

let onGameFinished: RoomListener = () => {};

/** Disparado uma vez quando a partida entra em "results" (gravar estatisticas). */
export function setRaceGameFinishedListener(listener: RoomListener): void {
  onGameFinished = listener;
}

/** Associa a conta verificada ao jogador (se ele ja estiver numa sala). */
export function setRacePlayerUser(socketId: string, userId: string | null): void {
  const player = getRoomForSocket(socketId)?.players.get(socketId);
  if (player) player.userId = userId;
}

// ---------- sanitizacao de input ----------

export function sanitizeConfig(input: unknown): RaceRoomConfig {
  const c = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const questionSeconds = c.questionSeconds === 10 || c.questionSeconds === 20 ? c.questionSeconds : 15;
  const rawMax = typeof c.maxPlayers === "number" && Number.isFinite(c.maxPlayers) ? Math.round(c.maxPlayers) : 8;
  return {
    questionSeconds,
    visibility: c.visibility === "public" ? "public" : "private",
    maxPlayers: Math.min(16, Math.max(2, rawMax)),
  };
}

export function sanitizeName(input: unknown): string {
  if (typeof input !== "string") return "Jogador";
  return input.trim().slice(0, 10) || "Jogador";
}

export function sanitizeAvatar(input: unknown): PlayerAvatar | null {
  if (typeof input !== "object" || input === null) return null;
  const a = input as Record<string, unknown>;
  const emoji = typeof a.emoji === "string" && a.emoji.length <= 16 ? a.emoji : null;
  const bgColor = typeof a.bgColor === "string" && /^#[0-9a-f]{3,8}$/i.test(a.bgColor) ? a.bgColor : null;
  const imageUrl =
    typeof a.imageUrl === "string" && a.imageUrl.startsWith("/icons/") && !a.imageUrl.includes("..") && a.imageUrl.length <= 200
      ? a.imageUrl
      : null;
  if (!emoji && !bgColor && !imageUrl) return null;
  return { emoji, bgColor, imageUrl };
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

function newPlayer(
  socketId: string,
  name: string,
  avatar: PlayerAvatar | null,
  joinSeq: number,
  userId: string | null = null
): RacePlayer {
  return {
    socketId,
    name,
    avatar,
    userId,
    joinSeq,
    distance: 0,
    points: 0,
    correctCount: 0,
    correctTimeMsTotal: 0,
    answeredCount: 0,
    answeredTimeMsTotal: 0,
    streak: 0,
    maxStreak: 0,
    frozenQuestionIndex: null,
    answer: null,
  };
}

export function getRoomForSocket(socketId: string): RaceRoom | undefined {
  const code = socketToRoom.get(socketId);
  return code ? rooms.get(code) : undefined;
}

export function createRaceRoom(
  hostSocketId: string,
  config: RaceRoomConfig,
  name: string,
  avatar: PlayerAvatar | null
): RaceRoom {
  const room: RaceRoom = {
    code: generateCode(),
    hostSocketId,
    config,
    players: new Map(),
    phase: "lobby",
    nextJoinSeq: 1,
    questions: [],
    questionIndex: -1,
    phaseStartsAt: null,
    phaseEndsAt: null,
    lastReveal: null,
    finishing: false,
    winnerSocketId: null,
    endReason: null,
    recentQuestionIds: [],
    timer: null,
    timerToken: 0,
  };
  room.players.set(hostSocketId, newPlayer(hostSocketId, name, avatar, 0));
  rooms.set(room.code, room);
  socketToRoom.set(hostSocketId, room.code);
  return room;
}

export type JoinResult = { room: RaceRoom } | { error: string };

export function joinRaceRoom(code: string, socketId: string, name: string, avatar: PlayerAvatar | null): JoinResult {
  const room = rooms.get(code);
  if (!room) return { error: "Sala não encontrada." };
  if (room.phase !== "lobby") return { error: "A corrida já começou." };
  if (room.players.size >= room.config.maxPlayers) return { error: "Sala cheia." };
  room.players.set(socketId, newPlayer(socketId, name, avatar, room.nextJoinSeq++));
  socketToRoom.set(socketId, room.code);
  return { room };
}

export function renameRacePlayer(room: RaceRoom, socketId: string, name: string): boolean {
  const player = room.players.get(socketId);
  if (!player || room.phase !== "lobby") return false;
  player.name = name;
  return true;
}

export function updateRacePlayerAvatar(room: RaceRoom, socketId: string, avatar: PlayerAvatar | null): boolean {
  const player = room.players.get(socketId);
  if (!player || room.phase !== "lobby") return false;
  player.avatar = avatar;
  return true;
}

export function updateRaceConfig(room: RaceRoom, config: RaceRoomConfig): boolean {
  if (room.phase !== "lobby" || config.maxPlayers < room.players.size) return false;
  room.config = config;
  return true;
}

export function transferRaceHost(room: RaceRoom, newHostSocketId: string): boolean {
  if (room.phase !== "lobby" || !room.players.has(newHostSocketId)) return false;
  room.hostSocketId = newHostSocketId;
  return true;
}

// ---------- timers (um por sala, invalidados por token) ----------

function clearRoomTimer(room: RaceRoom): void {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.timerToken++;
}

function scheduleRoomTimer(room: RaceRoom, at: number, action: (room: RaceRoom) => void): void {
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

// ---------- selecao de perguntas ----------

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Embaralha as opcoes e remapeia o correctIndex — mesma ordem pra todos na partida. */
function withShuffledOptions(q: RaceQuestion): RaceQuestion {
  const order = shuffle([0, 1, 2, 3]);
  return {
    ...q,
    options: order.map((i) => q.options[i]) as RaceQuestion["options"],
    correctIndex: order.indexOf(q.correctIndex),
  };
}

/** Sorteia ate MAX_QUESTIONS (o failsafe). Normalmente a corrida acaba bem antes, na linha de chegada. */
function pickQuestions(room: RaceRoom): RaceQuestion[] {
  const recent = new Set(room.recentQuestionIds);
  const used = new Set<string>();
  const picked: RaceQuestion[] = [];

  for (let index = 0; index < MAX_QUESTIONS; index++) {
    const difficulty = difficultyFor(index);
    const prevCats = picked.slice(-2).map((q) => q.category);
    const blockedCat: RaceCategory | null = prevCats.length === 2 && prevCats[0] === prevCats[1] ? prevCats[0] : null;
    const fits = (q: RaceQuestion) => !used.has(q.id) && q.category !== blockedCat;

    // relaxa em ordem: recentes -> dificuldade vizinha -> qualquer uma nao usada
    const neighbours = difficulty === 2 ? [1, 3] : [2];
    const tiers: ((q: RaceQuestion) => boolean)[] = [
      (q) => fits(q) && q.difficulty === difficulty && !recent.has(q.id),
      (q) => fits(q) && q.difficulty === difficulty,
      (q) => fits(q) && neighbours.includes(q.difficulty) && !recent.has(q.id),
      (q) => fits(q),
      (q) => !used.has(q.id),
    ];

    let chosen: RaceQuestion | undefined;
    for (const tier of tiers) {
      const candidates = RACE_QUESTIONS.filter(tier);
      if (candidates.length > 0) {
        chosen = candidates[Math.floor(Math.random() * candidates.length)];
        break;
      }
    }
    if (!chosen) break; // banco menor que o failsafe — o limite vira o tamanho do banco
    used.add(chosen.id);
    picked.push(chosen);
  }

  room.recentQuestionIds = [...room.recentQuestionIds, ...picked.map((q) => q.id)].slice(-RECENT_QUESTIONS_LIMIT);
  return picked.map(withShuffledOptions);
}

// ---------- fases ----------

export function startRaceGame(room: RaceRoom): boolean {
  if (room.phase !== "lobby" || room.players.size < 2) return false;
  resetPlayers(room);
  room.questions = pickQuestions(room);
  room.questionIndex = -1;
  room.lastReveal = null;
  room.finishing = false;
  room.winnerSocketId = null;
  room.endReason = null;
  room.phase = "countdown";
  room.phaseStartsAt = Date.now();
  room.phaseEndsAt = room.phaseStartsAt + COUNTDOWN_MS;
  scheduleRoomTimer(room, room.phaseEndsAt, startNextQuestion);
  return true;
}

function startNextQuestion(room: RaceRoom): void {
  room.questionIndex++;
  if (room.questionIndex >= room.questions.length) {
    finishGame(room, "limit");
    return;
  }
  for (const player of room.players.values()) player.answer = null;
  room.lastReveal = null;
  room.phase = "question";
  room.phaseStartsAt = Date.now() + QUESTION_LEAD_MS;
  room.phaseEndsAt = room.phaseStartsAt + room.config.questionSeconds * 1000;
  scheduleRoomTimer(room, room.phaseEndsAt + LATE_GRACE_MS, endQuestion);
}

export function currentQuestion(room: RaceRoom): RaceQuestion | null {
  return room.questions[room.questionIndex] ?? null;
}

export type AnswerRejection = "not-in-game" | "stale" | "too-early" | "late" | "duplicate" | "invalid";

/** So le questionId e answerIndex — qualquer outro campo do cliente (streak, frozen, progress...) e' ignorado. */
export function submitRaceAnswer(
  room: RaceRoom,
  socketId: string,
  questionId: unknown,
  answerIndex: unknown
): { ok: true; answer: RaceAnswer } | { ok: false; reason: AnswerRejection } {
  const now = Date.now();
  const player = room.players.get(socketId);
  const question = currentQuestion(room);
  if (!player || room.phase !== "question" || !question) return { ok: false, reason: "not-in-game" };
  if (typeof questionId !== "string" || questionId !== question.id) return { ok: false, reason: "stale" };
  if (typeof answerIndex !== "number" || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    return { ok: false, reason: "invalid" };
  }
  if (player.answer) return { ok: false, reason: "duplicate" };
  if (now < room.phaseStartsAt!) return { ok: false, reason: "too-early" };
  if (now > room.phaseEndsAt! + LATE_GRACE_MS) return { ok: false, reason: "late" };

  const answer: RaceAnswer = {
    questionId,
    answerIndex,
    receivedAt: now,
    // resposta dentro da tolerancia de atraso conta como no limite
    responseMs: Math.min(now - room.phaseStartsAt!, room.config.questionSeconds * 1000),
  };
  player.answer = answer;
  return { ok: true, answer };
}

export function allPlayersAnswered(room: RaceRoom): boolean {
  for (const player of room.players.values()) if (!player.answer) return false;
  return true;
}

/** Congelado na pergunta atual (servidor e' a unica fonte). */
export function isFrozenNow(room: RaceRoom, player: RacePlayer): boolean {
  return player.frozenQuestionIndex !== null && player.frozenQuestionIndex === room.questionIndex;
}

/**
 * Idempotente: so age se ainda estiver em "question". Calcula tudo em lote, independente da ordem de chegada.
 * Regras por jogador:
 *  - congelado nesta rodada: nao anda, sequencia nao muda (acertar nao inicia sequencia), gelo sai no fim
 *  - acertou: sequencia +1, anda (velocidade + bonus de sequencia)
 *  - errou/nao respondeu com sequencia > 0: sequencia 0, congela na proxima rodada
 *  - errou/nao respondeu sem sequencia: nada acontece
 */
export function endQuestion(room: RaceRoom): void {
  const question = currentQuestion(room);
  if (room.phase !== "question" || !question) return;
  const questionMs = room.config.questionSeconds * 1000;
  const index = room.questionIndex;

  const entries: RevealEntry[] = [];
  for (const player of room.players.values()) {
    const answer = player.answer;
    const correct = !!answer && answer.answerIndex === question.correctIndex;
    const wasFrozen = isFrozenNow(room, player);
    let distanceGained = 0;
    let pointsGained = 0;
    let lostStreak = false;
    let froze = false;

    if (wasFrozen) {
      // rodada congelada: responde, ve a resposta, mas nao anda nem inicia sequencia
      if (correct) pointsGained = pointsFor(answer!.responseMs, questionMs, question.difficulty, 0);
      player.frozenQuestionIndex = null;
    } else if (correct) {
      player.streak++;
      player.maxStreak = Math.max(player.maxStreak, player.streak);
      distanceGained = distanceFor(answer!.responseMs, questionMs, player.streak);
      pointsGained = pointsFor(answer!.responseMs, questionMs, question.difficulty, player.streak);
    } else if (player.streak > 0) {
      // errar ou deixar o tempo acabar com sequencia: perde e congela (nao responder nao foge do risco)
      player.streak = 0;
      player.frozenQuestionIndex = index + 1;
      lostStreak = true;
      froze = true;
    }

    player.distance += distanceGained;
    player.points += pointsGained;
    if (answer) {
      player.answeredCount++;
      player.answeredTimeMsTotal += answer.responseMs;
    }
    if (correct) {
      player.correctCount++;
      player.correctTimeMsTotal += answer!.responseMs;
    }
    entries.push({
      socketId: player.socketId,
      answerIndex: answer ? answer.answerIndex : null,
      correct,
      responseMs: answer ? answer.responseMs : null,
      distanceGained,
      pointsGained,
      wasFrozen,
      streakAfter: player.streak,
      lostStreak,
      froze,
    });
  }

  room.lastReveal = { questionId: question.id, correctIndex: question.correctIndex, entries };
  room.phase = "question-results";
  room.phaseStartsAt = Date.now();
  room.phaseEndsAt = room.phaseStartsAt + QUESTION_RESULTS_MS;

  // o reveal roda normalmente (todos veem o carro cruzar) e so depois vem o resultado — nenhuma pergunta nova
  const someoneFinished = Array.from(room.players.values()).some((p) => p.distance >= FINISH_PROGRESS);
  if (someoneFinished) {
    room.finishing = true;
    scheduleRoomTimer(room, room.phaseEndsAt, (r) => finishGame(r, "finished"));
  } else if (index + 1 >= room.questions.length) {
    scheduleRoomTimer(room, room.phaseEndsAt, (r) => finishGame(r, "limit"));
  } else {
    scheduleRoomTimer(room, room.phaseEndsAt, startNextQuestion);
  }
}

/** Encerra a pergunta agora se ninguem mais precisa responder. Chamado apos resposta ou saida de jogador. */
export function endQuestionIfAllAnswered(room: RaceRoom): boolean {
  if (room.phase !== "question" || !allPlayersAnswered(room)) return false;
  endQuestion(room);
  return true;
}

function finishGame(room: RaceRoom, reason: GameEndReason): void {
  clearRoomTimer(room);
  room.phase = "results";
  room.endReason = reason;
  room.finishing = false;
  // vencedor = maior progresso real (se dois cruzarem juntos, quem foi mais longe) + desempate padrao
  room.winnerSocketId = rankedPlayers(room)[0]?.socketId ?? null;
  room.phaseStartsAt = Date.now();
  room.phaseEndsAt = null;
  onGameFinished(room);
}

function resetPlayers(room: RaceRoom): void {
  for (const [socketId, player] of room.players) {
    room.players.set(socketId, newPlayer(socketId, player.name, player.avatar, player.joinSeq, player.userId));
  }
}

export function restartRaceGame(room: RaceRoom): boolean {
  if (room.phase !== "results") return false;
  clearRoomTimer(room);
  room.phase = "lobby";
  room.questions = [];
  room.questionIndex = -1;
  room.phaseStartsAt = null;
  room.phaseEndsAt = null;
  room.lastReveal = null;
  room.finishing = false;
  room.winnerSocketId = null;
  room.endReason = null;
  resetPlayers(room);
  return true;
}

export function rankedPlayers(room: RaceRoom): RacePlayer[] {
  return Array.from(room.players.values()).sort(compareStandings);
}

/** Remove o jogador de tudo. Retorna a sala (se ainda existe) ou o codigo da sala fechada. */
export function leaveRaceRoom(socketId: string): { room: RaceRoom | null; closedCode: string | null } {
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

  const inGame = room.phase === "countdown" || room.phase === "question" || room.phase === "question-results";
  if (inGame && room.players.size < 2) {
    finishGame(room, "players-left");
  } else {
    endQuestionIfAllAnswered(room);
  }

  return { room, closedCode: null };
}
