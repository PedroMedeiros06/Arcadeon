import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Namespace } from "socket.io";
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  startRound,
  submitWord,
  endRound,
  updateConfig,
  transferHost,
  renamePlayer,
  updatePlayerAvatar,
  RoomConfig,
  PlayerAvatar,
} from "./rooms";
import {
  createDrawRoom,
  getDrawRoom,
  joinDrawRoom,
  leaveDrawRoom,
  renameDrawPlayer,
  updateDrawPlayerAvatar,
  updateDrawConfig,
  transferDrawHost,
  restartGame,
  startNextTurn,
  chooseWord,
  addStrokeEvent,
  undoLastStroke,
  clearCanvasEvent,
  submitGuess,
  allNonDrawersGuessed,
  endTurn,
  DrawRoom,
  DrawRoomConfig,
} from "./drawRooms";
import { registerRaceNamespace } from "./raceSocket";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

const BOOT_ID = `${Date.now()}-${process.pid}`;
console.log(`[boot] processo iniciado boot=${BOOT_ID} pid=${process.pid} em ${new Date().toISOString()}`);

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", boot: BOOT_ID, uptime_s: Math.round(process.uptime()) });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

// evita CDN/proxy (Render/Cloudflare) cacheando respostas de polling do
// Engine.IO, o que corrompe sessoes com "Session ID unknown"
io.engine.on("connection", (rawSocket) => {
  rawSocket.on("headers", (headers: Record<string, string>) => {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private";
  });
});

io.engine.on("connection_error", (err) => {
  console.log(
    `[engine-error] boot=${BOOT_ID} code=${err.code} message="${err.message}" context=${JSON.stringify(err.context ?? {})}`
  );
});

