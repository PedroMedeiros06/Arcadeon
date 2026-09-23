import type { Sfx } from "./sound";
import type { RaceRoomState } from "./types";

export interface RaceFx {
  /** sons a tocar, com atraso em ms (sincroniza com a animacao do carro) */
  sounds: { name: Sfx; delay: number; level?: number }[];
  /** quem ultrapassou alguem de verdade nesta atualizacao */
  overtakers: string[];
}

/**
 * Ultrapassagem real: A estava atras de B (distancia menor) e agora esta a frente (distancia maior).
 * Usa a distancia do servidor, nao o rank — empate ou mudanca so de desempate nao conta como ultrapassagem.
 */
export function findOvertakers(prev: RaceRoomState, next: RaceRoomState): string[] {
  const before = new Map(prev.players.map((p) => [p.socketId, p.distance]));
  const result: string[] = [];
  for (const a of next.players) {
    const aBefore = before.get(a.socketId);
    if (aBefore === undefined) continue;
    const passed = next.players.some((b) => {
      if (b.socketId === a.socketId) return false;
      const bBefore = before.get(b.socketId);
      return bBefore !== undefined && aBefore < bBefore && a.distance > b.distance;
    });
    if (passed) result.push(a.socketId);
  }
  return result;
}

/**
 * Compara o snapshot anterior com o novo e decide sons/animacoes pontuais.
 * Prioriza o que e' do proprio jogador + eventos grandes da corrida, pra partida nao ficar barulhenta.
 * (Ticks do countdown e o aviso de tempo sao por relogio, tratados no RaceGame.)
 */
export function diffRaceSnapshots(prev: RaceRoomState | null, next: RaceRoomState, me: string): RaceFx {
  const fx: RaceFx = { sounds: [], overtakers: [] };
  if (!prev || prev.code !== next.code) return fx;

  if (next.phase === "lobby" && prev.phase === "lobby" && next.players.length > prev.players.length) {
    fx.sounds.push({ name: "join", delay: 0 });
  }
  if (next.phase === "countdown" && prev.phase !== "countdown") {
    fx.sounds.push({ name: "start", delay: 0 });
  }
  if (next.phase === "question" && next.question && next.question.id !== prev.question?.id) {
    fx.sounds.push({ name: "question", delay: 0 });
  }

  if (next.phase === "question-results" && prev.phase === "question" && next.reveal) {
    fx.overtakers = findOvertakers(prev, next);
    const mine = next.reveal.entries.find((e) => e.socketId === me);
    if (mine) {
      if (mine.wasFrozen) {
        fx.sounds.push({ name: "unfreeze", delay: 300 });
      } else if (mine.correct) {
        fx.sounds.push({ name: "correct", delay: 0 });
        if (mine.streakAfter >= 2) fx.sounds.push({ name: "streakUp", delay: 220, level: mine.streakAfter });
      } else if (mine.lostStreak) {
        fx.sounds.push({ name: "streakLost", delay: 0 });
        fx.sounds.push({ name: "freeze", delay: 350 });
      } else {
        fx.sounds.push({ name: "wrong", delay: 0 });
      }
    }
    if (fx.overtakers.includes(me)) fx.sounds.push({ name: "overtake", delay: 500 });
    if (next.finishing) fx.sounds.push({ name: "finish", delay: 800 });
  }

  if (next.phase === "results" && prev.phase !== "results") {
    fx.sounds.push({ name: next.winnerSocketId === me ? "win" : "lose", delay: 200 });
  }
  return fx;
}
