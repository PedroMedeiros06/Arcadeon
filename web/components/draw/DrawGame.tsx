"use client";

import { useEffect, useRef, useState } from "react";
import { GameHeader } from "@/components/GameHeader";
import { useSearchParams } from "next/navigation";
import { Loader2, Pencil, WifiOff } from "lucide-react";
import { clearDrawSession, getDrawSocket, loadDrawSession, saveDrawSession } from "@/lib/draw/socket";
import { initDrawSound, playDrawSfx } from "@/lib/draw/sound";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Lobby } from "./Lobby";
import { RoomWaiting } from "./RoomWaiting";
import { WordPicker, PickCountdown } from "./WordPicker";
import { GameScreen, type Celebration } from "./GameScreen";
import { ImpostorScreen } from "./ImpostorScreen";
import { ModifierBadge } from "./ModifierBadge";
import { ResultsScreen } from "./ResultsScreen";
import { JoinNameModal } from "./JoinNameModal";
import { SoundToggle } from "./SoundToggle";
import { DrawTutorial } from "./DrawTutorial";
import { useLocalFlag } from "@/lib/race/useLocalFlag";
import type {
  CanvasHandlers,
  DrawEvent,
  DrawRoomConfig,
  DrawRoomState,
  DrawSession,
  FeedItem,
  FillEvent,
  GalleryDrawing,
  GuessResult,
  Point,
  ShapeEvent,
  Team,
  TurnEndedPayload,
} from "@/lib/draw/types";
import { TEAM_INFO } from "@/lib/draw/modes";

const TUTORIAL_KEY = "drawTutorialSeen";

let feedSeq = 0;
function feedId(): string {
  feedSeq += 1;
  return `${Date.now()}-${feedSeq}`;
}

type Connection = "online" | "reconnecting";

