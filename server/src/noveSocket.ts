import { Server, Socket } from "socket.io";
import {
  MAX_PLAYERS,
  NoveRoom,
  chooseNoveColor,
  createNoveRoom,
  flipNoveCard,
  getRoomForSocket,
  joinNoveRoom,
  leaveNoveRoom,
  renameNovePlayer,
  restartNoveGame,
  sanitizeAvatar,
  sanitizeConfig,
  sanitizeName,
  setNoveAutoAdvanceListener,
  setNovePlayerUser,
  startNoveGame,
  updateNoveConfig,
  updateNovePlayerAvatar,
} from "./noveRooms";
import { verifyAccessToken } from "./raceStats";

const RATE_LIMIT_MS = 150;
// virar/escolher cor: a trava de animacao da sala ja segura o ritmo
const ACTION_RATE_LIMIT_MS = 40;

/**
 * Snapshot publico — igual pra todos na sala. Nunca contem o monte: so quantas cartas restam
 * e a ultima carta virada. As cartelas sao publicas (cada um ve a do outro).
 */
export function publicNoveRoomState(room: NoveRoom) {
  const game = room.game;
  const inGame = room.phase !== "lobby" && !!game;
  return {
    code: room.code,
    hostSocketId: room.hostSocketId,
    config: room.config,
    maxPlayers: MAX_PLAYERS,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    lockedUntil: room.lockedUntil,
    serverNow: Date.now(),
    endReason: room.endReason,
    table: inGame
      ? {
          drawCount: game.draw.length,
          discardCount: game.discard.length,
          lastCard: game.lastCard,
          pendingWild: game.pendingWild,
          flips: game.flips,
        }
      : null,
    turnSocketId: inGame && room.phase === "playing" && !game.finished ? room.seats[game.turn] : null,
    winnerSocketId: inGame && game.winner !== null ? room.seats[game.winner] : null,
    lastEvent: room.lastEvent,
    lobby: Array.from(room.players.values())
      .sort((a, b) => a.joinSeq - b.joinSeq)
      .map((p) => ({ socketId: p.socketId, name: p.name, avatar: p.avatar })),
    seats: inGame
      ? room.seats.map((socketId, i) => {
          const live = room.players.get(socketId);
          const board = game.players[i];
          return {
            socketId,
            name: live?.name ?? room.seatInfo[i].name,
            avatar: live?.avatar ?? room.seatInfo[i].avatar,
            cells: board.cells,
            required: board.required,
            left: !!board.left,
          };
        })
      : [],
  };
}

