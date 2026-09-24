import { Server, Socket } from "socket.io";
import { CATEGORY_LABELS } from "./raceQuestions";
import { FINISH_PROGRESS } from "./raceScoring";
import {
  RaceRoom,
  createRaceRoom,
  currentQuestion,
  endQuestionIfAllAnswered,
  getRoomForSocket,
  joinRaceRoom,
  leaveRaceRoom,
  rankedPlayers,
  renameRacePlayer,
  restartRaceGame,
  sanitizeAvatar,
  sanitizeConfig,
  sanitizeName,
  setRaceAutoAdvanceListener,
  setRaceGameFinishedListener,
  setRacePlayerUser,
  startRaceGame,
  submitRaceAnswer,
  transferRaceHost,
  updateRaceConfig,
  updateRacePlayerAvatar,
} from "./raceRooms";
import { recordRaceResults, verifyAccessToken } from "./raceStats";

const RATE_LIMIT_MS = 150;

/**
 * Snapshot publico — igual pra todos na sala. Nunca contem correctIndex antes do reveal,
 * nem perguntas futuras, nem a alternativa escolhida pelos outros durante a pergunta.
 */
/**
 * Gelo visivel: do reveal em que a sequencia foi perdida ate o fim da pergunta congelada.
 * No reveal da rodada congelada ja vem false — o cliente mostra o gelo quebrando ali (wasFrozen).
 */
function isFrozenForDisplay(room: RaceRoom, frozenQ: number | null): boolean {
  if (frozenQ === null) return false;
  if (room.phase === "question") return frozenQ === room.questionIndex;
  if (room.phase === "question-results") return frozenQ === room.questionIndex + 1;
  return false;
}

export function publicRaceRoomState(room: RaceRoom) {
  const question = currentQuestion(room);
  const showQuestion = room.phase === "question" || room.phase === "question-results";
  const ranking = rankedPlayers(room).map((p) => p.socketId);
  return {
    code: room.code,
    hostSocketId: room.hostSocketId,
    config: room.config,
    phase: room.phase,
    questionIndex: room.questionIndex,
    phaseStartsAt: room.phaseStartsAt,
    phaseEndsAt: room.phaseEndsAt,
    serverNow: Date.now(),
    finishProgress: FINISH_PROGRESS,
    finishing: room.finishing,
    winnerSocketId: room.winnerSocketId,
    endReason: room.endReason,
    question:
      showQuestion && question
        ? {
            id: question.id,
            text: question.question,
            options: question.options,
            category: CATEGORY_LABELS[question.category],
            difficulty: question.difficulty,
          }
        : null,
    reveal: room.phase === "question-results" || room.phase === "results" ? room.lastReveal : null,
    players: Array.from(room.players.values()).map((p) => ({
      socketId: p.socketId,
      name: p.name,
      avatar: p.avatar,
      distance: p.distance,
      points: p.points,
      correctCount: p.correctCount,
      answeredCount: p.answeredCount,
      avgResponseMs: p.answeredCount > 0 ? Math.round(p.answeredTimeMsTotal / p.answeredCount) : null,
      answered: room.phase === "question" ? !!p.answer : false,
      rank: ranking.indexOf(p.socketId) + 1,
      streak: p.streak,
      maxStreak: p.maxStreak,
      frozen: isFrozenForDisplay(room, p.frozenQuestionIndex),
    })),
  };
}

