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

export type Difficulty = 1 | 2 | 3;

export interface WordEntry {
  word: string;
  category: string;
  difficulty: Difficulty;
  /** maximo por acerto com essa palavra (calculado no servidor) */
  maxPoints: number;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Facil", 2: "Media", 3: "Dificil" };

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
  round: number;
  currentDrawerSocketId: string | null;
  currentWord: string | null;
  currentWordLength: number | null;
  currentWordMask: string | null;
  currentDifficulty: Difficulty | null;
  wordOptions: WordEntry[] | null;
  turnEndsAt: number | null;
  players: DrawPlayerPublic[];
}

export interface GuessResult {
  correct: boolean;
  close: boolean;
  points: number;
  rank: number | null;
  alreadyGuessed: boolean;
  tooFast: boolean;
  guess: string;
}

export interface TurnEndedPayload {
  word: string | null;
  difficulty: Difficulty | null;
  drawerSocketId: string | null;
  reason: "timeout" | "all-guessed" | "drawer-left";
  players: { socketId: string; name: string; score: number; gained: number }[];
}

export interface FeedItem {
  id: string;
  /** own-* = acoes do proprio jogador; correct = outro acertou (sem revelar a palavra) */
  kind: "wrong" | "own-wrong" | "close" | "correct" | "own-correct" | "system";
  name?: string;
  text: string;
}

export interface GameEndedPayload {
  players: { socketId: string; name: string; score: number }[];
}

export interface TurnStartedPayload {
  drawerSocketId: string;
  wordLength: number;
  turnEndsAt: number;
}

/** Desenho de um turno guardado no client pra galeria do fim de jogo. */
export interface GalleryDrawing {
  id: string;
  imageUrl: string;
  word: string;
  drawerName: string;
  difficulty: Difficulty | null;
  game: number;
  round: number;
}