export function registerNoveNamespace(io: Server): void {
  const nsp = io.of("/nove");
  const lastEventAt = new Map<string, Map<string, number>>();

  function broadcast(room: NoveRoom) {
    nsp.to(room.code).emit("room-updated", publicNoveRoomState(room));
  }

  setNoveAutoAdvanceListener(broadcast);

  const identities = new Map<string, string>();
  const identifySeq = new Map<string, number>();

  /** Descarta evento se o socket repete o mesmo evento rapido demais (limite por tipo de evento). */
  function throttled(socket: Socket, event: string, limitMs = RATE_LIMIT_MS): boolean {
    const now = Date.now();
    let perEvent = lastEventAt.get(socket.id);
    if (!perEvent) {
      perEvent = new Map();
      lastEventAt.set(socket.id, perEvent);
    }
    if (now - (perEvent.get(event) ?? 0) < limitMs) return true;
    perEvent.set(event, now);
    return false;
  }

  function asObject(data: unknown): Record<string, unknown> {
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  }

  /** Sala e' descoberta pelo socket, nunca pelo code do cliente — impede mexer em sala alheia. */
  function hostRoom(socket: Socket): NoveRoom | null {
    const room = getRoomForSocket(socket.id);
    return room && room.hostSocketId === socket.id ? room : null;
  }

  function handleLeave(socket: Socket) {
    const { room, closedCode } = leaveNoveRoom(socket.id);
    if (room) {
      socket.leave(room.code);
      broadcast(room);
    } else if (closedCode) {
      socket.leave(closedCode);
      nsp.to(closedCode).emit("room-closed");
    }
  }

  nsp.on("connection", (socket) => {
    socket.on("identify", async (raw: unknown) => {
      const seq = (identifySeq.get(socket.id) ?? 0) + 1;
      identifySeq.set(socket.id, seq);
      const userId = await verifyAccessToken(asObject(raw).accessToken);
      if (identifySeq.get(socket.id) !== seq || !socket.connected) return;
      if (userId) identities.set(socket.id, userId);
      else identities.delete(socket.id);
      setNovePlayerUser(socket.id, userId);
    });

    socket.on("create-room", (raw: unknown) => {
      if (throttled(socket, "create-room")) return;
      if (getRoomForSocket(socket.id)) handleLeave(socket);
      const data = asObject(raw);
      const room = createNoveRoom(socket.id, sanitizeConfig(data.config), sanitizeName(data.name), sanitizeAvatar(data.avatar));
      setNovePlayerUser(socket.id, identities.get(socket.id) ?? null);
      socket.join(room.code);
      broadcast(room);
    });

    socket.on("join-room", (raw: unknown) => {
      if (throttled(socket, "join-room")) return;
      const data = asObject(raw);
      if (typeof data.code !== "string") return;
      if (getRoomForSocket(socket.id)) handleLeave(socket);
      const result = joinNoveRoom(data.code.trim().toUpperCase(), socket.id, sanitizeName(data.name), sanitizeAvatar(data.avatar));
      if ("error" in result) {
        socket.emit("join-error", { message: result.error });
        return;
      }
      setNovePlayerUser(socket.id, identities.get(socket.id) ?? null);
      socket.join(result.room.code);
      broadcast(result.room);
    });

    socket.on("rename-player", (raw: unknown) => {
      if (throttled(socket, "rename-player")) return;
      const room = getRoomForSocket(socket.id);
      if (room && renameNovePlayer(room, socket.id, sanitizeName(asObject(raw).name))) broadcast(room);
    });

    socket.on("update-avatar", (raw: unknown) => {
      if (throttled(socket, "update-avatar")) return;
      const room = getRoomForSocket(socket.id);
      if (room && updateNovePlayerAvatar(room, socket.id, sanitizeAvatar(asObject(raw).avatar))) broadcast(room);
    });

    socket.on("update-config", (raw: unknown) => {
      if (throttled(socket, "update-config")) return;
      const room = hostRoom(socket);
      if (room && updateNoveConfig(room, sanitizeConfig(asObject(raw).config))) broadcast(room);
    });

    socket.on("start-game", () => {
      if (throttled(socket, "start-game")) return;
      const room = hostRoom(socket);
      if (room && startNoveGame(room)) broadcast(room);
    });

    socket.on("restart-game", () => {
      if (throttled(socket, "restart-game")) return;
      const room = hostRoom(socket);
      if (room && restartNoveGame(room)) broadcast(room);
    });

    socket.on("flip", () => {
      if (throttled(socket, "flip", ACTION_RATE_LIMIT_MS)) return;
      const room = getRoomForSocket(socket.id);
      if (!room) return;
      const result = flipNoveCard(room, socket.id);
      if (!result.ok) socket.emit("action-rejected", { reason: result.reason });
      else broadcast(room);
    });

    socket.on("choose-color", (raw: unknown) => {
      if (throttled(socket, "choose-color", ACTION_RATE_LIMIT_MS)) return;
      const room = getRoomForSocket(socket.id);
      if (!room) return;
      const result = chooseNoveColor(room, socket.id, asObject(raw).color);
      if (!result.ok) socket.emit("action-rejected", { reason: result.reason });
      else broadcast(room);
    });

    socket.on("leave-room", () => handleLeave(socket));

    socket.on("disconnect", () => {
      lastEventAt.delete(socket.id);
      identities.delete(socket.id);
      identifySeq.delete(socket.id);
      handleLeave(socket);
    });
  });
}
