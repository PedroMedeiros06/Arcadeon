import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
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
  RoomConfig,
} from "./rooms";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
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

  socket.on("join-room", (data: { code: string; name: string }) => {
    const existingRoom = getRoom(data.code.toUpperCase());
    if (existingRoom && existingRoom.players.size >= existingRoom.config.maxPlayers) {
      socket.emit("join-error", { message: "Sala cheia." });
      return;
    }
    const room = joinRoom(data.code.toUpperCase(), socket.id, data.name);
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

  socket.on("update-config", (data: { code: string; config: RoomConfig }) => {
    const room = getRoom(data.code);
    if (!room || room.hostSocketId !== socket.id || room.phase !== "lobby") return;
    if (updateConfig(room, data.config)) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    }
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

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