function publicRoomState(room: ReturnType<typeof getRoom>) {
  if (!room) return null;
  return {
    code: room.code,
    ownerSocketId: room.ownerSocketId,
    hostSocketId: room.hostSocketId,
    config: room.config,
    phase: room.phase,
    board: room.board,
    roundEndsAt: room.roundEndsAt,
    players: Array.from(room.players.values()).map((p) => ({
      socketId: p.socketId,
      name: p.name,
      score: p.score,
      wordsFound: p.foundWords.size,
      avatar: p.avatar,
    })),
  };
}

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);

  socket.on("create-room", (data: { config: RoomConfig }) => {
    const room = createRoom(socket.id, data.config);
    socket.join(room.code);
    socket.emit("room-updated", publicRoomState(room));
  });

  socket.on("join-room", (data: { code: string; name: string; avatar?: PlayerAvatar }) => {
    const existingRoom = getRoom(data.code.toUpperCase());
    if (existingRoom && existingRoom.players.size >= existingRoom.config.maxPlayers) {
      socket.emit("join-error", { message: "Sala cheia." });
      return;
    }
    const room = joinRoom(data.code.toUpperCase(), socket.id, data.name, data.avatar);
    if (!room) {
      socket.emit("join-error", { message: "Sala não encontrada ou já iniciada." });
      return;
    }
    socket.join(room.code);
    io.to(room.code).emit("room-updated", publicRoomState(room));
  });

  socket.on("rename-player", (data: { code: string; name: string }) => {
    const room = getRoom(data.code);
    if (!room) return;
    if (renamePlayer(room, socket.id, data.name)) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    }
  });

  socket.on("update-avatar", (data: { code: string; avatar: PlayerAvatar }) => {
    const room = getRoom(data.code);
    if (!room) return;
    if (updatePlayerAvatar(room, socket.id, data.avatar)) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    }
  });

  socket.on("update-config", (data: { code: string; config: RoomConfig }) => {
    const room = getRoom(data.code);
    if (!room || room.hostSocketId !== socket.id || room.phase !== "lobby") return;
    if (updateConfig(room, data.config)) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    }
  });

  socket.on("set-results-speed", (data: { code: string; fast: boolean }) => {
    const room = getRoom(data.code);
    if (!room || room.hostSocketId !== socket.id) return;
    io.to(room.code).emit("results-speed-changed", { fast: data.fast });
  });

  socket.on("results-reveal-done", (data: { code: string }) => {
    const room = getRoom(data.code);
    if (!room || room.ownerSocketId !== socket.id) return;
    io.to(room.code).emit("results-reveal-done");
  });

  socket.on("transfer-host", (data: { code: string; newHostSocketId: string }) => {
    const room = getRoom(data.code);
    if (!room || room.hostSocketId !== socket.id || room.phase !== "lobby") return;
    if (transferHost(room, data.newHostSocketId)) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    }
  });

  socket.on("start-round", (data: { code: string }) => {
    const room = getRoom(data.code);
    if (!room || room.hostSocketId !== socket.id) return;
    startRound(room);
    io.to(room.code).emit("room-updated", publicRoomState(room));

    const remainingMs = room.roundEndsAt! - Date.now();
    setTimeout(() => {
      if (room.phase !== "playing") return;
      endRound(room);
      const foundByAnyone = new Set<string>();
      for (const player of room.players.values()) {
        for (const word of player.foundWords) foundByAnyone.add(word);
      }
      const discoveredWords = room.allWordsOnBoard.filter((w) => foundByAnyone.has(w.word));

      io.to(room.code).emit("round-ended", {
        room: publicRoomState(room),
        allWords: discoveredWords.map((w) => ({ word: w.word, path: w.path })),
        secretWord: room.secretWord ? { word: room.secretWord.word, path: room.secretWord.path } : null,
        foundBy: Array.from(room.players.values()).map((p) => ({
          socketId: p.socketId,
          name: p.name,
          foundWords: Array.from(p.foundWords),
        })),
      });
    }, remainingMs);
  });

  socket.on("submit-word", (data: { code: string; word: string; path?: { row: number; col: number; letter: string }[] }) => {
    const room = getRoom(data.code);
    if (!room) return;
    const result = submitWord(room, socket.id, data.word, data.path);
    socket.emit("word-result", { word: data.word, ...result });
    if (result.accepted) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    }
  });

  socket.on("leave-room", (data: { code: string }) => {
    const { room, closedCode } = leaveRoom(socket.id);
    socket.leave(data.code);
    if (room) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    } else if (closedCode) {
      io.to(closedCode).emit("room-closed");
    }
  });

  socket.on("disconnect", () => {
    console.log(`socket disconnected: ${socket.id}`);
    const { room, closedCode } = leaveRoom(socket.id);
    if (room) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    } else if (closedCode) {
      io.to(closedCode).emit("room-closed");
    }
  });
});

// ---------- DrawIt ----------

const TURN_RESULTS_MS = 4000;

function publicDrawRoomState(room: DrawRoom | undefined, forSocketId: string) {
  if (!room) return null;
  const isDrawer = room.currentDrawerSocketId === forSocketId;
  return {
    code: room.code,
    hostSocketId: room.hostSocketId,
    config: room.config,
    phase: room.phase,
    turnOrder: room.turnOrder,
    currentDrawerSocketId: room.currentDrawerSocketId,
    currentWord: isDrawer ? room.currentWord : null,
    currentWordLength: room.currentWord ? room.currentWord.length : null,
    wordOptions: isDrawer ? room.wordOptions : null,
    turnEndsAt: room.turnEndsAt,
    events: room.events,
    players: Array.from(room.players.values()).map((p) => ({
      socketId: p.socketId,
      name: p.name,
      score: p.score,
      avatar: p.avatar,
      hasGuessedThisTurn: p.hasGuessedThisTurn,
    })),
  };
}

function broadcastDrawRoom(io: Server | Namespace, room: DrawRoom) {
  for (const socketId of room.players.keys()) {
    io.to(socketId).emit("room-updated", publicDrawRoomState(room, socketId));
  }
}

