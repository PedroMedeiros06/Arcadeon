export interface DrawRoomConfig {
  roundsPerPlayer: number;
  turnSeconds: number;
  visibility: "public" | "private";
  maxPlayers: number;
}

export interface PlayerAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export interface DrawPlayerPublic {
  socketId: string;
  name: string;
  score: number;
  avatar: PlayerAvatar | null;
  hasGuessedThisTurn: boolean;
}

export type DrawRoomPhase = "lobby" | "picking-word" | "drawing" | "turn-results" | "results";

export interface WordEntry {
  word: string;
  category: string;
  difficulty: 1 | 2 | 3;
}

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

export interface DrawRoomState {
  code: string;
  hostSocketId: string;
  config: DrawRoomConfig;
  phase: DrawRoomPhase;
  turnOrder: string[];
  currentDrawerSocketId: string | null;
  currentWord: string | null;
  currentWordLength: number | null;
  wordOptions: WordEntry[] | null;
  turnEndsAt: number | null;
  players: DrawPlayerPublic[];
}

export interface GuessResult {
  correct: boolean;
  points: number;
  rank: number | null;
  alreadyGuessed: boolean;
  tooFast: boolean;
}

export interface TurnEndedPayload {
  word: string | null;
  drawerSocketId: string | null;
  reason: "timeout" | "all-guessed" | "drawer-left";
  players: { socketId: string; name: string; score: number }[];
}

export interface GameEndedPayload {
  players: { socketId: string; name: string; score: number }[];
}

export interface TurnStartedPayload {
  drawerSocketId: string;
  wordLength: number;
  turnEndsAt: number;
}
