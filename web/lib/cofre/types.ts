// Espelha server/src/cofreRooms.ts + publicCofreRoomState (cofreSocket.ts)
import type { BoardSize, CellState } from "./engine";

export type TurnSeconds = 0 | 8 | 12 | 20;

export interface CofreRoomConfig {
  size: BoardSize;
  maxPlayers: number;
  /** 0 = sem limite */
  turnSeconds: TurnSeconds;
  movingBoard: boolean;
  coringa: boolean;
  peek: boolean;
}

export const DEFAULT_ROOM_CONFIG: CofreRoomConfig = {
  size: "6x4",
  maxPlayers: 4,
  turnSeconds: 12,
  movingBoard: false,
  coringa: false,
  peek: false,
};

export interface PlayerAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export type CofrePhase = "lobby" | "countdown" | "peek" | "playing" | "results";

export type CofreEvent =
  | { seq: number; kind: "match"; by: string; a: number; b: number; points: 1 | 3 }
  | { seq: number; kind: "miss"; by: string; a: number; b: number }
  | { seq: number; kind: "timeout"; by: string }
  | { seq: number; kind: "left"; by: string };

export interface CofreSeat {
  socketId: string;
  name: string;
  avatar: PlayerAvatar | null;
  points: number;
  pairs: number;
  misses: number;
  left: boolean;
  /** 1 = primeiro; 0 = saiu */
  place: number;
}

export interface CofreRoomState {
  code: string;
  hostSocketId: string;
  config: CofreRoomConfig;
  phase: CofrePhase;
  phaseEndsAt: number | null;
  lockedUntil: number;
  serverNow: number;
  endReason: "finished" | "players-left" | null;
  board: {
    cols: number;
    rows: number;
    cells: { face: string | null; state: CellState }[];
    flipped: number[];
    moves: number;
  } | null;
  turnSocketId: string | null;
  swap: { a: number; b: number; seq: number } | null;
  lastEvent: CofreEvent | null;
  lobby: { socketId: string; name: string; avatar: PlayerAvatar | null }[];
  seats: CofreSeat[];
}

export type FlipRejection = "not-in-game" | "not-your-turn" | "locked" | "invalid";

/** Retorno de `award_match_coins`, mandado so pro socket do proprio jogador. */
export interface CoinsAwarded {
  awarded: number;
  capped: boolean;
  coins: number;
}