function handleTurnTimeout(io: Server | Namespace, room: DrawRoom) {
  if (room.phase !== "drawing") return;
  finishTurn(io, room, "timeout");
}

function finishTurn(io: Server | Namespace, room: DrawRoom, reason: "timeout" | "all-guessed" | "drawer-left") {
  const word = room.currentWord;
  const drawerId = room.currentDrawerSocketId;
  endTurn(room, reason);
  io.to(room.code).emit("turn-ended", {
    word,
    drawerSocketId: drawerId,
    reason,
    players: Array.from(room.players.values()).map((p) => ({ socketId: p.socketId, name: p.name, score: p.score })),
  });
  if (room.phase === "results") {
    broadcastDrawRoom(io, room);
    io.to(room.code).emit("game-ended", {
      players: Array.from(room.players.values())
        .map((p) => ({ socketId: p.socketId, name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score),
    });
  } else {
    broadcastDrawRoom(io, room);
    setTimeout(() => {
      if (room.phase !== "turn-results") return;
      startNextTurn(room);
      broadcastDrawRoom(io, room);
    }, TURN_RESULTS_MS);
  }
}

const drawNsp = io.of("/draw");
console.log(`[boot] namespace /draw registrado boot=${BOOT_ID}`);

drawNsp.on("connection", (socket) => {
  console.log(
    `[draw:connect] boot=${BOOT_ID} socket=${socket.id} transport=${socket.conn.transport.name} em ${new Date().toISOString()}`
  );

  socket.conn.on("upgrade", (transport) => {
    console.log(`[draw:upgrade] boot=${BOOT_ID} socket=${socket.id} novo_transport=${transport.name}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[draw:disconnect] boot=${BOOT_ID} socket=${socket.id} reason=${reason}`);
  });

  socket.on("create-room", (data: { config: DrawRoomConfig; name: string }) => {
    console.log(`[draw:create-room] boot=${BOOT_ID} socket=${socket.id} name=${data.name}`);
    const room = createDrawRoom(socket.id, data.config, data.name);
    socket.join(room.code);
    socket.emit("room-updated", publicDrawRoomState(room, socket.id));
  });

  socket.on("join-room", (data: { code: string; name: string; avatar?: PlayerAvatar }) => {
    const code = data.code.toUpperCase();
    const existingRoom = getDrawRoom(code);
    if (existingRoom && existingRoom.players.size >= existingRoom.config.maxPlayers) {
      socket.emit("join-error", { message: "Sala cheia." });
      return;
    }
    const room = joinDrawRoom(code, socket.id, data.name, data.avatar);
    if (!room) {
      socket.emit("join-error", { message: "Sala não encontrada ou já iniciada." });
      return;
    }
    socket.join(room.code);
    broadcastDrawRoom(drawNsp, room);
  });

  socket.on("rename-player", (data: { code: string; name: string }) => {
    const room = getDrawRoom(data.code);
    if (!room) return;
    if (renameDrawPlayer(room, socket.id, data.name)) broadcastDrawRoom(drawNsp, room);
  });

  socket.on("update-avatar", (data: { code: string; avatar: PlayerAvatar }) => {
    const room = getDrawRoom(data.code);
    if (!room) return;
    if (updateDrawPlayerAvatar(room, socket.id, data.avatar)) broadcastDrawRoom(drawNsp, room);
  });

  socket.on("update-config", (data: { code: string; config: DrawRoomConfig }) => {
    const room = getDrawRoom(data.code);
    if (!room || room.hostSocketId !== socket.id || room.phase !== "lobby") return;
    if (updateDrawConfig(room, data.config)) broadcastDrawRoom(drawNsp, room);
  });

  socket.on("transfer-host", (data: { code: string; newHostSocketId: string }) => {
    const room = getDrawRoom(data.code);
    if (!room || room.hostSocketId !== socket.id) return;
    if (transferDrawHost(room, data.newHostSocketId)) broadcastDrawRoom(drawNsp, room);
  });

  socket.on("start-game", (data: { code: string }) => {
    const room = getDrawRoom(data.code);
    if (!room || room.hostSocketId !== socket.id || room.phase !== "lobby") return;
    startNextTurn(room);
    broadcastDrawRoom(drawNsp, room);
  });

  socket.on("restart-game", (data: { code: string }) => {
    const room = getDrawRoom(data.code);
    if (!room || room.hostSocketId !== socket.id) return;
    if (restartGame(room)) broadcastDrawRoom(drawNsp, room);
  });

  socket.on("choose-word", (data: { code: string; word: string }) => {
    const room = getDrawRoom(data.code);
    if (!room) return;
    if (chooseWord(room, socket.id, data.word, (r) => handleTurnTimeout(drawNsp, r))) {
      broadcastDrawRoom(drawNsp, room);
      drawNsp.to(room.code).emit("turn-started", {
        drawerSocketId: room.currentDrawerSocketId,
        wordLength: room.currentWord!.length,
        turnEndsAt: room.turnEndsAt,
      });
    }
  });

  socket.on(
    "draw-stroke",
    (data: { code: string; strokeId: string; points: { x: number; y: number }[]; color: string; width: number }) => {
      const room = getDrawRoom(data.code);
      if (!room) return;
      const event = addStrokeEvent(room, socket.id, data.strokeId, data.points, data.color, data.width);
      if (event) socket.to(room.code).emit("draw-event", event);
    }
  );

  socket.on("undo-last", (data: { code: string }) => {
    const room = getDrawRoom(data.code);
    if (!room) return;
    const strokeId = undoLastStroke(room, socket.id);
    if (strokeId) socket.to(room.code).emit("stroke-undone", { strokeId });
  });

  socket.on("clear-canvas", (data: { code: string }) => {
    const room = getDrawRoom(data.code);
    if (!room) return;
    const event = clearCanvasEvent(room, socket.id);
    if (event) socket.to(room.code).emit("draw-event", event);
  });

  socket.on("submit-guess", (data: { code: string; guess: string }) => {
    const room = getDrawRoom(data.code);
    if (!room) return;
    const outcome = submitGuess(room, socket.id, data.guess);
    socket.emit("guess-result", outcome);
    const player = room.players.get(socket.id);
    if (outcome.correct) {
      drawNsp.to(room.code).emit("player-guessed", { socketId: socket.id, name: player?.name ?? "" });
      broadcastDrawRoom(drawNsp, room);
      if (allNonDrawersGuessed(room)) {
        finishTurn(drawNsp, room, "all-guessed");
      }
    } else if (!outcome.alreadyGuessed && !outcome.tooFast) {
      // tentativa errada: broadcast pros outros (exceto quem tentou, que ja mostra local) pro historico de chutes
      socket.to(room.code).emit("player-guess-attempt", { socketId: socket.id, name: player?.name ?? "", guess: data.guess });
    }
  });

  socket.on("leave-room", (data: { code: string }) => {
    const { room, closedCode, drawerLeftDuringTurn } = leaveDrawRoom(socket.id);
    socket.leave(data.code);
    if (room && drawerLeftDuringTurn) finishTurn(drawNsp, room, "drawer-left");
    else if (room) broadcastDrawRoom(drawNsp, room);
    else if (closedCode) drawNsp.to(closedCode).emit("room-closed");
  });

  socket.on("disconnect", () => {
    const { room, closedCode, drawerLeftDuringTurn } = leaveDrawRoom(socket.id);
    if (room && drawerLeftDuringTurn) finishTurn(drawNsp, room, "drawer-left");
    else if (room) broadcastDrawRoom(drawNsp, room);
    else if (closedCode) drawNsp.to(closedCode).emit("room-closed");
  });
});

// ---------- Corrida do Conhecimento ----------
registerRaceNamespace(io);

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
