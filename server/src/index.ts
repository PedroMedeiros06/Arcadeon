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
  updatePlayerAvatar,
  setPlayerUser,
  RoomConfig,
  PlayerAvatar,
} from "./rooms";
import { registerDrawNamespace } from "./drawSocket";
import { registerRaceNamespace } from "./raceSocket";
import { registerCofreNamespace } from "./cofreSocket";
import { getDrawRoom } from "./drawRooms";
import { hasRaceRoom } from "./raceRooms";
import { hasCofreRoom } from "./cofreRooms";
import { verifyAccessToken } from "./raceStats";
import { recordBuggleRound } from "./buggleStats";

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

app.get("/rooms/:code", (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const games: string[] = [];
  if (/^[A-HJ-NP-Z2-9]{5}$/.test(code)) {
    if (getRoom(code)) games.push("buggle");
    if (getDrawRoom(code)) games.push("drawit");
    if (hasRaceRoom(code)) games.push("corrida");
    if (hasCofreRoom(code)) games.push("cofre");
  }
  res.set("Cache-Control", "no-store");
  res.json({ games });
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
      userId: p.userId,
    })),
  };
}

// socket -> conta Supabase verificada (via evento "identify")
const buggleIdentities = new Map<string, string>();
// descarta verificacao antiga se um identify mais novo chegou no meio
const buggleIdentifySeq = new Map<string, number>();

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);

  socket.on("identify", async (raw: unknown) => {
    const seq = (buggleIdentifySeq.get(socket.id) ?? 0) + 1;
    buggleIdentifySeq.set(socket.id, seq);
    const token = typeof raw === "object" && raw !== null ? (raw as { accessToken?: unknown }).accessToken : null;
    const userId = await verifyAccessToken(token);
    if (buggleIdentifySeq.get(socket.id) !== seq || !socket.connected) return;
    if (userId) buggleIdentities.set(socket.id, userId);
    else buggleIdentities.delete(socket.id);
    const room = setPlayerUser(socket.id, userId);
    if (room) io.to(room.code).emit("room-updated", publicRoomState(room));
  });

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
    const room = joinRoom(
      data.code.toUpperCase(),
      socket.id,
      data.name,
      data.avatar ?? null,
      buggleIdentities.get(socket.id) ?? null
    );
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
    // tambem pode editar na tela de resultados, pra mudar a proxima rodada sem recriar a sala
    if (!room || room.hostSocketId !== socket.id || room.phase === "playing") return;
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
    // clique duplo nao reinicia a rodada em andamento
    if (!room || room.hostSocketId !== socket.id || room.phase === "playing") return;
    startRound(room);
    io.to(room.code).emit("room-updated", publicRoomState(room));

    const roundId = room.roundId!;
    const remainingMs = room.roundEndsAt! - Date.now();
    setTimeout(() => {
      if (room.phase !== "playing" || room.roundId !== roundId) return;
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

      // sala fechada durante a rodada: nao paga
      if (getRoom(room.code) !== room) return;
      recordBuggleRound(room, roundId, (socketIds, result) => {
        for (const id of socketIds) io.to(id).emit("coins-awarded", result);
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
    buggleIdentities.delete(socket.id);
    buggleIdentifySeq.delete(socket.id);
    const { room, closedCode } = leaveRoom(socket.id);
    if (room) {
      io.to(room.code).emit("room-updated", publicRoomState(room));
    } else if (closedCode) {
      io.to(closedCode).emit("room-closed");
    }
  });
});

// ---------- DrawIt ----------
registerDrawNamespace(io);
console.log(`[boot] namespace /draw registrado boot=${BOOT_ID}`);

// ---------- Corrida do Conhecimento ----------
registerRaceNamespace(io);

// ---------- Cofre ----------
registerCofreNamespace(io);

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
