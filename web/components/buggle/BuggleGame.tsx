"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { getBuggleSocket } from "@/lib/buggle/socket";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Lobby } from "./Lobby";
import { RoomWaiting } from "./RoomWaiting";
import { GamePlayScreen } from "./GamePlayScreen";
import { OwnerGameScreen } from "./OwnerGameScreen";
import { RoundCountdown } from "./RoundCountdown";
import { ResultsScreen } from "./ResultsScreen";
import { MobileResultsScreen } from "./MobileResultsScreen";
import { JoinNameModal } from "./JoinNameModal";
import type { BoggleCell, RoomConfig, RoomState, RoundEndedPayload, WordResult } from "@/lib/buggle/types";

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
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-extrabold text-white">
            abc
          </span>
          Buggle
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

export function BuggleGame() {
  const { username, loading: authLoading, equippedAvatar } = useAuth();
  const searchParams = useSearchParams();
  const joinCodeFromUrl = searchParams.get("join");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roundResult, setRoundResult] = useState<RoundEndedPayload | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<WordResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pendingAutoJoin, setPendingAutoJoin] = useState(!!joinCodeFromUrl);
  const [lobbyMode, setLobbyMode] = useState<"choose" | "create" | "join">("choose");
  const [roomClosed, setRoomClosed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resultsFast, setResultsFast] = useState(false);
  const [resultsRevealDone, setResultsRevealDone] = useState(false);
  const prevPhase = useRef<RoomState["phase"] | null>(null);
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
      setResultsFast(false);
      setResultsRevealDone(false);
    }
    function handleResultsSpeedChanged(data: { fast: boolean }) {
      setResultsFast(data.fast);
    }
    function handleResultsRevealDone() {
      setResultsRevealDone(true);
    }
    function handleRoomClosed() {
      setRoom(null);
      setRoundResult(null);
      setRoomClosed(true);
    }

    socket.on("room-updated", handleRoomUpdated);
    socket.on("join-error", handleJoinError);
    socket.on("word-result", handleWordResult);
    socket.on("round-ended", handleRoundEnded);
    socket.on("room-closed", handleRoomClosed);
    socket.on("results-speed-changed", handleResultsSpeedChanged);
    socket.on("results-reveal-done", handleResultsRevealDone);

    return () => {
      socket.off("room-updated", handleRoomUpdated);
      socket.off("join-error", handleJoinError);
      socket.off("word-result", handleWordResult);
      socket.off("round-ended", handleRoundEnded);
      socket.off("room-closed", handleRoomClosed);
      socket.off("results-speed-changed", handleResultsSpeedChanged);
    };
  }, []);

  useEffect(() => {
    if (!room || room.phase !== "playing" || !room.roundEndsAt) return;
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((room.roundEndsAt! - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(interval);
  }, [room]);

  // countdown 3-2-1 (TV e celulares dos jogadores) quando a rodada comeca
  useEffect(() => {
    if (!room) {
      prevPhase.current = null;
      return;
    }
    if (prevPhase.current !== "playing" && room.phase === "playing") {
      setCountdown(3);
    }
    prevPhase.current = room.phase;
  }, [room]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const t = setTimeout(() => setCountdown(null), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 800);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (!joinCodeFromUrl || authLoading || room) return;
    if (username) {
      socketRef.current.emit("join-room", { code: joinCodeFromUrl, name: username });
      setPendingAutoJoin(false);
    }
  }, [joinCodeFromUrl, authLoading, username, room]);

  function currentAvatar() {
    return {
      emoji: equippedAvatar?.emoji ?? null,
      bgColor: equippedAvatar?.bg_color ?? null,
      imageUrl: equippedAvatar?.image_url ?? null,
    };
  }

  function handleCreate(config: RoomConfig) {
    setRoomClosed(false);
    socketRef.current.emit("create-room", { config });
  }

  function handleJoinWithName(name: string) {
    if (joinCodeFromUrl) {
      socketRef.current.emit("join-room", { code: joinCodeFromUrl, name, avatar: currentAvatar() });
      setPendingAutoJoin(false);
    }
  }

  function handleJoin(name: string, code: string) {
    setJoinError(null);
    setRoomClosed(false);
    socketRef.current.emit("join-room", { code, name, avatar: currentAvatar() });
  }

  function handleStart() {
    if (room) socketRef.current.emit("start-round", { code: room.code });
  }

  function handleUpdateConfig(config: RoomConfig) {
    if (room) socketRef.current.emit("update-config", { code: room.code, config });
  }

  function handleTransferHost(newHostSocketId: string) {
    if (room) socketRef.current.emit("transfer-host", { code: room.code, newHostSocketId });
  }

  function handleRenamePlayer(name: string) {
    if (room) socketRef.current.emit("rename-player", { code: room.code, name });
  }

  function handleUpdateAvatar(avatar: { emoji: string | null; bgColor: string | null; imageUrl: string | null }) {
    if (room) socketRef.current.emit("update-avatar", { code: room.code, avatar });
  }

  function handleChangeResultsSpeed(fast: boolean) {
    setResultsFast(fast);
    if (room) socketRef.current.emit("set-results-speed", { code: room.code, fast });
  }

  function handleWordSubmit(word: string, path: BoggleCell[]) {
    if (room) socketRef.current.emit("submit-word", { code: room.code, word, path });
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
        {lobbyMode !== "create" && <GameHeader />}
        {roomClosed && (
          <p className="mt-4 text-center text-sm font-bold text-[var(--danger)]">
            A sala foi encerrada (o anfitriao/TV saiu).
          </p>
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

  if (roundResult) {
    const amOwner = room.ownerSocketId === socketRef.current.id;
    const amHost = room.hostSocketId === socketRef.current.id;
    return (
      <>
        <GameHeader onLeaveRoom={handleLeaveRoom} />
        {amOwner ? (
          <ResultsScreen
            result={roundResult}
            fast={resultsFast}
            onRevealComplete={() => {
              setResultsRevealDone(true);
              socketRef.current.emit("results-reveal-done", { code: room.code });
            }}
          />
        ) : (
          <MobileResultsScreen
            isHost={amHost}
            fast={resultsFast}
            onChangeFast={handleChangeResultsSpeed}
            revealDone={resultsRevealDone}
            onPlayAgain={handleStart}
          />
        )}
      </>
    );
  }

  if (room.phase === "lobby") {
    return (
      <RoomWaiting
        room={room}
        mySocketId={socketRef.current.id ?? ""}
        onStart={handleStart}
        onLeaveRoom={handleLeaveRoom}
        onUpdateConfig={handleUpdateConfig}
        onTransferHost={handleTransferHost}
        onRenamePlayer={handleRenamePlayer}
        onUpdateAvatar={handleUpdateAvatar}
      />
    );
  }

  const isOwner = room.ownerSocketId === socketRef.current.id;
  if (isOwner) {
    return (
      <>
        <GameHeader onLeaveRoom={handleLeaveRoom} />
        <OwnerGameScreen room={room} secondsLeft={secondsLeft} countdown={countdown} />
      </>
    );
  }

  if (countdown !== null) {
    return <RoundCountdown countdown={countdown} />;
  }

  return (
    room.board && (
      <GamePlayScreen
        board={room.board}
        secondsLeft={secondsLeft}
        totalSeconds={room.config.roundSeconds}
        lastResult={lastResult}
        onWordSubmit={handleWordSubmit}
        onLeaveRoom={handleLeaveRoom}
      />
    )
  );
}
