"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameHeader } from "@/components/GameHeader";
import { RoundCountdown } from "@/components/buggle/RoundCountdown";
import { JoinNameModal } from "@/components/draw/JoinNameModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { logActivity } from "@/lib/activity";
import { setStatus } from "@/lib/social/presence";
import { getCofreSocket } from "@/lib/cofre/socket";
import { initCofreSound, playSfx } from "@/lib/cofre/sound";
import { onlineCues, type CueSnapshot } from "@/lib/cofre/soundCues";
import type { CoinsAwarded, CofreRoomConfig, CofreRoomState, PlayerAvatar } from "@/lib/cofre/types";
import { OnlineLobby } from "./OnlineLobby";
import { OnlineMatch } from "./OnlineMatch";
import { OnlineResults } from "./OnlineResults";
import { RoomWaiting } from "./RoomWaiting";

// ultimo 0.8s do countdown do servidor e' o "VAI!"
const GO_MS = 800;
/** espera a virada de volta (300 ms no CSS) antes de deslizar a troca do tabuleiro movel */
const FLIP_BACK_MS = 320;
const TOAST_MS = 1600;

type Toast = { text: string; tone: "good" | "bad" | "gold"; seq: number };

function cueSnapshot(state: CofreRoomState, mySocketId: string): CueSnapshot {
  return {
    phase: state.phase,
    flippedCount: state.board?.flipped.length ?? 0,
    turnSocketId: state.turnSocketId,
    lastEvent: state.lastEvent,
    swapSeq: state.swap?.seq ?? 0,
    myPlace: state.seats.find((s) => s.socketId === mySocketId)?.place ?? 0,
  };
}

function toastFor(state: CofreRoomState, mySocketId: string): Toast | null {
  const ev = state.lastEvent;
  if (!ev) return null;
  const isMe = ev.by === mySocketId;
  const name = state.seats.find((s) => s.socketId === ev.by)?.name ?? "Alguém";
  if (ev.kind === "match") {
    if (ev.points === 3) return { text: isMe ? "Coringa! +3" : `Coringa! ${name} +3`, tone: "gold", seq: ev.seq };
    return { text: isMe ? "Par! +1" : `${name} +1`, tone: "good", seq: ev.seq };
  }
  if (ev.kind === "timeout") return { text: isMe ? "Tempo esgotado! Perdeu a vez" : `${name} perdeu a vez`, tone: "bad", seq: ev.seq };
  if (ev.kind === "left") return { text: `${name} saiu da partida`, tone: "bad", seq: ev.seq };
  return null;
}

