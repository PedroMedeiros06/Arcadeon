import type { RaceDifficulty } from "./raceQuestions";

// Respostas dentro dessa janela inicial ganham velocidade maxima — apaga a vantagem de ping
// na faixa mais rapida (ninguem le e responde em menos de 1s de verdade).
export const SPEED_GRACE_MS = 1000;

// A corrida termina quando alguem chega aqui. Acertando tudo rapido: ~10 perguntas;
// jogador tipico (~70% de acerto, velocidade media): ~16-18 perguntas.
export const FINISH_PROGRESS = 1000;
// Failsafe: so encerra por aqui se ninguem cruzar a linha (todos errando muito).
export const MAX_QUESTIONS = 30;

export const DISTANCE_BASE = 60;
export const DISTANCE_SPEED = 30;
export const STREAK_BONUS_STEP = 5;
export const STREAK_BONUS_MAX_STEPS = 4;
export const POINTS_BASE = 100;

const DIFFICULTY_MULTIPLIER: Record<RaceDifficulty, number> = { 1: 1, 2: 1.2, 3: 1.5 };

/** 0..1 — 1 = resposta dentro da janela de graca, 0 = no ultimo instante. */
export function speedFactor(responseMs: number, questionMs: number): number {
  const window = questionMs - SPEED_GRACE_MS;
  if (window <= 0) return 1;
  const late = Math.max(0, responseMs - SPEED_GRACE_MS);
  return Math.min(1, Math.max(0, 1 - late / window));
}

/**
 * Bonus pela sequencia JA contando o acerto atual: 🔥1 +0, 🔥2 +5, 🔥3 +10, 🔥4 +15, 🔥5+ +20.
 * Teto baixo de proposito: recompensa manter a sequencia sem desequilibrar a corrida.
 */
export function streakBonus(streakAfter: number): number {
  return STREAK_BONUS_STEP * Math.min(Math.max(0, streakAfter - 1), STREAK_BONUS_MAX_STEPS);
}

/** Avanco na pista de um acerto sem congelamento: 60..110. Nao depende da dificuldade. */
export function distanceFor(responseMs: number, questionMs: number, streakAfter: number): number {
  return DISTANCE_BASE + Math.round(DISTANCE_SPEED * speedFactor(responseMs, questionMs)) + streakBonus(streakAfter);
}

/** Pontos so servem de desempate/estatistica. */
export function pointsFor(responseMs: number, questionMs: number, difficulty: RaceDifficulty, streakAfter: number): number {
  const s = speedFactor(responseMs, questionMs);
  return Math.round(POINTS_BASE * DIFFICULTY_MULTIPLIER[difficulty] * (0.5 + 0.5 * s)) + streakBonus(streakAfter);
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
