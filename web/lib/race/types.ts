// Espelha server/src/raceRooms.ts + publicRaceRoomState (raceSocket.ts)

export interface RaceRoomConfig {
  questionCount: 5 | 10 | 15;
  questionSeconds: 10 | 15 | 20;
  visibility: "public" | "private";
  maxPlayers: number;
}

export interface PlayerAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export type RacePhase = "lobby" | "countdown" | "question" | "question-results" | "results";

export interface RacePlayerPublic {
  socketId: string;
  name: string;
  avatar: PlayerAvatar | null;
  distance: number;
  points: number;
  correctCount: number;
  answeredCount: number;
  avgResponseMs: number | null;
  answered: boolean;
  rank: number;
}

export interface RaceQuestionPublic {
  id: string;
  text: string;
  options: string[];
  category: string;
  difficulty: 1 | 2 | 3;
}

export interface RevealEntry {
  socketId: string;
  answerIndex: number | null;
  correct: boolean;
  responseMs: number | null;
  distanceGained: number;
  pointsGained: number;
}

export interface QuestionReveal {
  questionId: string;
  correctIndex: number;
  entries: RevealEntry[];
}

export interface RaceRoomState {
  code: string;
  hostSocketId: string;
  config: RaceRoomConfig;
  phase: RacePhase;
  questionIndex: number;
  totalQuestions: number;
  phaseStartsAt: number | null;
  phaseEndsAt: number | null;
  serverNow: number;
  finishLine: number;
  endReason: "completed" | "players-left" | null;
  question: RaceQuestionPublic | null;
  reveal: QuestionReveal | null;
  players: RacePlayerPublic[];
}

export type AnswerRejection = "not-in-game" | "stale" | "too-early" | "late" | "duplicate" | "invalid";
