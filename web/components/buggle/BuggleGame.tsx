"use client";

import { useEffect, useRef, useState } from "react";
import { GameHeader } from "@/components/GameHeader";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { useSearchParams } from "next/navigation";
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
import { SoundToggle } from "./SoundToggle";
import { initBuggleSound, playBuggleSfx } from "@/lib/buggle/sound";
import { logActivity } from "@/lib/activity";
import { setStatus } from "@/lib/social/presence";
import type { BoggleCell, CoinsAwarded, RoomConfig, RoomState, RoundEndedPayload, WordResult } from "@/lib/buggle/types";


export function BuggleGame() {
  const { username, loading: authLoading, equippedAvatar, session } = useAuth();
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
  const [coins, setCoins] = useState<CoinsAwarded | null>(null);
  const prevPhase = useRef<RoomState["phase"] | null>(null);
  const prevWordsFound = useRef(0);
  const lastTickSecond = useRef<number | null>(null);
  const socketRef = useRef(getBuggleSocket());

  useEffect(() => {
    initBuggleSound();
  }, []);

  useEffect(() => {
    const socket = socketRef.current;

    function handleRoomUpdated(state: RoomState) {
      // na TV, um "plim" baixinho cada vez que alguem acha uma palavra nova
      const totalFound = state.players.reduce((sum, p) => sum + p.wordsFound, 0);
      if (
        state.phase === "playing" &&
        state.ownerSocketId === socket.id &&
        totalFound > prevWordsFound.current
      ) {
        playBuggleSfx("otherCorrect");
      }
      prevWordsFound.current = totalFound;
      setRoom(state);
      if (state.phase === "playing") {
        setRoundResult(null);
        setCoins(null);
      }
    }
    function handleJoinError(data: { message: string }) {
      setJoinError(data.message);
    }
    function handleWordResult(data: WordResult) {
      setLastResult(data);
      if (data.accepted) playBuggleSfx(data.isSecret ? "secret" : "correct", data.word.length);
      else playBuggleSfx(data.alreadyFound ? "already" : "wrong");
    }
    function handleRoundEnded(data: RoundEndedPayload) {
      playBuggleSfx("roundEnd");
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
    function handleCoinsAwarded(data: CoinsAwarded) {
      setCoins(data);
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
    socket.on("coins-awarded", handleCoinsAwarded);

    return () => {
      socket.off("room-updated", handleRoomUpdated);
      socket.off("join-error", handleJoinError);
      socket.off("word-result", handleWordResult);
      socket.off("round-ended", handleRoundEnded);
      socket.off("room-closed", handleRoomClosed);
      socket.off("results-speed-changed", handleResultsSpeedChanged);
      socket.off("results-reveal-done", handleResultsRevealDone);
      socket.off("coins-awarded", handleCoinsAwarded);
    };
  }, []);

  // identifica a conta pro servidor (moedas e "Adicionar"); ele valida o token, nunca confia no cliente
  const accessToken = session?.access_token ?? null;
  useEffect(() => {
    if (authLoading) return;
    const socket = socketRef.current;
    const identify = () => socket.emit("identify", { accessToken });
    if (socket.connected) identify();
    socket.on("connect", identify);
    return () => {
      socket.off("connect", identify);
    };
  }, [authLoading, accessToken]);

  // status pros amigos (sala de espera / partida) e medicao de retencao
  const roomCode = room?.code ?? null;
  const phase = room?.phase ?? null;
  const playerCount = room?.players.length ?? 0;
  const maxPlayers = room?.config.maxPlayers ?? 0;
  const ownerSocketId = room?.ownerSocketId ?? null;
  useEffect(() => {
    if (!roomCode) {
      // saiu da sala ou ela fechou: o "Entrar" dos amigos nao pode apontar pra sala morta
      setStatus({ state: "online", place: "hub", game: "buggle" });
      return;
    }
    const playing = phase === "playing";
    setStatus({
      state: playing ? "playing" : "online",
      place: playing ? "match" : "lobby",
      game: "buggle",
      roomCode,
      players: playerCount,
      maxPlayers,
    });
  }, [roomCode, phase, playerCount, maxPlayers]);

  useEffect(() => {
    // a TV nao joga: so conta quem esta no celular
    if (phase === "playing" && ownerSocketId !== socketRef.current.id) void logActivity("buggle");
  }, [phase, ownerSocketId]);

  useEffect(() => {
    if (!room || room.phase !== "playing" || !room.roundEndsAt) return;
    const interval = setInterval(() => {
      const s = Math.max(0, Math.ceil((room.roundEndsAt! - Date.now()) / 1000));
      setSecondsLeft(s);
      // alarme ao chegar nos 10s, depois tique a cada segundo ate acabar
      if (lastTickSecond.current !== s) {
        lastTickSecond.current = s;
        if (s === 10) playBuggleSfx("warning");
        else if (s > 0 && s < 10) playBuggleSfx("tick", s);
      }
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
    playBuggleSfx(countdown > 0 ? "countdown" : "go");
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
    setLobbyMode("choose");
  }

  // confirmacao ao sair da sala (botoes, Hub, voltar do navegador, fechar aba)
  const leaveRole = !room
    ? null
    : room.ownerSocketId === socketRef.current.id
      ? "owner"
      : room.hostSocketId === socketRef.current.id
        ? "host"
        : "player";
  const inWaiting = room?.phase === "lobby" && !roundResult;
  const leaveText =
    leaveRole === "owner"
      ? {
          title: "Fechar a sala?",
          message: "Você é o dono da sala. Se sair, a sala será fechada para todos os jogadores.",
          confirmLabel: "Fechar sala",
        }
      : leaveRole === "host" && !inWaiting
        ? {
            title: "Sair da rodada?",
            message: "Você é o anfitrião. Se sair, o cargo passa para outro jogador e você perde a partida em andamento.",
            confirmLabel: "Sair",
          }
        : leaveRole === "host"
          ? {
              title: "Sair da sala?",
              message: "Você é o anfitrião. Se sair, o cargo passa para outro jogador.",
              confirmLabel: "Sair",
            }
          : inWaiting
            ? { title: "Sair da sala?", message: "Você volta para a tela inicial do Buggle.", confirmLabel: "Sair" }
            : {
                title: "Sair da rodada?",
                message: "Você sai da partida em andamento e perde sua pontuação nesta rodada.",
                confirmLabel: "Sair",
              };
  const { requestLeave, leaveDialog } = useLeaveGuard({
    active: !!room,
    onLeave: handleLeaveRoom,
    ...leaveText,
  });

  if (!room && joinCodeFromUrl && pendingAutoJoin) {
    if (authLoading) {
      return (
        <>
          <GameHeader slug="buggle" actions={<SoundToggle />} />
          <div className="flex flex-1 items-center justify-center">
            <p className="font-semibold text-[var(--fg-muted)]">Carregando...</p>
          </div>
        </>
      );
    }
    if (!username) {
      return (
        <>
          <GameHeader slug="buggle" actions={<SoundToggle />} />
          <JoinNameModal onConfirm={handleJoinWithName} joinError={joinError} />
        </>
      );
    }
  }

  if (!room) {
    return (
      <>
        {lobbyMode !== "create" && <GameHeader slug="buggle" actions={<SoundToggle />} />}
        {roomClosed && (
          <p className="mt-4 text-center text-sm font-bold text-[var(--danger)]">
            A sala foi encerrada (o anfitrião/TV saiu).
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
        <GameHeader
          slug="buggle"
          actions={<SoundToggle />}
          onLeaveRoom={() => requestLeave("room")}
          onHubClick={() => requestLeave("hub")}
        />
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
            config={room.config}
            playerCount={room.players.length}
            onUpdateConfig={handleUpdateConfig}
            coins={coins}
            players={room.players}
          />
        )}
        {leaveDialog}
      </>
    );
  }

  if (room.phase === "lobby") {
    return (
      <>
      <RoomWaiting
        room={room}
        mySocketId={socketRef.current.id ?? ""}
        onStart={handleStart}
        onLeaveRoom={() => requestLeave("room")}
        onUpdateConfig={handleUpdateConfig}
        onTransferHost={handleTransferHost}
        onRenamePlayer={handleRenamePlayer}
        onUpdateAvatar={handleUpdateAvatar}
      />
      {leaveDialog}
      </>
    );
  }

  const isOwner = room.ownerSocketId === socketRef.current.id;
  if (isOwner) {
    return (
      <>
        <GameHeader
          slug="buggle"
          actions={<SoundToggle />}
          onLeaveRoom={() => requestLeave("room")}
          onHubClick={() => requestLeave("hub")}
        />
        <OwnerGameScreen room={room} secondsLeft={secondsLeft} countdown={countdown} />
        {leaveDialog}
      </>
    );
  }

  if (countdown !== null) {
    return (
      <>
        <RoundCountdown countdown={countdown} />
        {leaveDialog}
      </>
    );
  }

  return (
    room.board && (
      <>
        <GamePlayScreen
          board={room.board}
          secondsLeft={secondsLeft}
          totalSeconds={room.config.roundSeconds}
          lastResult={lastResult}
          onWordSubmit={handleWordSubmit}
          onLeaveRoom={() => requestLeave("room")}
        />
        {leaveDialog}
      </>
    )
  );
}
