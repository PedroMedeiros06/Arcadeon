import { BoggleBoard, BoggleCell, generateBoardWithSecret, findAllWords, scoreForWord } from "./boggle";
import { DICTIONARY } from "./dictionary";

export interface RoomConfig {
  boardSize: number; // 4-10
  roundSeconds: number;
  minWordLength: number; // 3-5
  visibility: "public" | "private";
  maxPlayers: number; // 2-24
}

export interface PlayerAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

export interface Player {
  socketId: string;
  name: string;
  score: number;
  foundWords: Set<string>;
  foundPaths: Map<string, BoggleCell[]>;
  avatar: PlayerAvatar | null;
}

export type RoomPhase = "lobby" | "playing" | "results";

export interface Room {
  code: string;
  ownerSocketId: string; // quem criou a sala; e' a TV, nunca joga
  hostSocketId: string | null; // primeiro jogador a entrar; tem privilegios de host
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

export function createRoom(ownerSocketId: string, config: RoomConfig): Room {
  const code = generateCode();
  const room: Room = {
    code,
    ownerSocketId,
    hostSocketId: null,
    config,
    players: new Map(),
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

export function joinRoom(code: string, socketId: string, name: string, avatar?: PlayerAvatar | null): Room | null {
  const room = rooms.get(code);
  if (!room || room.phase !== "lobby") return null;
  if (socketId === room.ownerSocketId) return null;
  if (room.players.size >= room.config.maxPlayers) return null;
  room.players.set(socketId, {
    socketId,
    name,
    score: 0,
    foundWords: new Set(),
    foundPaths: new Map(),
    avatar: avatar ?? null,
  });
  if (!room.hostSocketId) room.hostSocketId = socketId;
  return room;
}

export function renamePlayer(room: Room, socketId: string, name: string): boolean {
  const player = room.players.get(socketId);
  const trimmed = name.trim().slice(0, 10);
  if (!player || !trimmed) return false;
  player.name = trimmed;
  return true;
}

export function updatePlayerAvatar(room: Room, socketId: string, avatar: PlayerAvatar): boolean {
  const player = room.players.get(socketId);
  if (!player) return false;
  player.avatar = avatar;
  return true;
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

/** Retorna o code da sala fechada (owner saiu), ou a Room atualizada, ou null se nada mudou. */
export function leaveRoom(socketId: string): { room: Room | null; closedCode: string | null } {
  for (const room of rooms.values()) {
    if (room.ownerSocketId === socketId) {
      // owner (TV) saiu: sala inteira fecha
      rooms.delete(room.code);
      return { room: null, closedCode: room.code };
    }
    if (room.players.has(socketId)) {
      room.players.delete(socketId);
      if (room.hostSocketId === socketId) {
        room.hostSocketId = room.players.keys().next().value ?? null;
      }
      return { room, closedCode: null };
    }
  }
  return { room: null, closedCode: null };
}

export function startRound(room: Room): void {
  const { board, secretWord } = generateBoardWithSecret(room.config.boardSize, DICTIONARY, room.config.minWordLength);
  room.board = board;
  room.allWordsOnBoard = findAllWords(board, DICTIONARY, room.config.minWordLength);
  room.secretWord = secretWord.word ? secretWord : null;
  console.log("[buggle] palavra secreta:", room.secretWord?.word ?? "(nenhuma)");
  console.log("[buggle] palavras possiveis no tabuleiro:", room.allWordsOnBoard.length);
  room.phase = "playing";
  room.roundEndsAt = Date.now() + room.config.roundSeconds * 1000;
  for (const player of room.players.values()) {
    player.score = 0;
    player.foundWords.clear();
    player.foundPaths.clear();
  }
}

export function submitWord(
  room: Room,
  socketId: string,
  word: string,
  path?: BoggleCell[]
): { accepted: boolean; points: number; isSecret: boolean; alreadyFound: boolean } {
  const player = room.players.get(socketId);
  if (!player || room.phase !== "playing")
    return { accepted: false, points: 0, isSecret: false, alreadyFound: false };

  const upper = word.toUpperCase();
  if (upper.length < room.config.minWordLength)
    return { accepted: false, points: 0, isSecret: false, alreadyFound: false };

  const match = room.allWordsOnBoard.find((w) => w.word === upper);
  if (!match) return { accepted: false, points: 0, isSecret: false, alreadyFound: false };

  if (player.foundWords.has(upper))
    return { accepted: false, points: 0, isSecret: false, alreadyFound: true };

  const isSecret = room.secretWord?.word === upper;
  const points = isSecret ? scoreForWord(upper.length) * 3 : scoreForWord(upper.length);

  player.foundWords.add(upper);
  player.foundPaths.set(upper, path ?? match.path);
  player.score += points;

  return { accepted: true, points, isSecret, alreadyFound: false };
}

export function endRound(room: Room): void {
  room.phase = "results";
  room.roundEndsAt = null;
}
