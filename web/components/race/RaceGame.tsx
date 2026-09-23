"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Flag, Hourglass, LogOut } from "lucide-react";
import { getRaceSocket } from "@/lib/race/socket";
import { useAuth } from "@/lib/auth/AuthProvider";
import { RoundCountdown } from "@/components/buggle/RoundCountdown";
import { JoinNameModal } from "@/components/draw/JoinNameModal";
import { Lobby } from "./Lobby";
import { RoomWaiting } from "./RoomWaiting";
import { QuestionCard } from "./QuestionCard";
import { RaceTrack } from "./RaceTrack";
import { RaceResults } from "./RaceResults";
import type { AnswerRejection, PlayerAvatar, RaceRoomConfig, RaceRoomState } from "@/lib/race/types";

// ultimo 0.8s do countdown do servidor e' o "VAI!"
const GO_MS = 800;

const REJECTION_TEXT: Partial<Record<AnswerRejection, string>> = {
  late: "Tempo esgotado — resposta não contou.",
  stale: "Essa pergunta já acabou.",
};

function GameHeader({ onLeaveRoom }: { onLeaveRoom?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--border)] bg-[var(--card)] px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-extrabold text-[var(--fg-muted)] transition hover:bg-[var(--bg)] sm:px-4"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Hub</span>
        </Link>
        <h1 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-[var(--fg)] sm:text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)] text-white sm:h-9 sm:w-9">
            <Flag className="h-4 w-4" />
          </span>
          Corrida
        </h1>
        {onLeaveRoom ? (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 rounded-2xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm font-extrabold text-[var(--danger)] transition hover:opacity-80"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
          </button>
        ) : (
          <span className="w-[52px] sm:w-[76px]" />
        )}
      </div>
    </header>
  );
}