export function OnlineGame({ joinCode, onExit }: { joinCode: string | null; onExit: () => void }) {
  const { username, loading: authLoading, equippedAvatar, session } = useAuth();
  const [socket] = useState(getCofreSocket);
  // comeca desconectado nos dois lados (SSR e client) pra nao dar hydration mismatch
  const [connected, setConnected] = useState(false);
  const [mySocketId, setMySocketId] = useState("");
  const [room, setRoom] = useState<CofreRoomState | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAutoJoin, setPendingAutoJoin] = useState(!!joinCode);
  const [pendingFlip, setPendingFlip] = useState(false);
  const [peek, setPeek] = useState<string[] | null>(null);
  const [swap, setSwap] = useState<{ a: number; b: number; key: number } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [coins, setCoins] = useState<CoinsAwarded | null>(null);
  const [now, setNow] = useState(0);
  // diferenca relogio do servidor - relogio local; so pra exibir tempo, nunca decide nada
  const clockOffsetRef = useRef(0);
  const hasRoomRef = useRef(false);
  const cueRef = useRef<CueSnapshot | null>(null);
  const autoJoinSentRef = useRef(false);
  const lastSwapSeqRef = useRef(0);
  const lastEventSeqRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const debounceRef = useRef<Record<string, number>>({});

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    initCofreSound();
    const timers = timersRef;
    function handleRoomUpdated(state: CofreRoomState) {
      const cue = cueSnapshot(state, socket.id ?? "");
      const sounds = onlineCues(cueRef.current, cue, socket.id ?? "");
      cueRef.current = cue;
      sounds.now.forEach((s) => playSfx(s));
      if (sounds.afterFlipBack.length) later(() => sounds.afterFlipBack.forEach((s) => playSfx(s)), FLIP_BACK_MS);
      clockOffsetRef.current = state.serverNow - Date.now();
      setNow(state.serverNow);
      setPendingFlip(false);
      if (state.phase !== "peek") setPeek(null);
      if (state.phase !== "results") setCoins(null);
      if (state.phase === "lobby") {
        lastSwapSeqRef.current = 0;
        setSwap(null);
      }
      // troca do tabuleiro movel: o estado ja chega trocado, so atrasamos a animacao ate a virada acabar
      const sw = state.swap;
      if (sw && sw.seq > lastSwapSeqRef.current) {
        lastSwapSeqRef.current = sw.seq;
        later(() => setSwap({ a: sw.a, b: sw.b, key: sw.seq }), FLIP_BACK_MS);
      }
      const ev = state.lastEvent;
      if (ev && ev.seq > lastEventSeqRef.current) {
        lastEventSeqRef.current = ev.seq;
        const t = toastFor(state, socket.id ?? "");
        if (t) {
          setToast(t);
          later(() => setToast((cur) => (cur?.seq === t.seq ? null : cur)), TOAST_MS);
        }
      }
      if (!ev) lastEventSeqRef.current = 0;
      hasRoomRef.current = true;
      setPendingAutoJoin(false);
      setRoom(state);
    }
    function handlePeek(data: { faces: string[]; endsAt: number; serverNow: number }) {
      setPeek(data.faces);
      later(() => setPeek(null), Math.max(0, data.endsAt - data.serverNow));
    }
    function handleCoinsAwarded(data: CoinsAwarded) {
      setCoins(data);
    }
    function handleFlipRejected() {
      setPendingFlip(false);
    }
    function handleJoinError(data: { message: string }) {
      setJoinError(data.message);
      if (autoJoinSentRef.current) setPendingAutoJoin(false);
    }
    function handleRoomClosed() {
      hasRoomRef.current = false;
      cueRef.current = null;
      setRoom(null);
      setNotice("A sala foi encerrada.");
    }
    function handleConnect() {
      setConnected(true);
      setMySocketId(socket.id ?? "");
    }
    function handleDisconnect() {
      setConnected(false);
      // sem reconexao: o servidor ja removeu a gente da sala
      if (hasRoomRef.current) setNotice("Conexão perdida. Você saiu da sala.");
      hasRoomRef.current = false;
      cueRef.current = null;
      setRoom(null);
    }

    socket.on("room-updated", handleRoomUpdated);
    socket.on("peek", handlePeek);
    socket.on("flip-rejected", handleFlipRejected);
    socket.on("coins-awarded", handleCoinsAwarded);
    socket.on("join-error", handleJoinError);
    socket.on("room-closed", handleRoomClosed);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    if (socket.connected) handleConnect();
    else socket.connect();
    return () => {
      socket.off("room-updated", handleRoomUpdated);
      socket.off("peek", handlePeek);
      socket.off("flip-rejected", handleFlipRejected);
      socket.off("coins-awarded", handleCoinsAwarded);
      socket.off("join-error", handleJoinError);
      socket.off("room-closed", handleRoomClosed);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [socket, later]);

  // identifica a conta pro servidor; ele valida o token, nunca confia no cliente
  const accessToken = session?.access_token ?? null;
  useEffect(() => {
    if (!connected || authLoading) return;
    socket.emit("identify", { accessToken });
  }, [connected, authLoading, accessToken, socket]);

  // sair da tela = sair da sala
  useEffect(() => {
    return () => {
      socket.emit("leave-room");
    };
  }, [socket]);

  const phase = room?.phase;
  const roomCode = room?.code ?? null;
  const playerCount = room?.lobby.length ?? 0;
  const maxPlayers = room?.config.maxPlayers ?? 0;
  useEffect(() => {
    if (!roomCode) {
      // saiu da sala ou ela fechou: o "Entrar" dos amigos nao pode apontar pra sala morta
      setStatus({ state: "online", place: "hub", game: "cofre" });
      return;
    }
    const playing = phase === "countdown" || phase === "peek" || phase === "playing";
    setStatus({
      state: playing ? "playing" : "online",
      place: playing ? "match" : "lobby",
      game: "cofre",
      roomCode,
      players: playerCount,
      maxPlayers,
    });
  }, [roomCode, phase, playerCount, maxPlayers]);

  useEffect(() => {
    if (phase === "playing") void logActivity("cofre");
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown" && phase !== "peek" && phase !== "playing") return;
    const id = window.setInterval(() => setNow(Date.now() + clockOffsetRef.current), 200);
    return () => window.clearInterval(id);
  }, [phase]);

  const currentAvatar = useCallback(
    (): PlayerAvatar | null =>
      equippedAvatar
        ? { emoji: equippedAvatar.emoji ?? null, bgColor: equippedAvatar.bg_color ?? null, imageUrl: equippedAvatar.image_url ?? null }
        : null,
    [equippedAvatar]
  );

  useEffect(() => {
    // so a primeira entrada via QR; depois de sair da sala nao reentra sozinho
    if (!pendingAutoJoin || autoJoinSentRef.current || !joinCode || authLoading || room || !connected) return;
    if (username) {
      autoJoinSentRef.current = true;
      socket.emit("join-room", { code: joinCode, name: username, avatar: currentAvatar() });
    }
  }, [pendingAutoJoin, joinCode, authLoading, username, room, connected, currentAvatar, socket]);

  /** varios cliques seguidos (slider, digitar nome) viram um envio so: o servidor limita a taxa */
  function debounced(key: string, fn: () => void, ms = 300) {
    window.clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = window.setTimeout(fn, ms);
  }

  function handleCreate(config: CofreRoomConfig, name: string) {
    setNotice(null);
    socket.emit("create-room", { config, name, avatar: currentAvatar() });
  }

  function handleJoin(name: string, code: string) {
    setJoinError(null);
    setNotice(null);
    socket.emit("join-room", { code, name, avatar: currentAvatar() });
  }

  function handleJoinWithName(name: string) {
    if (!joinCode) return;
    setJoinError(null);
    socket.emit("join-room", { code: joinCode, name, avatar: currentAvatar() });
  }

  function handleFlip(index: number) {
    if (pendingFlip) return;
    setPendingFlip(true);
    socket.emit("flip", { index });
    // seguranca: se a resposta nao vier, destrava o tabuleiro
    later(() => setPendingFlip(false), 1500);
  }

  function handleLeaveRoom() {
    socket.emit("leave-room");
    hasRoomRef.current = false;
    setRoom(null);
    setPeek(null);
    setToast(null);
  }

  const amHost = !!room && room.hostSocketId === mySocketId;
  const playing = !!room && room.phase !== "lobby" && room.phase !== "results";
  const { requestLeave, leaveDialog } = useLeaveGuard({
    active: !!room,
    onLeave: handleLeaveRoom,
    title: playing ? "Abandonar a partida?" : "Sair da sala?",
    message: playing
      ? "Se sair agora, você sai da partida e fica fora da colocação."
      : amHost && room?.phase === "lobby"
        ? "Você vai sair da sala. O cargo de anfitrião passa para outro jogador."
        : "Você vai sair da sala.",
    confirmLabel: "Sair",
  });

  const header = <GameHeader slug="cofre" shortTitle="Cofre" onLeaveRoom={room ? () => requestLeave("room") : undefined} onHubClick={room ? () => requestLeave("hub") : undefined} />;

  if (!room && joinCode && pendingAutoJoin) {
    if (authLoading || !connected) {
      return (
        <>
          {header}
          <div className="flex flex-1 items-center justify-center">
            <p className="font-semibold text-[var(--fg-muted)]">{connected ? "Carregando..." : "Conectando ao servidor..."}</p>
          </div>
        </>
      );
    }
    if (!username) {
      return (
        <>
          {header}
          <JoinNameModal onConfirm={handleJoinWithName} joinError={joinError} />
        </>
      );
    }
  }

  if (!room) {
    return (
      <>
        {header}
        <OnlineLobby
          defaultName={username ?? ""}
          isNameLocked={!!username}
          connected={connected}
          joinError={joinError}
          notice={notice}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onBack={onExit}
        />
      </>
    );
  }

  if (room.phase === "lobby") {
    return (
      <>
        {header}
        <RoomWaiting
          room={room}
          mySocketId={mySocketId}
          onStart={() => socket.emit("start-game")}
          onLeaveRoom={() => requestLeave("room")}
          onUpdateConfig={(config) => {
            // otimista: a tela do anfitriao responde na hora, o servidor confirma em seguida
            setRoom({ ...room, config });
            debounced("config", () => socket.emit("update-config", { config }), 200);
          }}
          onRename={(name) => debounced("rename", () => name.trim() && socket.emit("rename-player", { name }), 350)}
          onUpdateAvatar={(avatar) => socket.emit("update-avatar", { avatar })}
        />
        {leaveDialog}
      </>
    );
  }

  if (room.phase === "results") {
    return (
      <>
        {header}
        <OnlineResults room={room} mySocketId={mySocketId} coins={coins} onPlayAgain={() => socket.emit("restart-game")} onLeave={() => requestLeave("room")} />
        {leaveDialog}
      </>
    );
  }

  if (room.phase === "countdown") {
    const remaining = (room.phaseEndsAt ?? now) - GO_MS - now;
    return (
      <>
        <RoundCountdown countdown={Math.max(0, Math.ceil(remaining / 1000))} />
        {leaveDialog}
      </>
    );
  }

  return (
    <>
      <OnlineMatch
        room={room}
        mySocketId={mySocketId}
        now={now}
        peekFaces={room.phase === "peek" ? peek : null}
        swap={swap}
        toast={toast}
        pendingFlip={pendingFlip}
        onFlip={handleFlip}
        onLeave={() => requestLeave("room")}
      />
      {leaveDialog}
    </>
  );
}
