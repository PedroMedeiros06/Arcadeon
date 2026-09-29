import { Namespace, Server, Socket } from "socket.io";
import { sanitizeAvatar } from "./raceRooms";
import {
  DrawPlayer,
  DrawRoom,
  TurnEndReason,
  addFill,
  addShape,
  addStrokeFragment,
  allNonDrawersGuessed,
  autoChooseWord,
  canvasSnapshot,
  chooseWord,
  clearCanvas,
  connectedCount,
  createDrawRoom,
  currentRound,
  endTurn,
  finishGame,
  getSession,
  isConnected,
  isRoomAlive,
  joinDrawRoom,
  markDisconnected,
  maxPointsFor,
  reassignHost,
  removeDrawPlayer,
  renameDrawPlayer,
  restartGame,
  resumeDrawSession,
  sanitizeConfig,
  sanitizeName,
  schedulePhaseTimer,
  setPlayerTeam,
  shuffleTeams,
  startGame,
  startNextTurn,
  submitGuess,
  transferDrawHost,
  undoLast,
  updateDrawConfig,
} from "./drawRooms";
import {
  abortImpostorRound,
  advanceStroke,
  allVoted,
  castVote,
  chatAllowed,
  closeVoting,
  finishStroke,
  impostorGuessTimeout,
  publicImpostorState,
  startImpostorRound,
  submitImpostorGuess,
} from "./drawImpostor";

const TURN_RESULTS_MS = 5000;
const IMPOSTOR_REVEAL_MS = 9000;
/** desconectado por esse tempo: perde o host e, se estiver desenhando, o turno acaba */
const SOFT_DISCONNECT_MS = 15_000;
/** desconectado por esse tempo: sai da sala de vez */
const LOBBY_REMOVE_MS = 120_000;
const GAME_REMOVE_MS = 90_000;

type Ack = (response: { ok: boolean; reason?: string }) => void;

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function asAck(raw: unknown): Ack {
  return typeof raw === "function" ? (raw as Ack) : () => {};
}

function asText(raw: unknown, max = 40): string {
  return (typeof raw === "string" ? raw : "").trim().slice(0, max);
}

const isImpostorPhase = (room: DrawRoom) => room.phase.startsWith("impostor-");
const hasCanvas = (room: DrawRoom) =>
  room.phase === "drawing" || room.phase === "turn-results" || isImpostorPhase(room);

/**
 * Estado da sala do ponto de vista de um jogador. A palavra so vai pro desenhista e pra quem ja
 * acertou; as opcoes de palavra so pro desenhista. O token de sessao nunca sai daqui.
 */
function publicDrawRoomState(room: DrawRoom, forPlayerId: string) {
  const isDrawer = room.drawerId === forPlayerId;
  const canSeeWord = isDrawer || room.players.get(forPlayerId)?.hasGuessedThisTurn === true;
  return {
    code: room.code,
    myId: forPlayerId,
    hostId: room.hostId,
    config: room.config,
    phase: room.phase,
    turnOrder: room.turnOrder,
    round: currentRound(room),
    drawerId: room.drawerId,
    currentWord: canSeeWord ? room.currentWord : null,
    currentWordLength: room.currentWord ? room.currentWord.length : null,
    // tracinhos com espacos/hifens reais ("______ __ _____"), sem revelar nenhuma letra
    currentWordMask: room.currentWord ? room.currentWord.replace(/[^\s-]/g, "_") : null,
    currentDifficulty: room.currentDifficulty,
    wordOptions:
      isDrawer && room.wordOptions
        ? room.wordOptions.map((w) => ({ ...w, maxPoints: maxPointsFor(w.difficulty, room) }))
        : null,
    pickEndsAt: room.pickEndsAt,
    turnEndsAt: room.turnEndsAt,
    turnModifier: room.turnModifier,
    stolenBy: room.stolenBy,
    phaseEndsAt: room.phaseEndsAt,
    impostor: publicImpostorState(room, forPlayerId),
    // client corrige o relogio dele com isso (timer certo mesmo com relogio do celular adiantado)
    serverNow: Date.now(),
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      avatar: p.avatar,
      team: p.team,
      hasGuessedThisTurn: p.hasGuessedThisTurn,
      connected: isConnected(p),
    })),
  };
}

