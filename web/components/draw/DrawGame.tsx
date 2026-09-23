"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LogOut, Palette } from "lucide-react";
import { getDrawSocket } from "@/lib/draw/socket";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Lobby } from "./Lobby";
import { RoomWaiting } from "./RoomWaiting";
import { WordPicker } from "./WordPicker";
import { GameScreen } from "./GameScreen";
import { ResultsScreen } from "./ResultsScreen";
import { JoinNameModal } from "./JoinNameModal";
import type {
  DrawRoomConfig,
  DrawRoomState,
  GameEndedPayload,
  GuessResult,
  TurnEndedPayload,
} from "@/lib/draw/types";

interface FeedItem {
  id: string;
  kind: "correct" | "own-correct" | "wrong";
  text: string;
}

interface CanvasHandlers {
  applyRemoteStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
  applyUndo: (strokeId: string) => void;
  applyClear: () => void;
}

function GameHeader({ onLeaveRoom }: { onLeaveRoom?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--border)] bg-[var(--card)] px-6 py-4">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-extrabold text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Hub
        </Link>

        <h1 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-[var(--fg)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
            <Palette className="h-4 w-4" />
          </span>
          DrawIt
        </h1>

        {onLeaveRoom ? (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 rounded-2xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-extrabold text-[var(--danger)] transition hover:opacity-80"
          >
            <LogOut className="h-4 w-4" /> Sair da sala
          </button>
        ) : (
          <span className="w-[92px]" />
        )}
      </div>
    </header>
  );
}

