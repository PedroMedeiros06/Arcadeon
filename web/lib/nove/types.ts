// Espelha server/src/noveRooms.ts + publicNoveRoomState (noveSocket.ts)
import type { Card, CardColor, FlipEvent } from "./engine";

export type TurnSeconds = 0 | 10 | 20;

export interface NoveRoomConfig {
  /** 0 = sem limite */
  turnSeconds: TurnSeconds;
}

export const DEFAULT_ROOM_CONFIG: NoveRoomConfig = { turnSeconds: 10 };

export interface PlayerAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export type NovePhase = "lobby" | "countdown" | "playing" | "results";

export type CardEventKind = Exclude<FlipEvent["kind"], "invalid">;

export type NoveEvent =
  | { seq: number; kind: CardEventKind; by: string; auto: boolean; required?: CardColor }
  | { seq: number; kind: "color"; by: string; color: CardColor; auto: boolean }
  | { seq: number; kind: "left"; by: string };

export interface NoveSeat {
  socketId: string;
  name: string;
  avatar: PlayerAvatar | null;
  cells: (CardColor | null)[];
  required: CardColor | null;
  left: boolean;
}

export interface NoveRoomState {
  code: string;
  hostSocketId: string;
  config: NoveRoomConfig;
  maxPlayers: number;
  phase: NovePhase;
  phaseEndsAt: number | null;
  lockedUntil: number;
  serverNow: number;
  endReason: "finished" | "players-left" | null;
  table: {
    drawCount: number;
    discardCount: number;
    lastCard: Card | null;
    pendingWild: boolean;
    flips: number;
  } | null;
  turnSocketId: string | null;
  winnerSocketId: string | null;
  lastEvent: NoveEvent | null;
  lobby: { socketId: string; name: string; avatar: PlayerAvatar | null }[];
  seats: NoveSeat[];
}