export function RaceGame() {
  const { username, loading: authLoading, equippedAvatar } = useAuth();
  const searchParams = useSearchParams();
  const joinCodeFromUrl = searchParams.get("join");
  const [socket] = useState(getRaceSocket);
  // comeca desconectado nos dois lados (SSR e client) pra nao dar hydration mismatch
  const [connected, setConnected] = useState(false);
  const [mySocketId, setMySocketId] = useState("");
  const [room, setRoom] = useState<RaceRoomState | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pendingAutoJoin, setPendingAutoJoin] = useState(!!joinCodeFromUrl);
  const [lobbyMode, setLobbyMode] = useState<"choose" | "create" | "join">("choose");
  const [roomClosed, setRoomClosed] = useState(false);
  const [locked, setLocked] = useState<{ questionId: string; index: number } | null>(null);
  const [pending, setPending] = useState<{ questionId: string; index: number } | null>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  // diferenca relogio do servidor - relogio local; so pra exibir tempo, nunca decide nada
  const clockOffsetRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const questionIdRef = useRef<string | null>(null);
  const hasRoomRef = useRef(false);
  const autoJoinSentRef = useRef(false);
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleRoomUpdated(state: RaceRoomState) {
      clockOffsetRef.current = state.serverNow - Date.now();
      setNow(state.serverNow);
      if (questionIdRef.current !== (state.question?.id ?? null)) {
        questionIdRef.current = state.question?.id ?? null;
        setAnsweredIds(new Set());
        setNotice(null);
      }
      hasRoomRef.current = true;
      setPendingAutoJoin(false);
      setRoom(state);
    }
    function handleAnswerLocked(data: { questionId: string; answerIndex: number }) {
      setLocked({ questionId: data.questionId, index: data.answerIndex });
      setPending(null);
    }
    function handleAnswerRejected(data: { reason: AnswerRejection }) {
      setPending(null);
      const text = REJECTION_TEXT[data.reason];
      if (text) setNotice(text);
    }
    function handlePlayerAnswered(data: { socketId: string }) {
      setAnsweredIds((prev) => new Set(prev).add(data.socketId));
    }
    function handleJoinError(data: { message: string }) {
      setJoinError(data.message);
      // QR de usuario logado falhou: cai no lobby mostrando o erro
      if (autoJoinSentRef.current) setPendingAutoJoin(false);
    }
    function handleRoomClosed() {
      hasRoomRef.current = false;
      setRoom(null);
      setRoomClosed(true);
    }
    function handleConnect() {
      setConnected(true);
      setMySocketId(socket.id ?? "");
    }
    function handleDisconnect() {
      setConnected(false);
      // sem reconexao no MVP: o servidor ja removeu a gente da sala
      if (hasRoomRef.current) setRoomClosed(true);
      hasRoomRef.current = false;
      setRoom(null);
    }

    socket.on("room-updated", handleRoomUpdated);
    socket.on("answer-locked", handleAnswerLocked);
    socket.on("answer-rejected", handleAnswerRejected);
    socket.on("player-answered", handlePlayerAnswered);
    socket.on("join-error", handleJoinError);
    socket.on("room-closed", handleRoomClosed);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    if (socket.connected) handleConnect();
    return () => {
      socket.off("room-updated", handleRoomUpdated);
      socket.off("answer-locked", handleAnswerLocked);
      socket.off("answer-rejected", handleAnswerRejected);
      socket.off("player-answered", handlePlayerAnswered);
      socket.off("join-error", handleJoinError);
      socket.off("room-closed", handleRoomClosed);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  // sair da pagina = sair da sala
  useEffect(() => {
    return () => {
      socket.emit("leave-room");
    };
  }, [socket]);

  const phase = room?.phase;
  useEffect(() => {
    if (phase !== "countdown" && phase !== "question" && phase !== "question-results") return;
    const id = setInterval(() => setNow(Date.now() + clockOffsetRef.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  const currentAvatar = useCallback(
    (): PlayerAvatar | null =>
      equippedAvatar
        ? { emoji: equippedAvatar.emoji ?? null, bgColor: equippedAvatar.bg_color ?? null, imageUrl: equippedAvatar.image_url ?? null }
        : null,
    [equippedAvatar]
  );

  useEffect(() => {
    // so a primeira entrada via QR — depois de sair da sala nao reentra sozinho
    if (!pendingAutoJoin || autoJoinSentRef.current || !joinCodeFromUrl || authLoading || room || !connected) return;
    if (username) {
      autoJoinSentRef.current = true;
      socket.emit("join-room", { code: joinCodeFromUrl, name: username, avatar: currentAvatar() });
    }
  }, [pendingAutoJoin, joinCodeFromUrl, authLoading, username, room, connected, currentAvatar, socket]);

  function handleCreate(config: RaceRoomConfig, name: string) {
    setRoomClosed(false);
    socket.emit("create-room", { config, name, avatar: currentAvatar() });
  }

  function handleJoin(name: string, code: string) {
    setJoinError(null);
    setRoomClosed(false);
    socket.emit("join-room", { code, name, avatar: currentAvatar() });
  }

  function handleJoinWithName(name: string) {
    if (!joinCodeFromUrl) return;
    setJoinError(null);
    socket.emit("join-room", { code: joinCodeFromUrl, name, avatar: currentAvatar() });
  }

  function handleRename(name: string) {
    // modal dispara a cada tecla; servidor limita a taxa, entao manda so o valor final
    if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
    renameTimerRef.current = setTimeout(() => {
      if (name.trim()) socket.emit("rename-player", { name });
    }, 350);
  }

  function handleLeaveRoom() {
    socket.emit("leave-room");
    hasRoomRef.current = false;
    setRoom(null);
    setLocked(null);
    setPending(null);
  }

  function handleAnswer(index: number) {
    if (!room?.question || pending || locked?.questionId === room.question.id) return;
    setPending({ questionId: room.question.id, index });
    socket.emit("submit-answer", { questionId: room.question.id, answerIndex: index });
  }

  // ---------- render ----------

  if (!room && joinCodeFromUrl && pendingAutoJoin) {
    if (authLoading || !connected) {
      return (
        <>
          <GameHeader />
          <div className="flex flex-1 items-center justify-center">
            <p className="font-semibold text-[var(--fg-muted)]">{connected ? "Carregando..." : "Conectando ao servidor..."}</p>
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
        {joinError && lobbyMode === "choose" && (
          <p className="mt-4 text-center text-sm font-bold text-[var(--danger)]">{joinError}</p>
        )}
        {roomClosed && <p className="mt-4 text-center text-sm font-bold text-[var(--danger)]">Você saiu da sala ou ela foi encerrada.</p>}
        <Lobby
          defaultName={username ?? ""}
          isNameLocked={!!username}
          connected={connected}
          onCreate={handleCreate}
          onJoin={handleJoin}
          joinError={joinError}
          onModeChange={setLobbyMode}
        />
      </>
    );
  }


  if (room.phase === "lobby") {
    return (
      <RoomWaiting
        room={room}
        mySocketId={mySocketId}
        onStart={() => socket.emit("start-game")}
        onLeaveRoom={handleLeaveRoom}
        onUpdateConfig={(config) => socket.emit("update-config", { config })}
        onTransferHost={(newHostSocketId) => socket.emit("transfer-host", { newHostSocketId })}
        onRename={handleRename}
        onUpdateAvatar={(avatar) => socket.emit("update-avatar", { avatar })}
      />
    );
  }

  if (room.phase === "results") {
    return (
      <>
        <GameHeader onLeaveRoom={handleLeaveRoom} />
        <RaceResults
          room={room}
          mySocketId={mySocketId}
          onPlayAgain={() => socket.emit("restart-game")}
          onLeave={handleLeaveRoom}
        />
      </>
    );
  }

  if (room.phase === "countdown") {
    const remaining = (room.phaseEndsAt ?? now) - GO_MS - now;
    return <RoundCountdown countdown={Math.max(0, Math.ceil(remaining / 1000))} />;
  }

  // question / question-results
  const question = room.question;
  const isReveal = room.phase === "question-results";
  const startsAt = room.phaseStartsAt ?? now;
  const endsAt = room.phaseEndsAt ?? now;
  const open = !isReveal && now >= startsAt;
  const questionMs = room.config.questionSeconds * 1000;
  const msLeft = Math.max(0, endsAt - Math.max(now, startsAt));
  const secondsLeft = Math.ceil(msLeft / 1000);
  const timeFraction = isReveal ? 0 : Math.min(1, msLeft / questionMs);
  const ending = !isReveal && msLeft <= 3000;
  const lockedIndex = question && locked?.questionId === question.id ? locked.index : null;
  const pendingIndex = question && pending?.questionId === question.id ? pending.index : null;
  const players = room.players.map((p) => ({ ...p, answered: p.answered || answeredIds.has(p.socketId) }));
  const answeredCount = players.filter((p) => p.answered).length;
  const myEntry = room.reveal?.entries.find((e) => e.socketId === mySocketId);
  const isLast = room.questionIndex + 1 >= room.totalQuestions;
  const nextIn = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      {/* barra do topo: sem GameHeader durante a corrida, pra sobrar espaco vertical */}
      <div className="sticky top-0 z-30 border-b-2 border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleLeaveRoom}
            aria-label="Sair da corrida"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] transition hover:opacity-80"
          >
            <LogOut size={16} />
          </button>
          <div className="flex min-w-0 flex-col items-center leading-tight">
            <span className="text-sm font-extrabold text-[var(--fg)]">
              Pergunta {room.questionIndex + 1}/{room.totalQuestions}
            </span>
            {question && (
              <span className="truncate text-[11px] font-bold uppercase tracking-wide text-[var(--primary)]">
                {question.category}
              </span>
            )}
          </div>
          <div
            className={`flex min-w-[64px] items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-black tabular-nums ${
              ending ? "bg-[var(--danger)] text-white" : "bg-[var(--primary-tint)] text-[var(--primary)]"
            }`}
          >
            <Hourglass size={14} />
            {isReveal ? "—" : `${secondsLeft}s`}
          </div>
        </div>
        <div className="h-1.5 w-full bg-[var(--border)]">
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={{ width: `${timeFraction * 100}%`, backgroundColor: ending ? "var(--danger)" : "var(--primary)" }}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
        {question && (
          <div key={question.id} className="animate-fade-up">
            <QuestionCard
              question={question}
              lockedIndex={lockedIndex}
              pendingIndex={pendingIndex}
              reveal={isReveal ? room.reveal : null}
              open={open}
              onAnswer={handleAnswer}
            />
          </div>
        )}

        {/* status abaixo das alternativas */}
        <div className="min-h-6 text-center text-sm font-bold">
          {!isReveal && !open && <span className="text-[var(--fg-muted)]">Prepare-se...</span>}
          {!isReveal && open && lockedIndex === null && !notice && (
            <span className="text-[var(--fg-muted)]">Escolha rápido — velocidade conta!</span>
          )}
          {!isReveal && lockedIndex !== null && (
            <span className="text-[var(--fg-muted)]">
              Resposta travada · aguardando os outros {answeredCount}/{players.length}
            </span>
          )}
          {!isReveal && notice && <span className="text-[var(--danger)]">{notice}</span>}
          {isReveal && myEntry && (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                myEntry.correct ? "bg-[var(--primary-tint)] text-[var(--primary)]" : "bg-[var(--danger-bg)] text-[var(--danger)]"
              }`}
              style={{ animation: "popIn 0.4s ease-out" }}
            >
              {myEntry.correct
                ? `Acertou! +${myEntry.distanceGained} na pista · +${myEntry.pointsGained} pts`
                : myEntry.answerIndex === null
                  ? "Sem resposta — ficou parado"
                  : "Errou — ficou parado"}
            </span>
          )}
        </div>

        {/* pista: compacta no celular durante a pergunta, completa no reveal e no desktop */}
        <div className={isReveal ? "hidden" : "lg:hidden"}>
          <RaceTrack players={players} finishLine={room.finishLine} mySocketId={mySocketId} showAnswered compact />
        </div>
        <div className={isReveal ? "" : "hidden lg:block"}>
          <RaceTrack
            players={players}
            finishLine={room.finishLine}
            mySocketId={mySocketId}
            gains={isReveal ? room.reveal?.entries : null}
            showAnswered={!isReveal}
          />
        </div>

        {isReveal && (
          <p className="text-center text-xs font-semibold text-[var(--fg-muted)]">
            {isLast ? "Resultado final" : "Próxima pergunta"} em {nextIn}s
          </p>
        )}
      </div>
    </div>
  );
}
