"use client";

import { useEffect, useRef, useState } from "react";
import { GameHeader } from "@/components/GameHeader";
import { useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { getDrawSocket } from "@/lib/draw/socket";
import { initDrawSound, playDrawSfx } from "@/lib/draw/sound";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Lobby } from "./Lobby";
import { RoomWaiting } from "./RoomWaiting";
import { WordPicker } from "./WordPicker";
import { GameScreen, type Celebration } from "./GameScreen";
import { ResultsScreen } from "./ResultsScreen";
import { JoinNameModal } from "./JoinNameModal";
import { SoundToggle } from "./SoundToggle";
import { DrawTutorial } from "./DrawTutorial";
import { useLocalFlag } from "@/lib/race/useLocalFlag";
import type {
  DrawRoomConfig,
  DrawRoomState,
  FeedItem,
  GalleryDrawing,
  GameEndedPayload,
  GuessResult,
  TurnEndedPayload,
} from "@/lib/draw/types";

interface CanvasHandlers {
  applyRemoteStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
  applyUndo: (strokeId: string) => void;
  applyClear: () => void;
  snapshot: () => string | null;
}

const TUTORIAL_KEY = "drawTutorialSeen";

let feedSeq = 0;
function feedId(): string {
  feedSeq += 1;
  return `${Date.now()}-${feedSeq}`;
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
  const [lastTurn, setLastTurn] = useState<TurnEndedPayload | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const socketRef = useRef(getDrawSocket());
  const canvasHandlersRef = useRef<CanvasHandlers | null>(null);
  const prevRoomRef = useRef<DrawRoomState | null>(null);
  // desenhos da sessao (todas as partidas na mesma sala), capturados localmente no fim de cada turno
  const [gallery, setGallery] = useState<GalleryDrawing[]>([]);
  const gameNumberRef = useRef(1);
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

    function handleRoomUpdated(state: DrawRoomState | null) {
      const prev = prevRoomRef.current;
      prevRoomRef.current = state;
      setRoom(state);
      if (!state) return;

      const me = socket.id;
      const phaseChanged = prev?.phase !== state.phase;
      if (state.phase === "lobby" && prev?.phase === "lobby" && state.players.length > prev.players.length) {
        playDrawSfx("join");
      }
      if (phaseChanged && state.phase === "picking-word") {
        setFeed([]);
        setLastTurn(null);
        if (state.currentDrawerSocketId === me) playDrawSfx("yourTurn");
      }
      if (phaseChanged && state.phase === "drawing") playDrawSfx("turnStart");
      if (state.phase === "lobby") setFeed([]);
      if (state.phase !== "results") setGameResult(null);
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
        // so quem acertou ve a palavra que digitou; os outros recebem so "Fulano acertou!"
        pushFeed({ kind: "own-correct", text: `Você acertou "${result.guess}"! +${result.points}` });
        setCelebration({ key: Date.now(), points: result.points });
        playDrawSfx("correct");
      } else if (result.close) {
        pushFeed({ kind: "close", text: result.guess });
        playDrawSfx("close");
      } else if (!result.alreadyGuessed && !result.tooFast) {
        pushFeed({ kind: "own-wrong", text: result.guess });
        playDrawSfx("wrong");
      }
    }
    function handlePlayerGuessed(data: { socketId: string; name: string }) {
      pushFeed({ kind: "correct", name: data.name, text: "acertou!" });
      playDrawSfx("otherCorrect");
    }
    function handlePlayerGuessAttempt(data: { socketId: string; name: string; guess: string }) {
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
            data.players.find((p) => p.socketId === data.drawerSocketId)?.name ??
            turnRoom?.players.find((p) => p.socketId === data.drawerSocketId)?.name ??
            "?",
          difficulty: data.difficulty,
          game: gameNumberRef.current,
          round: turnRoom?.round ?? 1,
        };
        setGallery((prev) => [...prev, drawing]);
      }
      setLastTurn(data);
      pushFeed({ kind: "system", text: `A palavra era: ${data.word ?? "?"}` });
      playDrawSfx("turnEnd");
    }
    function handleGameEnded(data: GameEndedPayload) {
      setGameResult(data);
      gameNumberRef.current += 1;
      playDrawSfx(data.players[0]?.socketId === socket.id ? "win" : "gameEnd");
    }
    function handleRoomClosed() {
      prevRoomRef.current = null;
      setGallery([]);
      gameNumberRef.current = 1;
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
    playDrawSfx("pick");
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
    prevRoomRef.current = null;
    setRoom(null);
    setGameResult(null);
    setGallery([]);
    gameNumberRef.current = 1;
  }

  function closeTutorial() {
    setTutorialSeen(true);
    setTutorialOpen(false);
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
          onHowToPlay={() => setTutorialOpen(true)}
        />
        {tutorial}
      </>
    );
  }

  const mySocketId = socketRef.current.id ?? "";
  const amHost = room.hostSocketId === mySocketId;

  if (room.phase === "lobby") {
    return (
      <>
        <RoomWaiting
          room={room}
          mySocketId={mySocketId}
          onStart={handleStart}
          onLeaveRoom={handleLeaveRoom}
          onUpdateConfig={handleUpdateConfig}
          onTransferHost={handleTransferHost}
          onHowToPlay={() => setTutorialOpen(true)}
        />
        {tutorial}
      </>
    );
  }

  if (room.phase === "results" && gameResult) {
    return (
      <>
        <GameHeader slug="drawit" actions={<SoundToggle />} onLeaveRoom={handleLeaveRoom} />
        <ResultsScreen result={gameResult} gallery={gallery} mySocketId={mySocketId} isHost={amHost} onPlayAgain={handlePlayAgain} />
      </>
    );
  }

  const isDrawer = room.currentDrawerSocketId === mySocketId;
  const drawerName = room.players.find((p) => p.socketId === room.currentDrawerSocketId)?.name ?? "Alguem";

  // altura travada na viewport (dvh acompanha a barra do navegador no celular): a pagina nunca
  // rola durante o jogo, so o feed de chutes
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <GameHeader slug="drawit" actions={<SoundToggle />} onLeaveRoom={handleLeaveRoom} />
      {room.phase === "picking-word" && isDrawer && room.wordOptions && (
        <WordPicker options={room.wordOptions} onChoose={handleChooseWord} />
      )}
      {room.phase === "picking-word" && !isDrawer && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span
            className="animate-pop-in flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary)] text-white shadow-[0_6px_0_var(--primary-dark)]"
          >
            <Pencil className="h-8 w-8" style={{ animation: "wiggle 1s ease-in-out infinite" }} />
          </span>
          <p className="animate-fade-up text-base font-bold text-[var(--fg)] sm:text-lg">
            <b className="text-[var(--primary)]">{drawerName}</b> esta escolhendo uma palavra
            <span className="inline-flex w-6 justify-start">
              <span className="animate-pulse">...</span>
            </span>
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">
            Rodada {room.round}/{room.config.roundsPerPlayer}
          </p>
        </div>
      )}
      {(room.phase === "drawing" || room.phase === "turn-results") && (
        <GameScreen
          room={room}
          mySocketId={mySocketId}
          feed={feed}
          lastTurn={lastTurn}
          celebration={celebration}
          onStroke={handleStroke}
          onClear={handleClear}
          onUndo={handleUndo}
          onSubmitGuess={handleSubmitGuess}
          registerCanvasHandlers={(handlers) => {
            canvasHandlersRef.current = handlers;
          }}
        />
      )}
    </div>
  );
}
