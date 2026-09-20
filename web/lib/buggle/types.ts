export interface RoomConfig {
  boardSize: number;
  roundSeconds: number;
  minWordLength: number;
  visibility: "public" | "private";
  maxPlayers: number;
}

export interface BoggleCell {
  row: number;
  col: number;
  letter: string;
}

export type BoggleBoard = BoggleCell[][];

export interface PlayerAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export interface PlayerPublic {
  socketId: string;
  name: string;
  score: number;
  wordsFound: number;
  avatar: PlayerAvatar | null;
}

export type RoomPhase = "lobby" | "playing" | "results";

export interface RoomState {
  code: string;
  ownerSocketId: string;
  hostSocketId: string | null;
  config: RoomConfig;
  phase: RoomPhase;
  board: BoggleBoard | null;
  roundEndsAt: number | null;
  players: PlayerPublic[];
}

export interface WordResult {
  word: string;
  accepted: boolean;
  points: number;
  isSecret: boolean;
  alreadyFound: boolean;
}

export interface RoundEndedPayload {
  room: RoomState;
  allWords: { word: string; path: BoggleCell[] }[];
  secretWord: { word: string; path: BoggleCell[] } | null;
  foundBy: { socketId: string; name: string; foundWords: string[] }[];
}