export function DrawGame() {
  const { username, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const joinCodeFromUrl = searchParams.get("join");
  const [room, setRoom] = useState<DrawRoomState | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [pendingAutoJoin, setPendingAutoJoin] = useState(!!joinCodeFromUrl);
  const [lobbyMode, setLobbyMode] = useState<"choose" | "create" | "join">("choose");
  const [notice, setNotice] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [lastTurn, setLastTurn] = useState<TurnEndedPayload | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [connection, setConnection] = useState<Connection>("online");
  /** true enquanto tenta voltar pra sala guardada (F5): evita piscar o lobby */
  const [resuming, setResuming] = useState(false);
  /** diferenca relogio do servidor - relogio local (celular com hora errada nao quebra o timer) */
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef(getDrawSocket());
  const canvasHandlersRef = useRef<CanvasHandlers | null>(null);
  // eventos que chegaram antes do canvas montar (ex.: canvas-sync logo apos o F5)
  const pendingCanvasRef = useRef<((h: CanvasHandlers) => void)[]>([]);
  const prevRoomRef = useRef<DrawRoomState | null>(null);
  // desenhos da partida atual, capturados localmente no fim de cada turno
  const [gallery, setGallery] = useState<GalleryDrawing[]>([]);
  const [tutorialSeen, setTutorialSeen] = useLocalFlag(TUTORIAL_KEY, true);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    initDrawSound();
  }, []);

  // confete some sozinho
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 1800);
    return () => clearTimeout(t);
  }, [celebration]);

  useEffect(() => {
    const socket = socketRef.current;

    function pushFeed(item: Omit<FeedItem, "id">) {
      setFeed((prev) => [...prev.slice(-60), { ...item, id: feedId() }]);
    }

    function withCanvas(fn: (h: CanvasHandlers) => void) {
      if (canvasHandlersRef.current) fn(canvasHandlersRef.current);
      else pendingCanvasRef.current.push(fn);
    }

    function dropRoom(message: string | null) {
      clearDrawSession();
      prevRoomRef.current = null;
      pendingCanvasRef.current = [];
      setRoom(null);
      setGallery([]);
      setFeed([]);
      setLastTurn(null);
      setNotice(message);
    }

    /** Volta pra sala guardada (F5, queda). Sem sessao guardada nao faz nada. */
    function tryResume() {
      const saved = loadDrawSession();
      if (!saved) {
        setResuming(false);
        return;
      }
      setResuming(true);
      socket.emit("resume", saved, (res: { ok: boolean } | undefined) => {
        setResuming(false);
        if (res?.ok) return;
        const hadRoom = prevRoomRef.current !== null;
        dropRoom(hadRoom ? "Você ficou desconectado por muito tempo e saiu da sala." : null);
      });
    }

    function handleConnect() {
      setConnection("online");
      tryResume();
    }
    function handleDisconnect() {
      setConnection("reconnecting");
    }
    function handleSession(session: DrawSession) {
      saveDrawSession(session);
    }
    function handleSessionLost() {
      // servidor nao reconhece este socket (reiniciou, ou a sessao expirou): tenta retomar
      tryResume();
    }

    function handleRoomUpdated(state: DrawRoomState) {
      const prev = prevRoomRef.current;
      prevRoomRef.current = state;
      setRoom(state);
      setNotice(null);
      setJoinError(null);
      setClockOffset(state.serverNow - Date.now());
      if (state.phase !== "lobby") setStartError(null);

      const me = state.myId;
      const phaseChanged = prev?.phase !== state.phase;
      if (state.phase === "lobby" && prev?.phase === "lobby" && state.players.length > prev.players.length) {
        playDrawSfx("join");
      }
      if (phaseChanged && state.phase === "picking-word") {
        setFeed([]);
        setLastTurn(null);
        pendingCanvasRef.current = [];
        if (state.drawerId === me) playDrawSfx("yourTurn");
      }
      if (phaseChanged && state.phase === "drawing" && prev) playDrawSfx("turnStart");

      // ---------- artista impostor ----------
      const round = state.impostor;
      if (state.phase === "impostor-drawing" && (prev?.phase !== "impostor-drawing" || prev.round !== state.round)) {
        // rodada nova: canvas novo (a tela e remontada pela rodada) e chat limpo
        setFeed([]);
        pendingCanvasRef.current = [];
        if (prev) playDrawSfx("turnStart");
      }
      if (round?.strokerId === me && prev?.impostor?.strokerId !== me && state.phase === "impostor-drawing") {
        playDrawSfx("yourTurn");
      }
      if (phaseChanged && state.phase === "impostor-voting") playDrawSfx("turnEnd");
      if (phaseChanged && state.phase === "impostor-reveal" && round) {
        const imageUrl = canvasHandlersRef.current?.snapshot() ?? null;
        if (imageUrl && round.word) {
          const drawing: GalleryDrawing = {
            id: feedId(),
            imageUrl,
            word: round.word,
            drawerName: "todos",
            difficulty: null,
            round: state.round,
          };
          setGallery((prevGallery) => [...prevGallery, drawing]);
        }
        const impostorWon = !round.caught || round.impostorGuessedRight;
        playDrawSfx((round.impostorId === me) === impostorWon ? "win" : "turnEnd");
      }
      if (state.phase === "lobby") {
        setFeed([]);
        // "jogar de novo" (ou sala nova): a galeria e so da partida que acabou
        if (phaseChanged) setGallery([]);
      }
    }
    function handleJoinError(data: { message: string }) {
      setJoinError(data.message);
    }
    function handleDrawEvent(event: DrawEvent) {
      withCanvas((h) => h.applyEvent(event));
    }
    function handleEventUndone(data: { id: string }) {
      withCanvas((h) => h.applyUndo(data.id));
    }
    function handleCanvasSync(data: { events: DrawEvent[]; serverNow?: number }) {
      // estado completo substitui qualquer evento pendente
      pendingCanvasRef.current = [];
      const offset = data.serverNow ? data.serverNow - Date.now() : 0;
      withCanvas((h) => h.load(data.events, offset));
    }
    function handleGuessResult(result: GuessResult) {
      if (result.correct) {
        // so quem acertou ve a palavra que digitou; os outros recebem so "Fulano acertou!"
        pushFeed({
          kind: "own-correct",
          text: result.stole
            ? `Roubou! Era "${result.guess}" +${result.points}`
            : `Você acertou "${result.guess}"! +${result.points}`,
        });
        setCelebration({ key: Date.now(), points: result.points });
        playDrawSfx("correct");
      } else if (result.close) {
        pushFeed({ kind: "close", text: result.guess });
        playDrawSfx("close");
      } else if (!result.alreadyGuessed && !result.tooFast && !result.notYourTurn) {
        pushFeed({ kind: "own-wrong", text: result.guess });
        playDrawSfx("wrong");
      }
    }
    function handlePlayerGuessed(data: { id: string; name: string; stole?: boolean }) {
      if (data.stole) pushFeed({ kind: "steal", name: data.name, text: "roubou o turno!" });
      else pushFeed({ kind: "correct", name: data.name, text: "acertou!" });
      playDrawSfx("otherCorrect");
    }
    function handleChatMessage(data: { id: string; name: string; text: string }) {
      pushFeed({ kind: "chat", name: data.id === prevRoomRef.current?.myId ? "Você" : data.name, text: data.text });
    }
    function handleChatBlocked() {
      pushFeed({ kind: "system", text: "Não vale falar a palavra no chat!" });
      playDrawSfx("wrong");
    }
    function handleStartError(data: { message: string }) {
      setStartError(data.message);
    }
    function handlePlayerGuessAttempt(data: { id: string; name: string; guess: string }) {
      pushFeed({ kind: "wrong", name: data.name, text: data.guess });
    }
    function handleTurnEnded(data: TurnEndedPayload) {
      // "print" do canvas antes do overlay de resumo e da troca de turno
      const imageUrl = canvasHandlersRef.current?.snapshot() ?? null;
      const turnRoom = prevRoomRef.current;
      if (imageUrl && data.word) {
        const drawing: GalleryDrawing = {
          id: feedId(),
          imageUrl,
          word: data.word,
          drawerName:
            data.players.find((p) => p.id === data.drawerId)?.name ??
            turnRoom?.players.find((p) => p.id === data.drawerId)?.name ??
            "?",
          difficulty: data.difficulty,
          round: turnRoom?.round ?? 1,
        };
        setGallery((prev) => [...prev, drawing]);
      }
      setLastTurn(data);
      pushFeed({ kind: "system", text: `A palavra era: ${data.word ?? "?"}` });
      playDrawSfx("turnEnd");
    }
    function handleGameEnded(data: { players: { id: string }[] }) {
      playDrawSfx(data.players[0]?.id === prevRoomRef.current?.myId ? "win" : "gameEnd");
    }

    // aba voltou do segundo plano (celular bloqueado, troca de app): garante estado fresco
    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) socket.connect();
      else if (prevRoomRef.current) socket.emit("sync");
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("session", handleSession);
    socket.on("session-lost", handleSessionLost);
    socket.on("room-updated", handleRoomUpdated);
    socket.on("join-error", handleJoinError);
    socket.on("draw-event", handleDrawEvent);
    socket.on("event-undone", handleEventUndone);
    socket.on("canvas-sync", handleCanvasSync);
    socket.on("guess-result", handleGuessResult);
    socket.on("player-guessed", handlePlayerGuessed);
    socket.on("player-guess-attempt", handlePlayerGuessAttempt);
    socket.on("turn-ended", handleTurnEnded);
    socket.on("game-ended", handleGameEnded);
    socket.on("chat-message", handleChatMessage);
    socket.on("chat-blocked", handleChatBlocked);
    socket.on("start-error", handleStartError);
    document.addEventListener("visibilitychange", handleVisibility);

    if (socket.connected) tryResume();
    else if (!socket.active) socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("session", handleSession);
      socket.off("session-lost", handleSessionLost);
      socket.off("room-updated", handleRoomUpdated);
      socket.off("join-error", handleJoinError);
      socket.off("draw-event", handleDrawEvent);
      socket.off("event-undone", handleEventUndone);
      socket.off("canvas-sync", handleCanvasSync);
      socket.off("guess-result", handleGuessResult);
      socket.off("player-guessed", handlePlayerGuessed);
      socket.off("player-guess-attempt", handlePlayerGuessAttempt);
      socket.off("turn-ended", handleTurnEnded);
      socket.off("game-ended", handleGameEnded);
      socket.off("chat-message", handleChatMessage);
      socket.off("chat-blocked", handleChatBlocked);
      socket.off("start-error", handleStartError);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!joinCodeFromUrl || authLoading || room || resuming) return;
    // ja estava nessa sala antes do F5: a retomada cuida, nao entra de novo como jogador novo
    if (loadDrawSession()?.code === joinCodeFromUrl.toUpperCase()) return;
    if (username) {
      socketRef.current.emit("join-room", { code: joinCodeFromUrl, name: username });
      setPendingAutoJoin(false);
    }
  }, [joinCodeFromUrl, authLoading, username, room, resuming]);

  function emit(event: string, payload?: unknown) {
    socketRef.current.emit(event, payload);
  }

  function handleCreate(config: DrawRoomConfig, name: string) {
    setNotice(null);
    const socket = socketRef.current;
    if (!socket.connected) {
      socket.connect();
      socket.once("connect", () => socket.emit("create-room", { config, name }));
      return;
    }
    socket.emit("create-room", { config, name });
  }

  function handleJoinWithName(name: string) {
    if (joinCodeFromUrl) {
      emit("join-room", { code: joinCodeFromUrl, name });
      setPendingAutoJoin(false);
    }
  }

  function handleJoin(name: string, code: string) {
    setJoinError(null);
    setNotice(null);
    emit("join-room", { code, name });
  }

  function handleChooseWord(word: string) {
    playDrawSfx("pick");
    emit("choose-word", { word });
  }

  function handleLeaveRoom() {
    emit("leave-room");
    clearDrawSession();
    prevRoomRef.current = null;
    pendingCanvasRef.current = [];
    setRoom(null);
    setGallery([]);
  }

  function registerCanvasHandlers(handlers: CanvasHandlers | null) {
    canvasHandlersRef.current = handlers;
    if (!handlers) return;
    const pending = pendingCanvasRef.current;
    pendingCanvasRef.current = [];
    for (const fn of pending) fn(handlers);
  }

  function closeTutorial() {
    setTutorialSeen(true);
    setTutorialOpen(false);
  }

  const reconnectBanner =
    connection === "reconnecting" && room ? (
      <div
        role="status"
        className="animate-fade-up fixed inset-x-0 top-2 z-[60] mx-auto flex w-fit items-center gap-2 rounded-full bg-[var(--danger)] px-4 py-2 text-xs font-extrabold text-white shadow-lg"
      >
        <WifiOff size={14} />
        Conexão perdida, reconectando...
      </div>
    ) : null;

  if (!room && resuming) {
    return (
      <>
        <GameHeader slug="drawit" actions={<SoundToggle />} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          <p className="font-semibold text-[var(--fg-muted)]">Voltando pra sala...</p>
        </div>
      </>
    );
  }

  if (!room && joinCodeFromUrl && pendingAutoJoin) {
    if (authLoading) {
      return (
        <>
          <GameHeader slug="drawit" actions={<SoundToggle />} />
          <div className="flex flex-1 items-center justify-center">
            <p className="font-semibold text-[var(--fg-muted)]">Carregando...</p>
          </div>
        </>
      );
    }
    if (!username) {
      return (
        <>
          <GameHeader slug="drawit" actions={<SoundToggle />} />
          <JoinNameModal onConfirm={handleJoinWithName} joinError={joinError} />
        </>
      );
    }
  }

  // primeira visita abre sozinho (so fora da partida); depois so pelo botao "Como jogar"
  const showTutorial = tutorialOpen || (!tutorialSeen && (!room || room.phase === "lobby"));
  const tutorial = showTutorial ? <DrawTutorial onClose={closeTutorial} /> : null;

  if (!room) {
    return (
      <>
        {lobbyMode !== "create" && <GameHeader slug="drawit" actions={<SoundToggle />} />}
        {notice && <p className="mt-4 px-4 text-center text-sm font-bold text-[var(--danger)]">{notice}</p>}
        <Lobby
          defaultName={username ?? ""}
          isNameLocked={!!username}
          onCreate={handleCreate}
          onJoin={handleJoin}
          joinError={joinError}
          onModeChange={setLobbyMode}
          onHowToPlay={() => setTutorialOpen(true)}
        />
        {tutorial}
      </>
    );
  }

  const myId = room.myId;
  const amHost = room.hostId === myId;

  if (room.phase === "lobby") {
    return (
      <>
        {reconnectBanner}
        <RoomWaiting
          room={room}
          myId={myId}
          onStart={() => {
            setStartError(null);
            emit("start-game");
          }}
          onSetTeam={(playerId: string, team: Team) => emit("set-team", { playerId, team })}
          onShuffleTeams={() => emit("shuffle-teams")}
          startError={startError}
          onLeaveRoom={handleLeaveRoom}
          onUpdateConfig={(config) => emit("update-config", { config })}
          onTransferHost={(newHostId) => emit("transfer-host", { newHostId })}
          onHowToPlay={() => setTutorialOpen(true)}
        />
        {tutorial}
      </>
    );
  }

  if (room.phase === "results") {
    const ranking = room.players
      .map((p) => ({ id: p.id, name: p.name, score: p.score, team: p.team }))
      .sort((a, b) => b.score - a.score);
    return (
      <>
        {reconnectBanner}
        <GameHeader slug="drawit" actions={<SoundToggle />} onLeaveRoom={handleLeaveRoom} />
        <ResultsScreen
          ranking={ranking}
          gallery={gallery}
          myId={myId}
          isHost={amHost}
          showTeams={room.config.mode === "teams"}
          onPlayAgain={() => emit("restart-game")}
        />
      </>
    );
  }

  const isDrawer = room.drawerId === myId;
  const drawerPlayer = room.players.find((p) => p.id === room.drawerId);
  const drawerName = drawerPlayer?.name ?? "Alguém";
  const drawerTeam = drawerPlayer?.team ?? null;

  // altura travada na viewport (dvh acompanha a barra do navegador no celular): a pagina nunca
  // rola durante o jogo, so o feed de chutes
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {reconnectBanner}
      <GameHeader slug="drawit" actions={<SoundToggle />} onLeaveRoom={handleLeaveRoom} />
      {room.phase === "picking-word" && isDrawer && room.wordOptions && (
        <WordPicker
          options={room.wordOptions}
          pickEndsAt={room.pickEndsAt}
          clockOffset={clockOffset}
          modifier={room.turnModifier}
          onChoose={handleChooseWord}
        />
      )}
      {room.phase === "picking-word" && !isDrawer && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="animate-pop-in flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary)] text-white shadow-[0_6px_0_var(--primary-dark)]">
            <Pencil className="h-8 w-8" style={{ animation: "wiggle 1s ease-in-out infinite" }} />
          </span>
          <p className="animate-fade-up text-base font-bold text-[var(--fg)] sm:text-lg">
            <b className="text-[var(--primary)]">{drawerName}</b> está escolhendo uma palavra
            <span className="inline-flex w-6 justify-start">
              <span className="animate-pulse">...</span>
            </span>
          </p>
          {room.config.mode === "teams" && drawerTeam && (
            <p className="text-sm font-extrabold" style={{ color: TEAM_INFO[drawerTeam].color }}>
              Vez do {TEAM_INFO[drawerTeam].label}
            </p>
          )}
          {room.turnModifier && <ModifierBadge modifier={room.turnModifier} size="lg" />}
          <PickCountdown pickEndsAt={room.pickEndsAt} clockOffset={clockOffset} />
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">
            Rodada {room.round}/{room.config.roundsPerPlayer}
          </p>
        </div>
      )}
      {room.phase.startsWith("impostor-") && (
        <ImpostorScreen
          // rodada nova = canvas novo
          key={`impostor-${room.round}`}
          room={room}
          myId={myId}
          clockOffset={clockOffset}
          feed={feed}
          onStroke={(id: string, points: Point[], color: string, width: number) =>
            emit("draw-stroke", { id, points, color, width })
          }
          onStrokeDone={() => emit("stroke-done")}
          onVote={(targetId: string) => emit("cast-vote", { targetId })}
          onSubmitText={(text: string) => emit("submit-guess", { guess: text })}
          registerCanvasHandlers={registerCanvasHandlers}
        />
      )}
      {(room.phase === "drawing" || room.phase === "turn-results") && (
        <GameScreen
          room={room}
          myId={myId}
          clockOffset={clockOffset}
          feed={feed}
          lastTurn={lastTurn}
          celebration={celebration}
          onStroke={(id: string, points: Point[], color: string, width: number) =>
            emit("draw-stroke", { id, points, color, width })
          }
          onFill={(event: FillEvent) => emit("draw-fill", event)}
          onShape={(event: ShapeEvent) => emit("draw-shape", event)}
          onClear={(id: string) => emit("clear-canvas", { id })}
          onUndo={() => emit("undo-last")}
          onSubmitGuess={(guess: string) => emit("submit-guess", { guess })}
          registerCanvasHandlers={registerCanvasHandlers}
        />
      )}
    </div>
  );
}
