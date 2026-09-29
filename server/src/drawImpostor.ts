// Artista Impostor: todos desenham no mesmo canvas, um traco por vez. Todo mundo sabe a palavra,
// menos o impostor (que so ve o tema). Depois de 2 voltas a sala vota; se o impostor for pego, ainda
// pode virar o jogo acertando a palavra.
import { randomInt } from "crypto";
import { normalizeWord, pickWordOptions } from "./drawWords";
import {
  DrawRoom,
  ImpostorRound,
  clearPhaseTimer,
  finishGame,
  isConnected,
  resetTurnState,
  shuffle,
} from "./drawRooms";

export const STROKE_SECONDS = 15;
export const LAPS = 2;
export const VOTE_SECONDS = 30;
export const IMPOSTOR_GUESS_SECONDS = 20;

// pontuacao
const IMPOSTOR_ESCAPED = 250;
const IMPOSTOR_CAUGHT_BUT_GUESSED = 150;
const ARTIST_WIN = 100;
const RIGHT_VOTE_BONUS = 50;

/** Cores bem distintas: da pra saber quem fez cada traco na hora de votar. */
const PLAYER_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#f97316",
  "#1c1a2e", "#84cc16", "#6366f1", "#78350f", "#0ea5e9", "#e11d48", "#65a30d", "#9333ea",
];

/**
 * Comeca a proxima rodada. Retorna false se as rodadas acabaram (ou sobrou gente de menos) e a
 * partida foi pro placar final.
 */
export function startImpostorRound(room: DrawRoom): boolean {
  const connected = Array.from(room.players.values()).filter(isConnected);
  if (room.impostorRoundNumber >= room.config.roundsPerPlayer || connected.length < 3) {
    finishGame(room);
    return false;
  }

  resetTurnState(room);
  room.impostorRoundNumber++;

  // palavra facil ou media: o impostor precisa ter chance de blefar a partir do tema
  const options = pickWordOptions(room.usedWords, room.recentCategories);
  for (const option of options) room.usedWords.add(option.word);
  const entry = options[randomInt(2)];
  room.recentCategories = [entry.category, ...room.recentCategories].slice(0, 3);

  // evita o mesmo impostor duas vezes seguidas quando da
  const candidates = connected.filter((p) => p.id !== room.lastImpostorId);
  const impostor = (candidates.length > 0 ? candidates : connected)[randomInt(candidates.length || connected.length)];
  room.lastImpostorId = impostor.id;

  const lap = shuffle(connected.map((p) => p.id));
  const colors = new Map<string, string>();
  lap.forEach((id, i) => colors.set(id, PLAYER_COLORS[i % PLAYER_COLORS.length]));

  const round: ImpostorRound = {
    impostorId: impostor.id,
    word: entry.word,
    category: entry.category,
    strokeOrder: Array.from({ length: LAPS }, () => lap).flat(),
    strokeIndex: 0,
    currentStrokeId: null,
    colors,
    votes: new Map(),
    caught: null,
    impostorGuess: null,
    impostorGuessedRight: null,
    gained: new Map(),
    aborted: false,
  };
  room.impostor = round;
  room.phase = "impostor-drawing";
  room.phaseEndsAt = Date.now() + STROKE_SECONDS * 1000;
  skipDisconnectedStrokers(room);
  return true;
}

export function currentStroker(room: DrawRoom): string | null {
  const round = room.impostor;
  if (room.phase !== "impostor-drawing" || !round) return null;
  return round.strokeOrder[round.strokeIndex] ?? null;
}

/** Quem esta fora da sala ou desconectado perde a vez do traco. */
function skipDisconnectedStrokers(room: DrawRoom): void {
  const round = room.impostor!;
  while (round.strokeIndex < round.strokeOrder.length) {
    const player = room.players.get(round.strokeOrder[round.strokeIndex]);
    if (player && isConnected(player)) return;
    round.strokeIndex++;
  }
}

/**
 * Passa a vez pro proximo traco (terminou o traco ou estourou o tempo). Retorna true quando
 * acabaram as voltas e a sala foi pra votacao.
 */
export function advanceStroke(room: DrawRoom): boolean {
  const round = room.impostor;
  if (room.phase !== "impostor-drawing" || !round) return false;
  round.strokeIndex++;
  round.currentStrokeId = null;
  skipDisconnectedStrokers(room);
  if (round.strokeIndex >= round.strokeOrder.length) {
    room.phase = "impostor-voting";
    room.phaseEndsAt = Date.now() + VOTE_SECONDS * 1000;
    return true;
  }
  room.phaseEndsAt = Date.now() + STROKE_SECONDS * 1000;
  return false;
}

/** O jogador da vez avisou que soltou o dedo: so vale se ele ja fez algum traco. */
export function finishStroke(room: DrawRoom, playerId: string): boolean {
  const round = room.impostor;
  return currentStroker(room) === playerId && !!round?.currentStrokeId;
}

export function castVote(room: DrawRoom, voterId: string, targetId: unknown): boolean {
  const round = room.impostor;
  if (room.phase !== "impostor-voting" || !round) return false;
  if (typeof targetId !== "string" || targetId === voterId || !room.players.has(targetId)) return false;
  round.votes.set(voterId, targetId);
  return true;
}

