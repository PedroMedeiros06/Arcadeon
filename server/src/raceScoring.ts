import type { RaceDifficulty } from "./raceQuestions";

// Respostas dentro dessa janela inicial ganham velocidade maxima — apaga a vantagem de ping
// na faixa mais rapida (ninguem le e responde em menos de 1s de verdade).
export const SPEED_GRACE_MS = 1000;
export const DISTANCE_BASE = 70;
export const DISTANCE_SPEED = 30;
export const POINTS_BASE = 100;
export const FINISH_LINE_PER_QUESTION = 80;

const DIFFICULTY_MULTIPLIER: Record<RaceDifficulty, number> = { 1: 1, 2: 1.2, 3: 1.5 };

/** 0..1 — 1 = resposta dentro da janela de graca, 0 = no ultimo instante. */
export function speedFactor(responseMs: number, questionMs: number): number {
  const window = questionMs - SPEED_GRACE_MS;
  if (window <= 0) return 1;
  const late = Math.max(0, responseMs - SPEED_GRACE_MS);
  return Math.min(1, Math.max(0, 1 - late / window));
}

/** Distancia nao depende da dificuldade: todos recebem a mesma pergunta, cada uma pesa igual na corrida. */
export function distanceFor(correct: boolean, responseMs: number, questionMs: number): number {
  if (!correct) return 0;
  return DISTANCE_BASE + Math.round(DISTANCE_SPEED * speedFactor(responseMs, questionMs));
}

export function pointsFor(correct: boolean, responseMs: number, questionMs: number, difficulty: RaceDifficulty): number {
  if (!correct) return 0;
  const s = speedFactor(responseMs, questionMs);
  return Math.round(POINTS_BASE * DIFFICULTY_MULTIPLIER[difficulty] * (0.5 + 0.5 * s));
}

export interface StandingStats {
  distance: number;
  points: number;
  correctCount: number;
  correctTimeMsTotal: number;
  joinSeq: number;
}

/** Desempate deterministico: distancia > pontos > acertos > menor tempo somado > ordem de entrada. */
export function compareStandings(a: StandingStats, b: StandingStats): number {
  return (
    b.distance - a.distance ||
    b.points - a.points ||
    b.correctCount - a.correctCount ||
    a.correctTimeMsTotal - b.correctTimeMsTotal ||
    a.joinSeq - b.joinSeq
  );
}
