import { BoggleBoard, BoggleCell, generateBoard, findAllWords, pickSecretWord, scoreForWord } from "./boggle";
import { DICTIONARY } from "./dictionary";

export interface RoomConfig {
  boardSize: number; // 4-10
  roundSeconds: number;
  minWordLength: number; // 3-5
  visibility: "public" | "private";
  maxPlayers: number; // 2-24
}

export interface Player {
  socketId: string;
  name: string;
  score: number;
  foundWords: Set<string>;
  isSpectator: boolean;
}

export type RoomPhase = "lobby" | "playing" | "results";

export interface Room {
  code: string;
  hostSocketId: string;
  config: RoomConfig;
  players: Map<string, Player>;
  phase: RoomPhase;
  board: BoggleBoard | null;
  secretWord: { word: string; path: BoggleCell[] } | null;
  allWordsOnBoard: { word: string; path: BoggleCell[] }[];
  roundEndsAt: number | null;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostSocketId: string, hostName: string, config: RoomConfig): Room {
  const code = generateCode();
  const room: Room = {
    code,
    hostSocketId,
    config,
    players: new Map([
      [hostSocketId, { socketId: hostSocketId, name: hostName, score: 0, foundWords: new Set(), isSpectator: false }],
    ]),
    phase: "lobby",
    board: null,
    secretWord: null,
    allWordsOnBoard: [],
    roundEndsAt: null,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function joinRoom(code: string, socketId: string, name: string): Room | null {
  const room = rooms.get(code);
  if (!room || room.phase !== "lobby") return null;
  if (room.players.size >= room.config.maxPlayers) return null;
  room.players.set(socketId, { socketId, name, score: 0, foundWords: new Set(), isSpectator: false });
  return room;
}

export function setSpectator(room: Room, socketId: string, isSpectator: boolean): void {
  const player = room.players.get(socketId);
  if (player) player.isSpectator = isSpectator;
}

export function updateConfig(room: Room, config: RoomConfig): boolean {
  if (config.maxPlayers < room.players.size) return false;
  room.config = config;
  return true;
}

export function transferHost(room: Room, newHostSocketId: string): boolean {
  if (!room.players.has(newHostSocketId)) return false;
  room.hostSocketId = newHostSocketId;
  return true;
}

export function leaveRoom(socketId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) {
      room.players.delete(socketId);
      if (room.players.size === 0) {
        rooms.delete(room.code);
        return null;
      }
      if (room.hostSocketId === socketId) {
        room.hostSocketId = room.players.keys().next().value!;
      }
      return room;
    }
  }
  return null;
}

export function startRound(room: Room): void {
  room.board = generateBoard(room.config.boardSize);
  room.allWordsOnBoard = findAllWords(room.board, DICTIONARY, room.config.minWordLength);
  room.secretWord = pickSecretWord(room.allWordsOnBoard);
  room.phase = "playing";
  room.roundEndsAt = Date.now() + room.config.roundSeconds * 1000;
  for (const player of room.players.values()) {
    player.score = 0;
    player.foundWords.clear();
  }
}

export function submitWord(
  room: Room,
  socketId: string,
  word: string
): { accepted: boolean; points: number; isSecret: boolean } {
  const player = room.players.get(socketId);
  if (!player || player.isSpectator || room.phase !== "playing")
    return { accepted: false, points: 0, isSecret: false };

  const upper = word.toUpperCase();
  if (upper.length < room.config.minWordLength) return { accepted: false, points: 0, isSecret: false };
  if (player.foundWords.has(upper)) return { accepted: false, points: 0, isSecret: false };

  const match = room.allWordsOnBoard.find((w) => w.word === upper);
  if (!match) return { accepted: false, points: 0, isSecret: false };

  const isSecret = room.secretWord?.word === upper;
  const points = isSecret ? scoreForWord(upper.length) * 3 : scoreForWord(upper.length);

  player.foundWords.add(upper);
  player.score += points;

  return { accepted: true, points, isSecret };
}

export function endRound(room: Room): void {
  room.phase = "results";
  room.roundEndsAt = null;
}
