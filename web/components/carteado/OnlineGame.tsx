"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameHeader } from "@/components/GameHeader";
import { RoundCountdown } from "@/components/buggle/RoundCountdown";
import { JoinNameModal } from "@/components/draw/JoinNameModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { useLocalFlag } from "@/lib/race/useLocalFlag";
import { getCarteadoSocket } from "@/lib/carteado/socket";
import { describeEvent, type EventTone } from "@/lib/carteado/cards";
import type { CardColor } from "@/lib/carteado/engine";
import type { CarteadoRoomConfig, CarteadoRoomState, PlayerAvatar } from "@/lib/carteado/types";
import { MatchView } from "./MatchView";
import { CarteadoTutorial } from "./CarteadoTutorial";
import { Lobby } from "./Lobby";
import { OnlineResults } from "./OnlineResults";
import { RoomWaiting } from "./RoomWaiting";

// ultimo 0.8s do countdown do servidor e' o "VAI!"
const GO_MS = 800;
const TOAST_MS = 1800;
const TUTORIAL_KEY = "carteadoTutorialSeen";

type Toast = { text: string; tone: EventTone; seq: number };

export function OnlineGame({ joinCode, onPractice }: { joinCode: string | null; onPractice: () => void }) {
  const { username, loading: authLoading, equippedAvatar, session } = useAuth();
  const [socket] = useState(getCarteadoSocket);
  // comeca desconectado nos dois lados (SSR e client) pra nao dar hydration mismatch
  const [connected, setConnected] = useState(false);
  const [mySocketId, setMySocketId] = useState("");
  const [room, setRoom] = useState<CarteadoRoomState | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAutoJoin, setPendingAutoJoin] = useState(!!joinCode);
  const [pendingAction, setPendingAction] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fresh, setFresh] = useState<{ mine: boolean; index: number } | null>(null);
  const [now, setNow] = useState(0);
  const [lobbyMode, setLobbyMode] = useState<"choose" | "create" | "join">("choose");
  const [tutorialSeen, setTutorialSeen] = useLocalFlag(TUTORIAL_KEY, true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // diferenca relogio do servidor - relogio local; so pra exibir tempo, nunca decide nada
  const clockOffsetRef = useRef(0);
  const hasRoomRef = useRef(false);
  const autoJoinSentRef = useRef(false);
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
    const timers = timersRef;
    function handleRoomUpdated(state: CarteadoRoomState) {
      clockOffsetRef.current = state.serverNow - Date.now();
      setNow(state.serverNow);
      setPendingAction(false);
      const ev = state.lastEvent;
      if (ev && ev.seq > lastEventSeqRef.current) {
        lastEventSeqRef.current = ev.seq;
        const me = socket.id ?? "";
        const name = state.seats.find((s) => s.socketId === ev.by)?.name ?? "Alguém";
        const t = describeEvent(ev, state.table?.lastCard ?? null, ev.by === me, name);
        if (t) {
          setToast({ ...t, seq: ev.seq });
          later(() => setToast((cur) => (cur?.seq === ev.seq ? null : cur)), TOAST_MS);
        }
        const card = state.table?.lastCard;
        if (ev.kind === "fill" && card?.kind === "number") setFresh({ mine: ev.by === me, index: card.value - 1 });
      }
      if (!ev) {
        lastEventSeqRef.current = 0;
        setFresh(null);
      }
      hasRoomRef.current = true;
      setPendingAutoJoin(false);
      setRoom(state);
    }
    function handleRejected() {
      setPendingAction(false);
    }
    function handleJoinError(data: { message: string }) {
      setJoinError(data.message);
      if (autoJoinSentRef.current) setPendingAutoJoin(false);
    }
    function handleRoomClosed() {
      hasRoomRef.current = false;
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
      setRoom(null);
    }

    socket.on("room-updated", handleRoomUpdated);
    socket.on("action-rejected", handleRejected);
    socket.on("join-error", handleJoinError);
    socket.on("room-closed", handleRoomClosed);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    if (socket.connected) handleConnect();
    else socket.connect();
    return () => {
      socket.off("room-updated", handleRoomUpdated);
      socket.off("action-rejected", handleRejected);
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
  useEffect(() => {
    if (phase !== "countdown" && phase !== "playing") return;
    const id = window.setInterval(() => setNow(Date.now() + clockOffsetRef.current), 200);
    return () => window.clearInterval(id);
  }, [phase]);

  const currentAvatar = useCallback(
    (): PlayerAvatar | null =>
      equippedAvatar ? { emoji: equippedAvatar.emoji ?? null, bgColor: equippedAvatar.bg_color ?? null, imageUrl: equippedAvatar.image_url ?? null } : null,
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

  /** varios cliques seguidos viram um envio so: o servidor limita a taxa */
  function debounced(key: string, fn: () => void, ms = 300) {
    window.clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = window.setTimeout(fn, ms);
  }

  function handleCreate(config: CarteadoRoomConfig, name: string) {
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

  function act(event: "flip" | "choose-color", payload?: { color: CardColor }) {
    if (pendingAction) return;
    setPendingAction(true);
    socket.emit(event, payload);
    // seguranca: se a resposta nao vier, destrava a mesa
    later(() => setPendingAction(false), 1500);
  }

  function handleLeaveRoom() {
    socket.emit("leave-room");
    hasRoomRef.current = false;
    setRoom(null);
    setToast(null);
  }

  const amHost = !!room && room.hostSocketId === mySocketId;
  const playing = !!room && room.phase !== "lobby" && room.phase !== "results";
  const { requestLeave, leaveDialog } = useLeaveGuard({
    active: !!room,
    onLeave: handleLeaveRoom,
    title: playing ? "Abandonar o duelo?" : "Sair da sala?",
    message: playing
      ? "Se sair agora, o adversário vence."
      : amHost && room?.phase === "lobby"
        ? "Você vai sair da sala. O cargo de anfitrião passa para o outro jogador."
        : "Você vai sair da sala.",
    confirmLabel: "Sair",
  });

  const header = <GameHeader slug="carteado" onLeaveRoom={room ? () => requestLeave("room") : undefined} onHubClick={room ? () => requestLeave("hub") : undefined} />;

  function closeTutorial() {
    setTutorialSeen(true);
    setTutorialOpen(false);
  }
  // primeira visita abre sozinho; depois so pelo "Como jogar"
  const showTutorial = tutorialOpen || (!tutorialSeen && (!room || room.phase === "lobby"));
  const tutorial = showTutorial ? <CarteadoTutorial onClose={closeTutorial} /> : null;

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
        {lobbyMode !== "create" && header}
        {notice && lobbyMode === "choose" && <p className="mt-4 text-center text-sm font-bold text-[var(--danger)]">{notice}</p>}
        <Lobby
          defaultName={username ?? ""}
          isNameLocked={!!username}
          connected={connected}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onPractice={onPractice}
          joinError={joinError}
          onModeChange={setLobbyMode}
          onHowToPlay={() => setTutorialOpen(true)}
        />
        {tutorial}
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
        {tutorial}
        {leaveDialog}
      </>
    );
  }

  if (room.phase === "results") {
    return (
      <>
        {header}
        <OnlineResults room={room} mySocketId={mySocketId} onPlayAgain={() => socket.emit("restart-game")} onLeave={() => requestLeave("room")} />
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

  const table = room.table;
  const meSeat = room.seats.find((s) => s.socketId === mySocketId);
  const oppSeat = room.seats.find((s) => s.socketId !== mySocketId);
  if (!table || !meSeat || !oppSeat) return null;

  const myTurn = room.turnSocketId === mySocketId;
  const locked = now < room.lockedUntil;
  const msLeft = room.phaseEndsAt ? Math.max(0, room.phaseEndsAt - Math.max(now, room.lockedUntil)) : null;
  const totalMs = room.config.turnSeconds * 1000;
  const finished = !!room.winnerSocketId;

  let status: string;
  if (finished) status = room.winnerSocketId === mySocketId ? "Você completou!" : `${oppSeat.name} completou!`;
  else if (myTurn) status = table.pendingWild ? "Escolha a cor" : "Sua vez!";
  else status = table.pendingWild ? `${oppSeat.name} escolhe a cor` : `Vez de ${oppSeat.name}`;

  return (
    <>
      <MatchView
        me={meSeat}
        opp={oppSeat}
        myTurn={myTurn}
        canFlip={myTurn && !locked && !table.pendingWild && !pendingAction}
        choosingColor={myTurn && table.pendingWild && !locked && !pendingAction}
        lastCard={table.lastCard}
        flipKey={table.flips}
        drawCount={table.drawCount}
        fresh={fresh}
        status={status}
        toast={toast}
        secondsLeft={msLeft === null || finished ? null : Math.ceil(msLeft / 1000)}
        timerFraction={msLeft !== null && totalMs > 0 && !finished ? msLeft / totalMs : null}
        onFlip={() => act("flip")}
        onChoose={(color) => act("choose-color", { color })}
        onLeave={() => requestLeave("room")}
      />
      {leaveDialog}
    </>
  );
}