export function registerDrawNamespace(io: Server): Namespace {
  const nsp = io.of("/draw");

  function sendState(room: DrawRoom, player: DrawPlayer) {
    if (player.socketId) nsp.to(player.socketId).emit("room-updated", publicDrawRoomState(room, player.id));
  }

  function broadcast(room: DrawRoom) {
    for (const player of room.players.values()) sendState(room, player);
  }

  /** Evento pra um grupo de jogadores (ex.: so o time de quem chutou). */
  function emitTo(room: DrawRoom, ids: Iterable<string>, event: string, payload: unknown) {
    for (const id of ids) {
      const socketId = room.players.get(id)?.socketId;
      if (socketId) nsp.to(socketId).emit(event, payload);
    }
  }

  function sendSession(socket: Socket, room: DrawRoom, player: DrawPlayer) {
    socket.emit("session", { code: room.code, playerId: player.id, token: player.token });
  }

  function emitGameEnded(room: DrawRoom) {
    broadcast(room);
    nsp.to(room.code).emit("game-ended", {
      players: Array.from(room.players.values())
        .map((p) => ({ id: p.id, name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score),
    });
  }

  // ---------- fluxo classico/times (todo timer passa por schedulePhaseTimer) ----------

  function startTurnOrEnd(room: DrawRoom) {
    const minPlayers = room.config.mode === "impostor" ? 3 : 2;
    // gente de menos conectada mas outros dentro da janela de reconexao: espera alguem voltar
    // (ou o timer de saida tirar os ausentes, o que encerra a partida)
    if (room.players.size >= minPlayers && connectedCount(room) < minPlayers) {
      schedulePhaseTimer(room, Date.now() + 2000, () => startTurnOrEnd(room));
      return;
    }
    if (room.config.mode === "impostor") {
      startImpostor(room);
      return;
    }
    if (!startNextTurn(room)) {
      emitGameEnded(room);
      return;
    }
    broadcast(room);
    schedulePhaseTimer(room, room.pickEndsAt!, () => {
      autoChooseWord(room);
      beginTurn(room);
    });
  }

  function beginTurn(room: DrawRoom) {
    if (room.phase !== "drawing") return;
    broadcast(room);
    schedulePhaseTimer(room, room.turnEndsAt!, () => finishTurn(room, "timeout"));
  }

  function finishTurn(room: DrawRoom, reason: TurnEndReason) {
    if (room.phase !== "drawing" && room.phase !== "picking-word") return;
    const word = room.currentWord;
    const difficulty = room.currentDifficulty;
    const drawerId = room.drawerId;
    endTurn(room, reason);
    nsp.to(room.code).emit("turn-ended", {
      word,
      difficulty,
      drawerId,
      reason,
      stolenBy: room.stolenBy,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        team: p.team,
        gained: room.turnPoints.get(p.id) ?? 0,
      })),
    });
    broadcast(room);
    schedulePhaseTimer(room, Date.now() + TURN_RESULTS_MS, () => startTurnOrEnd(room));
  }

  // ---------- fluxo do Artista Impostor ----------

  function startImpostor(room: DrawRoom) {
    if (!startImpostorRound(room)) {
      emitGameEnded(room);
      return;
    }
    scheduleStroke(room);
    broadcast(room);
  }

  function scheduleStroke(room: DrawRoom) {
    if (room.phase === "impostor-voting") {
      schedulePhaseTimer(room, room.phaseEndsAt!, () => endVoting(room));
      return;
    }
    schedulePhaseTimer(room, room.phaseEndsAt!, () => {
      advanceStroke(room);
      scheduleStroke(room);
      broadcast(room);
    });
  }

  function endVoting(room: DrawRoom) {
    if (room.phase !== "impostor-voting") return;
    if (closeVoting(room) === "guess") {
      schedulePhaseTimer(room, room.phaseEndsAt!, () => {
        impostorGuessTimeout(room);
        afterReveal(room);
      });
      broadcast(room);
      return;
    }
    afterReveal(room);
  }

  function afterReveal(room: DrawRoom) {
    broadcast(room);
    schedulePhaseTimer(room, Date.now() + IMPOSTOR_REVEAL_MS, () => startTurnOrEnd(room));
  }

  const inGame = (room: DrawRoom) => room.phase !== "lobby" && room.phase !== "results";

  /** Depois que alguem sai de vez: fecha a sala, encerra o turno ou a partida conforme o caso. */
  function afterRemoval(room: DrawRoom, removedId: string, closed: boolean, drawerLeftDuringTurn: boolean) {
    if (closed) return;
    const minPlayers = room.config.mode === "impostor" ? 3 : 2;
    if (inGame(room) && room.players.size < minPlayers) {
      // sobrou gente de menos: encerra a partida com o placar atual
      finishGame(room);
      emitGameEnded(room);
      return;
    }
    if (isImpostorPhase(room) && room.phase !== "impostor-reveal" && room.impostor?.impostorId === removedId) {
      abortImpostorRound(room);
      afterReveal(room);
      return;
    }
    if (room.phase === "impostor-voting" && allVoted(room)) {
      endVoting(room);
      return;
    }
    if (drawerLeftDuringTurn) {
      finishTurn(room, "drawer-left");
      return;
    }
    if (allNonDrawersGuessed(room)) {
      finishTurn(room, "all-guessed");
      return;
    }
    broadcast(room);
  }

  function removeNow(room: DrawRoom, playerId: string) {
    const { closed, drawerLeftDuringTurn } = removeDrawPlayer(room, playerId);
    afterRemoval(room, playerId, closed, drawerLeftDuringTurn);
  }

  /** Janela de reconexao: 15s pra perder host/turno, 90-120s pra sair da sala. */
  function scheduleDisconnectTimers(room: DrawRoom, player: DrawPlayer) {
    const stillGone = () => isRoomAlive(room) && room.players.get(player.id) === player && !isConnected(player);

    const soft = setTimeout(() => {
      if (!stillGone()) return;
      let changed = false;
      if (room.hostId === player.id && connectedCount(room) > 0) {
        reassignHost(room);
        changed = true;
      }
      if (room.drawerId === player.id && (room.phase === "drawing" || room.phase === "picking-word")) {
        finishTurn(room, "drawer-left");
        return;
      }
      if (changed) broadcast(room);
    }, SOFT_DISCONNECT_MS);

    const hard = setTimeout(
      () => {
        if (!stillGone()) return;
        removeNow(room, player.id);
      },
      room.phase === "lobby" || room.phase === "results" ? LOBBY_REMOVE_MS : GAME_REMOVE_MS
    );

    player.disconnectTimers.push(soft, hard);
  }

  /** Socket entrando numa sala nova: se ja estava em outra, sai dela antes. */
  function leaveCurrent(socket: Socket) {
    const session = getSession(socket.id);
    if (!session) return;
    socket.leave(session.room.code);
    removeNow(session.room, session.player.id);
  }

  nsp.on("connection", (socket) => {
    /** Toda acao de jogo resolve a sala pelo socket (nunca pelo code enviado pelo client). */
    function withSession(fn: (room: DrawRoom, player: DrawPlayer) => void) {
      const session = getSession(socket.id);
      if (session) fn(session.room, session.player);
      else socket.emit("session-lost");
    }

    function sendCanvas(room: DrawRoom) {
      if (hasCanvas(room)) socket.emit("canvas-sync", { events: canvasSnapshot(room), serverNow: Date.now() });
    }

    socket.on("create-room", (raw: unknown) => {
      const data = asObject(raw);
      leaveCurrent(socket);
      const { room, player } = createDrawRoom(
        socket.id,
        sanitizeConfig(data.config),
        sanitizeName(data.name),
        sanitizeAvatar(data.avatar)
      );
      socket.join(room.code);
      sendSession(socket, room, player);
      sendState(room, player);
    });

    socket.on("join-room", (raw: unknown) => {
      const data = asObject(raw);
      const code = typeof data.code === "string" ? data.code.trim().toUpperCase() : "";
      leaveCurrent(socket);
      const result = joinDrawRoom(code, socket.id, sanitizeName(data.name), sanitizeAvatar(data.avatar));
      if ("error" in result) {
        socket.emit("join-error", { message: result.error });
        return;
      }
      socket.join(result.room.code);
      sendSession(socket, result.room, result.player);
      broadcast(result.room);
    });

    // F5 / queda de rede: client manda a sessao guardada e volta pro mesmo lugar
    socket.on("resume", (raw: unknown, ackRaw: unknown) => {
      const ack = asAck(ackRaw);
      const data = asObject(raw);
      const resumed = resumeDrawSession(data.code, data.playerId, data.token, socket.id);
      if (!resumed) {
        ack({ ok: false, reason: "expired" });
        return;
      }
      const { room, player, oldSocketId } = resumed;
      if (oldSocketId) nsp.sockets.get(oldSocketId)?.leave(room.code);
      socket.join(room.code);
      sendSession(socket, room, player);
      broadcast(room);
      sendCanvas(room);
      ack({ ok: true });
    });

    // pedido explicito de estado (aba voltou do segundo plano, etc.)
    socket.on("sync", () => {
      withSession((room, player) => {
        sendState(room, player);
        sendCanvas(room);
      });
    });

    socket.on("rename-player", (raw: unknown) => {
      withSession((room, player) => {
        if (renameDrawPlayer(player, asObject(raw).name)) broadcast(room);
      });
    });

    socket.on("update-avatar", (raw: unknown) => {
      withSession((room, player) => {
        const avatar = sanitizeAvatar(asObject(raw).avatar);
        if (!avatar) return;
        player.avatar = avatar;
        broadcast(room);
      });
    });

    socket.on("update-config", (raw: unknown) => {
      withSession((room, player) => {
        if (room.hostId !== player.id || room.phase !== "lobby") return;
        if (updateDrawConfig(room, sanitizeConfig(asObject(raw).config))) broadcast(room);
      });
    });

    socket.on("transfer-host", (raw: unknown) => {
      withSession((room, player) => {
        if (room.hostId !== player.id) return;
        if (transferDrawHost(room, asObject(raw).newHostId)) broadcast(room);
      });
    });

    // times: cada um troca o proprio time; o host pode mover qualquer um
    socket.on("set-team", (raw: unknown) => {
      withSession((room, player) => {
        const data = asObject(raw);
        const target = typeof data.playerId === "string" ? data.playerId : player.id;
        if (target !== player.id && room.hostId !== player.id) return;
        if (setPlayerTeam(room, target, data.team)) broadcast(room);
      });
    });

    socket.on("shuffle-teams", () => {
      withSession((room, player) => {
        if (room.hostId === player.id && shuffleTeams(room)) broadcast(room);
      });
    });

    socket.on("start-game", () => {
      withSession((room, player) => {
        if (room.hostId !== player.id) return;
        const error = startGame(room);
        if (error) {
          socket.emit("start-error", { message: error });
          return;
        }
        startTurnOrEnd(room);
      });
    });

    socket.on("restart-game", () => {
      withSession((room, player) => {
        if (room.hostId !== player.id) return;
        if (restartGame(room)) broadcast(room);
      });
    });

    socket.on("choose-word", (raw: unknown) => {
      withSession((room, player) => {
        if (chooseWord(room, player.id, asObject(raw).word)) beginTurn(room);
      });
    });

    socket.on("draw-stroke", (raw: unknown) => {
      withSession((room, player) => {
        const event = addStrokeFragment(room, player.id, asObject(raw));
        if (event) socket.to(room.code).emit("draw-event", event);
      });
    });

    // impostor: o jogador da vez soltou o dedo, passa a vez
    socket.on("stroke-done", () => {
      withSession((room, player) => {
        if (!finishStroke(room, player.id)) return;
        advanceStroke(room);
        scheduleStroke(room);
        broadcast(room);
      });
    });

    socket.on("draw-fill", (raw: unknown) => {
      withSession((room, player) => {
        const event = addFill(room, player.id, asObject(raw));
        if (event) socket.to(room.code).emit("draw-event", event);
      });
    });

    socket.on("draw-shape", (raw: unknown) => {
      withSession((room, player) => {
        const event = addShape(room, player.id, asObject(raw));
        if (event) socket.to(room.code).emit("draw-event", event);
      });
    });

    socket.on("clear-canvas", (raw: unknown) => {
      withSession((room, player) => {
        const event = clearCanvas(room, player.id, asObject(raw).id);
        if (event) socket.to(room.code).emit("draw-event", event);
      });
    });

    socket.on("undo-last", () => {
      withSession((room, player) => {
        const id = undoLast(room, player.id);
        if (id) socket.to(room.code).emit("event-undone", { id });
      });
    });

    socket.on("cast-vote", (raw: unknown) => {
      withSession((room, player) => {
        if (!castVote(room, player.id, asObject(raw).targetId)) return;
        if (allVoted(room)) endVoting(room);
        else broadcast(room);
      });
    });

    socket.on("submit-guess", (raw: unknown) => {
      withSession((room, player) => {
        const guess = asText(asObject(raw).guess, room.phase.startsWith("impostor-") ? 80 : 40);
        if (!guess) return;

        if (room.phase === "impostor-guess") {
          if (submitImpostorGuess(room, player.id, guess)) afterReveal(room);
          return;
        }
        if (room.phase === "impostor-drawing" || room.phase === "impostor-voting") {
          // chat da rodada (acusacoes); artista nao pode entregar a palavra
          if (Date.now() - player.lastGuessAt < 350) return;
          player.lastGuessAt = Date.now();
          if (!chatAllowed(room, player.id, guess)) {
            socket.emit("chat-blocked");
            return;
          }
          nsp.to(room.code).emit("chat-message", { id: player.id, name: player.name, text: guess });
          return;
        }

        const outcome = submitGuess(room, player, guess);
        // o autor recebe o proprio texto de volta: e assim que ele ve o proprio chute no feed
        // (inclusive o certo, que so ele ve com a palavra)
        socket.emit("guess-result", { ...outcome, guess });
        if (outcome.correct) {
          // os outros so ficam sabendo que acertou, nunca o texto
          socket.to(room.code).emit("player-guessed", {
            id: player.id,
            name: player.name,
            points: outcome.points,
            stole: outcome.stole,
          });
          if (outcome.stole) finishTurn(room, "stolen");
          else if (allNonDrawersGuessed(room)) finishTurn(room, "all-guessed");
          else broadcast(room);
        } else if (!outcome.alreadyGuessed && !outcome.tooFast && !outcome.close && !outcome.notYourTurn) {
          // chute errado: todo mundo ve. Nos times so o proprio time e o desenhista (nao ajuda o
          // adversario a roubar). Chute "quase" nao vai pros outros, entregaria a palavra
          const payload = { id: player.id, name: player.name, guess };
          if (room.config.mode === "teams") {
            const ids = Array.from(room.players.values())
              .filter((p) => p.id !== player.id && (p.team === player.team || p.id === room.drawerId))
              .map((p) => p.id);
            emitTo(room, ids, "player-guess-attempt", payload);
          } else {
            socket.to(room.code).emit("player-guess-attempt", payload);
          }
        }
      });
    });

    socket.on("leave-room", () => {
      const session = getSession(socket.id);
      if (!session) return;
      socket.leave(session.room.code);
      removeNow(session.room, session.player.id);
    });

    socket.on("disconnect", () => {
      const session = markDisconnected(socket.id);
      if (!session) return;
      const { room, player } = session;
      scheduleDisconnectTimers(room, player);
      // quem caiu nao segura o turno: se todos os outros ja acertaram/votaram, encerra
      if (allNonDrawersGuessed(room)) finishTurn(room, "all-guessed");
      else if (room.phase === "impostor-voting" && allVoted(room)) endVoting(room);
      else broadcast(room);
    });
  });

  return nsp;
}
