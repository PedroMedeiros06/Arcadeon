import { Server, Socket } from "socket.io";
import {
  CofreRoom,
  cofrePlacements,
  createCofreRoom,
  flipCofreCard,
  getRoomForSocket,
  joinCofreRoom,
  leaveCofreRoom,
  renameCofrePlayer,
  restartCofreGame,
  sanitizeAvatar,
  sanitizeConfig,
  sanitizeName,
  setCofreAutoAdvanceListener,
  setCofreGameFinishedListener,
  setCofrePeekListener,
  setCofrePlayerUser,
  startCofreGame,
  transferCofreHost,
  updateCofreConfig,
  updateCofrePlayerAvatar,
} from "./cofreRooms";
import { recordCofreMatch } from "./cofreStats";
import { verifyAccessToken } from "./raceStats";

const RATE_LIMIT_MS = 150;
// virar carta: duas cartas em sequencia rapida sao legitimas; a regra da vez ja protege
const FLIP_RATE_LIMIT_MS = 40;

/**
 * Snapshot publico — igual pra todos na sala. Nunca contem a face de uma carta escondida:
 * so das viradas agora e dos pares ja levados. Troca do tabuleiro movel sai so como indices.
 */
export function publicCofreRoomState(room: CofreRoom) {
  const game = room.game;
  const places = cofrePlacements(room);
  const inGame = room.phase !== "lobby" && !!game;
  return {
    code: room.code,
    hostSocketId: room.hostSocketId,
    config: room.config,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    lockedUntil: room.lockedUntil,
    serverNow: Date.now(),
    endReason: room.endReason,
    board: inGame
      ? {
          cols: game.cols,
          rows: game.rows,
          cells: game.cells.map((c) => ({ face: c.state === "hidden" ? null : c.face, state: c.state })),
          flipped: game.flipped,
          moves: game.moves,
        }
      : null,
    turnSocketId: inGame && room.phase === "playing" && !game.finished ? room.seats[game.turn] : null,
    swap: room.swap,
    lastEvent: room.lastEvent,
    lobby: Array.from(room.players.values())
      .sort((a, b) => a.joinSeq - b.joinSeq)
      .map((p) => ({ socketId: p.socketId, name: p.name, avatar: p.avatar })),
    seats: inGame
      ? room.seats.map((socketId, i) => {
          const live = room.players.get(socketId);
          const score = game.players[i];
          return {
            socketId,
            name: live?.name ?? room.seatInfo[i].name,
            avatar: live?.avatar ?? room.seatInfo[i].avatar,
            points: score.points,
            pairs: score.pairs,
            misses: score.misses,
            left: !!score.left,
            place: places[i] ?? 0,
          };
        })
      : [],
  };
}

export function registerCofreNamespace(io: Server): void {
  const nsp = io.of("/cofre");
  const lastEventAt = new Map<string, Map<string, number>>();

  function broadcast(room: CofreRoom) {
    nsp.to(room.code).emit("room-updated", publicCofreRoomState(room));
  }

  setCofreAutoAdvanceListener(broadcast);
  setCofreGameFinishedListener((room) => {
    // evento privado (excecao ao snapshot unico): o saldo de cada um so interessa a ele
    recordCofreMatch(room, (socketIds, result) => {
      for (const id of socketIds) nsp.to(id).emit("coins-awarded", result);
    });
  });
  setCofrePeekListener((room, faces, endsAt) => {
    nsp.to(room.code).emit("peek", { faces, endsAt, serverNow: Date.now() });
  });

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
  function hostRoom(socket: Socket): CofreRoom | null {
    const room = getRoomForSocket(socket.id);
    return room && room.hostSocketId === socket.id ? room : null;
  }

  function handleLeave(socket: Socket) {
    const { room, closedCode } = leaveCofreRoom(socket.id);
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
      setCofrePlayerUser(socket.id, userId);
    });

    socket.on("create-room", (raw: unknown) => {
      if (throttled(socket, "create-room")) return;
      if (getRoomForSocket(socket.id)) handleLeave(socket);
      const data = asObject(raw);
      const room = createCofreRoom(socket.id, sanitizeConfig(data.config), sanitizeName(data.name), sanitizeAvatar(data.avatar));
      setCofrePlayerUser(socket.id, identities.get(socket.id) ?? null);
      socket.join(room.code);
      broadcast(room);
    });

    socket.on("join-room", (raw: unknown) => {
      if (throttled(socket, "join-room")) return;
      const data = asObject(raw);
      if (typeof data.code !== "string") return;
      if (getRoomForSocket(socket.id)) handleLeave(socket);
      const result = joinCofreRoom(data.code.trim().toUpperCase(), socket.id, sanitizeName(data.name), sanitizeAvatar(data.avatar));
      if ("error" in result) {
        socket.emit("join-error", { message: result.error });
        return;
      }
      setCofrePlayerUser(socket.id, identities.get(socket.id) ?? null);
      socket.join(result.room.code);
      broadcast(result.room);
    });

    socket.on("rename-player", (raw: unknown) => {
      if (throttled(socket, "rename-player")) return;
      const room = getRoomForSocket(socket.id);
      if (room && renameCofrePlayer(room, socket.id, sanitizeName(asObject(raw).name))) broadcast(room);
    });

    socket.on("update-avatar", (raw: unknown) => {
      if (throttled(socket, "update-avatar")) return;
      const room = getRoomForSocket(socket.id);
      if (room && updateCofrePlayerAvatar(room, socket.id, sanitizeAvatar(asObject(raw).avatar))) broadcast(room);
    });

    socket.on("update-config", (raw: unknown) => {
      if (throttled(socket, "update-config")) return;
      const room = hostRoom(socket);
      if (room && updateCofreConfig(room, sanitizeConfig(asObject(raw).config))) broadcast(room);
    });

    socket.on("transfer-host", (raw: unknown) => {
      if (throttled(socket, "transfer-host")) return;
      const room = hostRoom(socket);
      const target = asObject(raw).newHostSocketId;
      if (room && typeof target === "string" && transferCofreHost(room, target)) broadcast(room);
    });

    socket.on("start-game", () => {
      if (throttled(socket, "start-game")) return;
      const room = hostRoom(socket);
      if (room && startCofreGame(room)) broadcast(room);
    });

    socket.on("restart-game", () => {
      if (throttled(socket, "restart-game")) return;
      const room = hostRoom(socket);
      if (room && restartCofreGame(room)) broadcast(room);
    });

    socket.on("flip", (raw: unknown) => {
      if (throttled(socket, "flip", FLIP_RATE_LIMIT_MS)) return;
      const room = getRoomForSocket(socket.id);
      if (!room) return;
      const result = flipCofreCard(room, socket.id, asObject(raw).index);
      if (!result.ok) {
        socket.emit("flip-rejected", { reason: result.reason });
        return;
      }
      broadcast(room);
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
