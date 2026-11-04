// Espelha server/src/carteadoRooms.ts + publicCarteadoRoomState (carteadoSocket.ts)
import type { Card, CardColor, FlipEvent } from "./engine";

export type TurnSeconds = 0 | 10 | 20;

export interface CarteadoRoomConfig {
  /** 0 = sem limite */
  turnSeconds: TurnSeconds;
}

export const DEFAULT_ROOM_CONFIG: CarteadoRoomConfig = { turnSeconds: 10 };

export interface PlayerAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export type CarteadoPhase = "lobby" | "countdown" | "playing" | "results";

export type CardEventKind = Exclude<FlipEvent["kind"], "invalid">;

export type CarteadoEvent =
  | { seq: number; kind: CardEventKind; by: string; auto: boolean; required?: CardColor }
  | { seq: number; kind: "color"; by: string; color: CardColor; auto: boolean }
  | { seq: number; kind: "left"; by: string };

export interface CarteadoSeat {
  socketId: string;
  name: string;
  avatar: PlayerAvatar | null;
  cells: (CardColor | null)[];
  required: CardColor | null;
  left: boolean;
}

export interface CarteadoRoomState {
  code: string;
  hostSocketId: string;
  config: CarteadoRoomConfig;
  maxPlayers: number;
  phase: CarteadoPhase;
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
  lastEvent: CarteadoEvent | null;
  lobby: { socketId: string; name: string; avatar: PlayerAvatar | null }[];
  seats: CarteadoSeat[];
}
