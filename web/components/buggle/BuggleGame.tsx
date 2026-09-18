"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getBuggleSocket } from "@/lib/buggle/socket";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Lobby } from "./Lobby";
import { RoomWaiting } from "./RoomWaiting";
import { Board } from "./Board";
import { GamePlayScreen } from "./GamePlayScreen";
import { ResultsScreen } from "./ResultsScreen";
import { JoinNameModal } from "./JoinNameModal";
import type { RoomConfig, RoomState, RoundEndedPayload, WordResult } from "@/lib/buggle/types";

function GameHeader({ onLeaveRoom }: { onLeaveRoom?: () => void }) {
  return (
    <header className="border-b-4 border-[var(--border)] bg-[var(--card)] px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {onLeaveRoom ? (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 text-sm font-bold text-[var(--danger)] transition hover:opacity-80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sair da sala
          </button>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-bold text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Hub
          </Link>
        )}
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[var(--fg)]">
          <span className="text-2xl">🔤</span> Buggle
        </h1>
        <span className="w-12" />
      </div>
    </header>
  );
}

export function BuggleGame() {
  const { username, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const joinCodeFromUrl = searchParams.get("join");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roundResult, setRoundResult] = useState<RoundEndedPayload | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<WordResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pendingAutoJoin, setPendingAutoJoin] = useState(!!joinCodeFromUrl);
  const socketRef = useRef(getBuggleSocket());

  useEffect(() => {
    const socket = socketRef.current;

    function handleRoomUpdated(state: RoomState) {
      setRoom(state);
      if (state.phase === "playing") setRoundResult(null);
    }
    function handleJoinError(data: { message: string }) {
      setJoinError(data.message);
    }
    function handleWordResult(data: WordResult) {
      setLastResult(data);
    }
    function handleRoundEnded(data: RoundEndedPayload) {
      setRoundResult(data);
      setRoom(data.room);
    }

    socket.on("room-updated", handleRoomUpdated);
    socket.on("join-error", handleJoinError);
    socket.on("word-result", handleWordResult);
    socket.on("round-ended", handleRoundEnded);

    return () => {
      socket.off("room-updated", handleRoomUpdated);
      socket.off("join-error", handleJoinError);
      socket.off("word-result", handleWordResult);
      socket.off("round-ended", handleRoundEnded);
    };
  }, []);

  useEffect(() => {
    if (!room || room.phase !== "playing" || !room.roundEndsAt) return;
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((room.roundEndsAt! - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(interval);
  }, [room]);

  useEffect(() => {
    if (!joinCodeFromUrl || authLoading || room) return;
    if (username) {
      socketRef.current.emit("join-room", { code: joinCodeFromUrl, name: username });
      setPendingAutoJoin(false);
    }
  }, [joinCodeFromUrl, authLoading, username, room]);

  function handleCreate(name: string, config: RoomConfig) {
    socketRef.current.emit("create-room", { name, config });
  }

  function handleJoinWithName(name: string) {
    if (joinCodeFromUrl) {
      socketRef.current.emit("join-room", { code: joinCodeFromUrl, name });
      setPendingAutoJoin(false);
    }
  }

  function handleJoin(name: string, code: string) {
    setJoinError(null);
    socketRef.current.emit("join-room", { code, name });
  }

  function handleStart() {
    if (room) socketRef.current.emit("start-round", { code: room.code });
  }

  function handleToggleSpectator(isSpectator: boolean) {
    if (room) socketRef.current.emit("set-spectator", { code: room.code, isSpectator });
  }

  function handleUpdateConfig(config: RoomConfig) {
    if (room) socketRef.current.emit("update-config", { code: room.code, config });
  }

  function handleTransferHost(newHostSocketId: string) {
    if (room) socketRef.current.emit("transfer-host", { code: room.code, newHostSocketId });
  }

  function handleWordSubmit(word: string) {
    if (room) socketRef.current.emit("submit-word", { code: room.code, word });
  }

  function handleLeaveRoom() {
    if (room) socketRef.current.emit("leave-room", { code: room.code });
    setRoom(null);
    setRoundResult(null);
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
        <GameHeader />
        <Lobby
          defaultName={username ?? ""}
          isNameLocked={!!username}
          onCreate={handleCreate}
          onJoin={handleJoin}
          joinError={joinError}
        />
      </>
    );
  }

  if (roundResult) {
    return (
      <>
        <GameHeader onLeaveRoom={handleLeaveRoom} />
        <ResultsScreen
          result={roundResult}
          isHost={room.hostSocketId === socketRef.current.id}
          onPlayAgain={handleStart}
        />
      </>
    );
  }

  if (room.phase === "lobby") {
    return (
      <RoomWaiting
        room={room}
        mySocketId={socketRef.current.id ?? ""}
        onStart={handleStart}
        onToggleSpectator={handleToggleSpectator}
        onLeaveRoom={handleLeaveRoom}
        onUpdateConfig={handleUpdateConfig}
        onTransferHost={handleTransferHost}
      />
    );
  }

  const me = room.players.find((p) => p.socketId === socketRef.current.id);
  if (me?.isSpectator) {
    return (
      <>
      <GameHeader onLeaveRoom={handleLeaveRoom} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-lg font-bold text-[var(--fg)]">Modo TV — so exibindo</p>
        <div className="flex w-full max-w-md items-center justify-between rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2">
          <span className="font-mono text-2xl font-extrabold text-[var(--primary)]">{secondsLeft}s</span>
          <div className="flex gap-3 text-sm font-bold text-[var(--fg)]">
            {room.players
              .filter((p) => !p.isSpectator)
              .map((p) => (
                <span key={p.socketId}>
                  {p.name}: {p.score}
                </span>
              ))}
          </div>
        </div>
        {room.board && <Board board={room.board} onWordSubmit={() => {}} />}
      </div>
      </>
    );
  }

  return (
    <>
      <GameHeader onLeaveRoom={handleLeaveRoom} />
      {room.board && (
        <GamePlayScreen
          board={room.board}
          players={room.players}
          secondsLeft={secondsLeft}
          totalSeconds={room.config.roundSeconds}
          lastResult={lastResult}
          onWordSubmit={handleWordSubmit}
        />
      )}
    </>
  );
}