export function allVoted(room: DrawRoom): boolean {
  const round = room.impostor;
  if (!round) return false;
  const voters = Array.from(room.players.values()).filter(isConnected);
  return voters.length > 0 && voters.every((p) => round.votes.has(p.id));
}

/** Fecha a votacao. Retorna "guess" se o impostor foi pego (ele ainda chuta), senao "reveal". */
export function closeVoting(room: DrawRoom): "guess" | "reveal" {
  const round = room.impostor!;
  const tally = new Map<string, number>();
  for (const target of round.votes.values()) tally.set(target, (tally.get(target) ?? 0) + 1);
  let top = 0;
  let topIds: string[] = [];
  for (const [id, n] of tally) {
    if (n > top) {
      top = n;
      topIds = [id];
    } else if (n === top) {
      topIds.push(id);
    }
  }
  // empate ou ninguem votou = impostor escapa
  round.caught = topIds.length === 1 && topIds[0] === round.impostorId;
  const impostor = room.players.get(round.impostorId);
  if (round.caught && impostor && isConnected(impostor)) {
    room.phase = "impostor-guess";
    room.phaseEndsAt = Date.now() + IMPOSTOR_GUESS_SECONDS * 1000;
    return "guess";
  }
  if (round.caught) round.impostorGuessedRight = false;
  revealRound(room);
  return "reveal";
}

/** Impostor pego tenta acertar a palavra. Retorna true se o chute foi aceito (1 tentativa). */
export function submitImpostorGuess(room: DrawRoom, playerId: string, guess: string): boolean {
  const round = room.impostor;
  if (room.phase !== "impostor-guess" || !round || round.impostorId !== playerId) return false;
  round.impostorGuess = guess;
  round.impostorGuessedRight = normalizeWord(guess) === normalizeWord(round.word);
  revealRound(room);
  return true;
}

/** Tempo do chute acabou sem resposta. */
export function impostorGuessTimeout(room: DrawRoom): void {
  const round = room.impostor;
  if (room.phase !== "impostor-guess" || !round) return;
  round.impostorGuessedRight = false;
  revealRound(room);
}

/** Impostor saiu da sala no meio da rodada: revela sem pontos. */
export function abortImpostorRound(room: DrawRoom): void {
  const round = room.impostor;
  if (!round) return;
  round.aborted = true;
  round.caught = null;
  revealRound(room, false);
}

function revealRound(room: DrawRoom, award = true): void {
  const round = room.impostor!;
  clearPhaseTimer(room);
  if (award) {
    const give = (id: string, points: number) => {
      const player = room.players.get(id);
      if (!player || points <= 0) return;
      player.score += points;
      round.gained.set(id, (round.gained.get(id) ?? 0) + points);
    };
    if (!round.caught) {
      give(round.impostorId, IMPOSTOR_ESCAPED);
    } else if (round.impostorGuessedRight) {
      give(round.impostorId, IMPOSTOR_CAUGHT_BUT_GUESSED);
    } else {
      for (const id of room.players.keys()) {
        if (id === round.impostorId) continue;
        give(id, ARTIST_WIN + (round.votes.get(id) === round.impostorId ? RIGHT_VOTE_BONUS : 0));
      }
    }
  }
  room.phase = "impostor-reveal";
  room.phaseEndsAt = null;
}

/** Chat da rodada: artistas nao podem digitar a palavra (entregaria pro impostor). */
export function chatAllowed(room: DrawRoom, playerId: string, text: string): boolean {
  const round = room.impostor;
  if (!round) return false;
  if (playerId === round.impostorId) return true;
  return !normalizeWord(text).includes(normalizeWord(round.word));
}

/** O que cada jogador ve da rodada (a palavra nunca vai pro impostor antes do fim). */
export function publicImpostorState(room: DrawRoom, forPlayerId: string) {
  const round = room.impostor;
  if (!round) return null;
  const revealed = room.phase === "impostor-reveal";
  const amImpostor = round.impostorId === forPlayerId;
  return {
    category: round.category,
    word: revealed || !amImpostor ? round.word : null,
    amImpostor,
    impostorId: revealed ? round.impostorId : null,
    strokerId: currentStroker(room),
    strokeIndex: round.strokeIndex,
    totalStrokes: round.strokeOrder.length,
    strokeOrder: round.strokeOrder.slice(0, round.strokeOrder.length / LAPS),
    colors: Object.fromEntries(round.colors),
    votedIds: Array.from(round.votes.keys()),
    myVote: round.votes.get(forPlayerId) ?? null,
    // votos so aparecem na revelacao
    votes: revealed ? Array.from(round.votes, ([voter, target]) => ({ voter, target })) : null,
    caught: revealed ? round.caught : null,
    impostorGuess: revealed ? round.impostorGuess : null,
    impostorGuessedRight: revealed ? round.impostorGuessedRight : null,
    gained: revealed ? Object.fromEntries(round.gained) : null,
    aborted: round.aborted,
  };
}