export function DrawGame() {
  const { username, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const joinCodeFromUrl = searchParams.get("join");
  const [room, setRoom] = useState<DrawRoomState | null>(null);
  const [gameResult, setGameResult] = useState<GameEndedPayload | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pendingAutoJoin, setPendingAutoJoin] = useState(!!joinCodeFromUrl);
  const [lobbyMode, setLobbyMode] = useState<"choose" | "create" | "join">("choose");
  const [roomClosed, setRoomClosed] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const socketRef = useRef(getDrawSocket());
  const canvasHandlersRef = useRef<CanvasHandlers | null>(null);

  useEffect(() => {
    const socket = socketRef.current;

    function handleRoomUpdated(state: DrawRoomState | null) {
      setRoom(state);
      if (state && (state.phase === "picking-word" || state.phase === "lobby")) {
        setFeed([]);
      }
      if (state && state.phase !== "results") setGameResult(null);
    }
    function handleJoinError(data: { message: string }) {
      setJoinError(data.message);
    }
    function handleDrawEvent(event: { type: "stroke"; strokeId: string; points: { x: number; y: number }[]; color: string; width: number } | { type: "clear" }) {
      if (event.type === "clear") {
        canvasHandlersRef.current?.applyClear();
      } else {
        canvasHandlersRef.current?.applyRemoteStroke(event.strokeId, event.points, event.color, event.width);
      }
    }
    function handleStrokeUndone(data: { strokeId: string }) {
      canvasHandlersRef.current?.applyUndo(data.strokeId);
    }
    function handleGuessResult(result: GuessResult) {
      if (result.correct) {
        setFeed((prev) => [
          ...prev,
          { id: `${Date.now()}-me`, kind: "own-correct", text: `Voce acertou! +${result.points} pontos` },
        ]);
      } else if (!result.alreadyGuessed && !result.tooFast) {
        setFeed((prev) => [...prev, { id: `${Date.now()}-me-wrong`, kind: "wrong", text: `Voce: palpite errado` }]);
      }
    }
    function handlePlayerGuessed(data: { socketId: string; name: string }) {
      setFeed((prev) => [...prev, { id: `${Date.now()}-${data.socketId}`, kind: "correct", text: `${data.name} acertou!` }]);
    }
    function handlePlayerGuessAttempt(data: { socketId: string; name: string; guess: string }) {
      setFeed((prev) => [
        ...prev,
        { id: `${Date.now()}-${data.socketId}-attempt`, kind: "wrong", text: `${data.name}: ${data.guess}` },
      ]);
    }
    function handleTurnEnded(data: TurnEndedPayload) {
      setFeed((prev) => [
        ...prev,
        { id: `${Date.now()}-turn`, kind: "wrong", text: `A palavra era: ${data.word ?? "?"}` },
      ]);
    }
    function handleGameEnded(data: GameEndedPayload) {
      setGameResult(data);
    }
    function handleRoomClosed() {
      setRoom(null);
      setGameResult(null);
      setRoomClosed(true);
    }

    socket.on("room-updated", handleRoomUpdated);
    socket.on("join-error", handleJoinError);
    socket.on("draw-event", handleDrawEvent);
    socket.on("stroke-undone", handleStrokeUndone);
    socket.on("guess-result", handleGuessResult);
    socket.on("player-guessed", handlePlayerGuessed);
    socket.on("player-guess-attempt", handlePlayerGuessAttempt);
    socket.on("turn-ended", handleTurnEnded);
    socket.on("game-ended", handleGameEnded);
    socket.on("room-closed", handleRoomClosed);

    return () => {
      socket.off("room-updated", handleRoomUpdated);
      socket.off("join-error", handleJoinError);
      socket.off("draw-event", handleDrawEvent);
      socket.off("stroke-undone", handleStrokeUndone);
      socket.off("guess-result", handleGuessResult);
      socket.off("player-guessed", handlePlayerGuessed);
      socket.off("player-guess-attempt", handlePlayerGuessAttempt);
      socket.off("turn-ended", handleTurnEnded);
      socket.off("game-ended", handleGameEnded);
      socket.off("room-closed", handleRoomClosed);
    };
  }, []);

  useEffect(() => {
    if (!joinCodeFromUrl || authLoading || room) return;
    if (username) {
      socketRef.current.emit("join-room", { code: joinCodeFromUrl, name: username });
      setPendingAutoJoin(false);
    }
  }, [joinCodeFromUrl, authLoading, username, room]);

  function handleCreate(config: DrawRoomConfig, name: string) {
    setRoomClosed(false);
    const socket = socketRef.current;
    if (!socket.connected) {
      console.log("[drawit] socket desconectado ao criar sala, forcando reconexao");
      socket.connect();
      socket.once("connect", () => socket.emit("create-room", { config, name }));
      return;
    }
    socket.emit("create-room", { config, name });
  }

  function handleJoinWithName(name: string) {
    if (joinCodeFromUrl) {
      socketRef.current.emit("join-room", { code: joinCodeFromUrl, name });
      setPendingAutoJoin(false);
    }
  }

  function handleJoin(name: string, code: string) {
    setJoinError(null);
    setRoomClosed(false);
    socketRef.current.emit("join-room", { code, name });
  }

  function handleStart() {
    if (room) socketRef.current.emit("start-game", { code: room.code });
  }

  function handlePlayAgain() {
    if (room) socketRef.current.emit("restart-game", { code: room.code });
  }

  function handleUpdateConfig(config: DrawRoomConfig) {
    if (room) socketRef.current.emit("update-config", { code: room.code, config });
  }

  function handleTransferHost(newHostSocketId: string) {
    if (room) socketRef.current.emit("transfer-host", { code: room.code, newHostSocketId });
  }

  function handleChooseWord(word: string) {
    if (room) socketRef.current.emit("choose-word", { code: room.code, word });
  }

  function handleStroke(strokeId: string, points: { x: number; y: number }[], color: string, width: number) {
    if (room) socketRef.current.emit("draw-stroke", { code: room.code, strokeId, points, color, width });
  }

  function handleClear() {
    if (room) socketRef.current.emit("clear-canvas", { code: room.code });
  }

  function handleUndo() {
    if (room) socketRef.current.emit("undo-last", { code: room.code });
  }

  function handleSubmitGuess(guess: string) {
    if (room) socketRef.current.emit("submit-guess", { code: room.code, guess });
  }

  function handleLeaveRoom() {
    if (room) socketRef.current.emit("leave-room", { code: room.code });
    setRoom(null);
    setGameResult(null);
  }

  if (!room && joinCodeFromUrl && pendingAutoJoin) {
    if (authLoading) {
      return (
        <>
          <GameHeader />
          <div className="flex flex-1 items-center justify-center">
            <p className="font-semibold text-[var(--fg-muted)]">Carregando...</p>
          </div>
        </>
      );
    }
    if (!username) {
      return (
        <>
          <GameHeader />
          <JoinNameModal onConfirm={handleJoinWithName} joinError={joinError} />
        </>
      );
    }
  }

  if (!room) {
    return (
      <>
        {lobbyMode !== "create" && <GameHeader />}
        {roomClosed && (
          <p className="mt-4 text-center text-sm font-bold text-[var(--danger)]">A sala foi encerrada.</p>
        )}
        <Lobby
          defaultName={username ?? ""}
          isNameLocked={!!username}
          onCreate={handleCreate}
          onJoin={handleJoin}
          joinError={joinError}
          onModeChange={setLobbyMode}
        />
      </>
    );
  }

  const mySocketId = socketRef.current.id ?? "";
  const amHost = room.hostSocketId === mySocketId;

  if (room.phase === "lobby") {
    return (
      <RoomWaiting
        room={room}
        mySocketId={mySocketId}
        onStart={handleStart}
        onLeaveRoom={handleLeaveRoom}
        onUpdateConfig={handleUpdateConfig}
        onTransferHost={handleTransferHost}
      />
    );
  }

  if (room.phase === "results" && gameResult) {
    return (
      <>
        <GameHeader onLeaveRoom={handleLeaveRoom} />
        <ResultsScreen result={gameResult} isHost={amHost} onPlayAgain={handlePlayAgain} />
      </>
    );
  }

  const isDrawer = room.currentDrawerSocketId === mySocketId;

  return (
    <>
      <GameHeader onLeaveRoom={handleLeaveRoom} />
      {room.phase === "picking-word" && isDrawer && room.wordOptions && (
        <WordPicker options={room.wordOptions} onChoose={handleChooseWord} />
      )}
      {room.phase === "picking-word" && !isDrawer && (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-semibold text-[var(--fg-muted)]">
            {room.players.find((p) => p.socketId === room.currentDrawerSocketId)?.name ?? "Alguem"} esta escolhendo
            uma palavra...
          </p>
        </div>
      )}
      {(room.phase === "drawing" || room.phase === "turn-results") && (
        <GameScreen
          room={room}
          mySocketId={mySocketId}
          feed={feed}
          onStroke={handleStroke}
          onClear={handleClear}
          onUndo={handleUndo}
          onSubmitGuess={handleSubmitGuess}
          registerCanvasHandlers={(handlers) => {
            canvasHandlersRef.current = handlers;
          }}
        />
      )}
    </>
  );
}