export function registerRaceNamespace(io: Server): void {
  const nsp = io.of("/race");
  const lastEventAt = new Map<string, Map<string, number>>();

  function broadcast(room: RaceRoom) {
    nsp.to(room.code).emit("room-updated", publicRaceRoomState(room));
  }

  setRaceAutoAdvanceListener(broadcast);
  setRaceGameFinishedListener(recordRaceResults);

  // socket -> conta Supabase verificada (via evento "identify")
  const identities = new Map<string, string>();
  // descarta verificacao antiga se um identify mais novo chegou no meio
  const identifySeq = new Map<string, number>();

  /** Descarta evento se o socket repete o mesmo evento rapido demais (limite por tipo de evento). */
  function throttled(socket: Socket, event: string): boolean {
    const now = Date.now();
    let perEvent = lastEventAt.get(socket.id);
    if (!perEvent) {
      perEvent = new Map();
      lastEventAt.set(socket.id, perEvent);
    }
    if (now - (perEvent.get(event) ?? 0) < RATE_LIMIT_MS) return true;
    perEvent.set(event, now);
    return false;
  }

  function asObject(data: unknown): Record<string, unknown> {
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  }

  /** Sala e' descoberta pelo socket, nunca pelo code do cliente — impede mexer em sala alheia. */
  function hostRoom(socket: Socket): RaceRoom | null {
    const room = getRoomForSocket(socket.id);
    return room && room.hostSocketId === socket.id ? room : null;
  }

  function handleLeave(socket: Socket) {
    const { room, closedCode } = leaveRaceRoom(socket.id);
    if (room) {
      socket.leave(room.code);
      broadcast(room);
    } else if (closedCode) {
      socket.leave(closedCode);
      nsp.to(closedCode).emit("room-closed");
    }
  }

  nsp.on("connection", (socket) => {
    // sem throttle: connect + troca de sessao podem chegar juntos e o mais novo nao pode se perder
    socket.on("identify", async (raw: unknown) => {
      const seq = (identifySeq.get(socket.id) ?? 0) + 1;
      identifySeq.set(socket.id, seq);
      const userId = await verifyAccessToken(asObject(raw).accessToken);
      if (identifySeq.get(socket.id) !== seq || !socket.connected) return;
      if (userId) identities.set(socket.id, userId);
      else identities.delete(socket.id);
      setRacePlayerUser(socket.id, userId);
    });

    socket.on("create-room", (raw: unknown) => {
      if (throttled(socket, "create-room")) return;
      if (getRoomForSocket(socket.id)) handleLeave(socket);
      const data = asObject(raw);
      const room = createRaceRoom(socket.id, sanitizeConfig(data.config), sanitizeName(data.name), sanitizeAvatar(data.avatar));
      setRacePlayerUser(socket.id, identities.get(socket.id) ?? null);
      socket.join(room.code);
      broadcast(room);
    });

    socket.on("join-room", (raw: unknown) => {
      if (throttled(socket, "join-room")) return;
      const data = asObject(raw);
      if (typeof data.code !== "string") return;
      if (getRoomForSocket(socket.id)) handleLeave(socket);
      const result = joinRaceRoom(data.code.trim().toUpperCase(), socket.id, sanitizeName(data.name), sanitizeAvatar(data.avatar));
      if ("error" in result) {
        socket.emit("join-error", { message: result.error });
        return;
      }
      setRacePlayerUser(socket.id, identities.get(socket.id) ?? null);
      socket.join(result.room.code);
      broadcast(result.room);
    });

    socket.on("rename-player", (raw: unknown) => {
      if (throttled(socket, "rename-player")) return;
      const room = getRoomForSocket(socket.id);
      if (room && renameRacePlayer(room, socket.id, sanitizeName(asObject(raw).name))) broadcast(room);
    });

    socket.on("update-avatar", (raw: unknown) => {
      if (throttled(socket, "update-avatar")) return;
      const room = getRoomForSocket(socket.id);
      if (room && updateRacePlayerAvatar(room, socket.id, sanitizeAvatar(asObject(raw).avatar))) broadcast(room);
    });

    socket.on("update-config", (raw: unknown) => {
      if (throttled(socket, "update-config")) return;
      const room = hostRoom(socket);
      if (room && updateRaceConfig(room, sanitizeConfig(asObject(raw).config))) broadcast(room);
    });

    socket.on("transfer-host", (raw: unknown) => {
      if (throttled(socket, "transfer-host")) return;
      const room = hostRoom(socket);
      const target = asObject(raw).newHostSocketId;
      if (room && typeof target === "string" && transferRaceHost(room, target)) broadcast(room);
    });

    socket.on("start-game", () => {
      if (throttled(socket, "start-game")) return;
      const room = hostRoom(socket);
      if (room && startRaceGame(room)) broadcast(room);
    });

    socket.on("restart-game", () => {
      if (throttled(socket, "restart-game")) return;
      const room = hostRoom(socket);
      if (room && restartRaceGame(room)) broadcast(room);
    });

    socket.on("submit-answer", (raw: unknown) => {
      if (throttled(socket, "submit-answer")) return;
      const room = getRoomForSocket(socket.id);
      if (!room) return;
      const data = asObject(raw);
      const result = submitRaceAnswer(room, socket.id, data.questionId, data.answerIndex);
      if (!result.ok) {
        socket.emit("answer-rejected", { reason: result.reason });
        return;
      }
      // so confirma o recebimento — acerto/erro so aparece no reveal, pra ninguem vazar a resposta
      socket.emit("answer-locked", { questionId: result.answer.questionId, answerIndex: result.answer.answerIndex });
      if (endQuestionIfAllAnswered(room)) {
        broadcast(room);
      } else {
        nsp.to(room.code).emit("player-answered", { socketId: socket.id });
      }
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
