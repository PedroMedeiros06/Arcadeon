"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameHeader } from "@/components/GameHeader";
import { useSearchParams } from "next/navigation";
import { Hourglass, LogOut } from "lucide-react";
import { getRaceSocket } from "@/lib/race/socket";
import { useAuth } from "@/lib/auth/AuthProvider";
import { RoundCountdown } from "@/components/buggle/RoundCountdown";
import { JoinNameModal } from "@/components/draw/JoinNameModal";
import { Lobby } from "./Lobby";
import { RoomWaiting } from "./RoomWaiting";
import { QuestionCard } from "./QuestionCard";
import { RaceTrack } from "./RaceTrack";
import { RaceResults } from "./RaceResults";
import { RaceTutorial } from "./RaceTutorial";
import { SoundToggle } from "./SoundToggle";
import { initRaceSound, playSfx } from "@/lib/race/sound";
import { diffRaceSnapshots } from "@/lib/race/raceFx";
import { useLocalFlag } from "@/lib/race/useLocalFlag";
import type { AnswerRejection, PlayerAvatar, RaceRoomConfig, RaceRoomState } from "@/lib/race/types";

// ultimo 0.8s do countdown do servidor e' o "VAI!"
const GO_MS = 800;
const TUTORIAL_KEY = "raceTutorialSeen";

const REJECTION_TEXT: Partial<Record<AnswerRejection, string>> = {
  late: "Tempo esgotado — resposta não contou.",
  stale: "Essa pergunta já acabou.",
};


export function RaceGame() {
  const { username, loading: authLoading, equippedAvatar, session } = useAuth();
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
  const prevRoomRef = useRef<RaceRoomState | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const hurryForRef = useRef<string | null>(null);
  const [overtakers, setOvertakers] = useState<string[]>([]);
  const [tutorialSeen, setTutorialSeen] = useLocalFlag(TUTORIAL_KEY, true);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    function handleRoomUpdated(state: RaceRoomState) {
      clockOffsetRef.current = state.serverNow - Date.now();
      setNow(state.serverNow);
      if (questionIdRef.current !== (state.question?.id ?? null)) {
        questionIdRef.current = state.question?.id ?? null;
        setAnsweredIds(new Set());
        setNotice(null);
      }
      // sons e animacoes pontuais vem da diferenca entre o snapshot anterior e o atual
      const fx = diffRaceSnapshots(prevRoomRef.current, state, socket.id ?? "");
      for (const sfx of fx.sounds) setTimeout(() => playSfx(sfx.name, sfx.level), sfx.delay);
      if (state.phase === "question-results") setOvertakers(fx.overtakers);
      else if (state.phase === "question") setOvertakers([]);
      prevRoomRef.current = state;
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
      prevRoomRef.current = null;
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
      prevRoomRef.current = null;
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

  useEffect(() => {
    initRaceSound();
  }, []);

  // identifica a conta pro servidor (ranking); ele valida o token, nunca confia no cliente
  const accessToken = session?.access_token ?? null;
  useEffect(() => {
    if (!connected || authLoading) return;
    socket.emit("identify", { accessToken });
  }, [connected, authLoading, accessToken, socket]);

  // sair da pagina = sair da sala
  useEffect(() => {
    return () => {
      socket.emit("leave-room");
    };
  }, [socket]);

  const phase = room?.phase;
  useEffect(() => {
    if (phase !== "countdown" && phase !== "question" && phase !== "question-results") return;
    const id = setInterval(() => {
      const serverNow = Date.now() + clockOffsetRef.current;
      setNow(serverNow);
      const current = prevRoomRef.current;
      if (!current?.phaseEndsAt) return;
      if (current.phase === "countdown") {
        // 3, 2, 1 com tick curto e "VAI!" mais forte
        const n = Math.max(0, Math.ceil((current.phaseEndsAt - GO_MS - serverNow) / 1000));
        if (n !== lastTickRef.current) {
          lastTickRef.current = n;
          playSfx(n > 0 ? "tick" : "go");
        }
      } else if (current.phase === "question" && current.question) {
        lastTickRef.current = null;
        const left = current.phaseEndsAt - serverNow;
        if (left <= 3000 && left > 0 && hurryForRef.current !== current.question.id) {
          hurryForRef.current = current.question.id;
          playSfx("hurry");
        }
      }
    }, 100);
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
    prevRoomRef.current = null;
    setRoom(null);
    setLocked(null);
    setPending(null);
  }

  function handleAnswer(index: number) {
    if (!room?.question || pending || locked?.questionId === room.question.id) return;
    setPending({ questionId: room.question.id, index });
    socket.emit("submit-answer", { questionId: room.question.id, answerIndex: index });
  }

  function closeTutorial() {
    setTutorialSeen(true);
    setTutorialOpen(false);
  }
  // abre sozinho so na primeira visita, fora da partida
  const showTutorial = tutorialOpen || (!tutorialSeen && (!room || room.phase === "lobby"));
  const tutorial = showTutorial ? <RaceTutorial onClose={closeTutorial} /> : null;

  // ---------- render ----------

  if (!room && joinCodeFromUrl && pendingAutoJoin) {
    if (authLoading || !connected) {
      return (
        <>
          <GameHeader slug="corrida" shortTitle="Corrida" />
          <div className="flex flex-1 items-center justify-center">
            <p className="font-semibold text-[var(--fg-muted)]">{connected ? "Carregando..." : "Conectando ao servidor..."}</p>
          </div>
        </>
      );
    }
    if (!username) {
      return (
        <>
          <GameHeader slug="corrida" shortTitle="Corrida" />
          <JoinNameModal onConfirm={handleJoinWithName} joinError={joinError} />
        </>
      );
    }
  }

  if (!room) {
    return (
      <>
        {lobbyMode !== "create" && <GameHeader slug="corrida" shortTitle="Corrida" />}
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
          onHowToPlay={() => setTutorialOpen(true)}
        />
        {tutorial}
      </>
    );
  }

  if (room.phase === "lobby") {
    return (
      <>
        <RoomWaiting
          room={room}
          mySocketId={mySocketId}
          onStart={() => socket.emit("start-game")}
          onLeaveRoom={handleLeaveRoom}
          onUpdateConfig={(config) => socket.emit("update-config", { config })}
          onTransferHost={(newHostSocketId) => socket.emit("transfer-host", { newHostSocketId })}
          onRename={handleRename}
          onUpdateAvatar={(avatar) => socket.emit("update-avatar", { avatar })}
          onHowToPlay={() => setTutorialOpen(true)}
        />
        {tutorial}
      </>
    );
  }

  if (room.phase === "results") {
    return (
      <>
        <GameHeader slug="corrida" shortTitle="Corrida" onLeaveRoom={handleLeaveRoom} />
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
  const me = players.find((p) => p.socketId === mySocketId);
  const myEntry = room.reveal?.entries.find((e) => e.socketId === mySocketId);
  const nextIn = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const frozenNow = !isReveal && !!me?.frozen;
  const finisher = isReveal && room.finishing ? [...players].sort((a, b) => a.rank - b.rank)[0] : null;

  let revealChip: { text: string; tone: "good" | "bad" | "ice" } | null = null;
  if (isReveal && myEntry) {
    if (myEntry.wasFrozen) revealChip = { text: "🧊 Congelado: carro parado nesta rodada", tone: "ice" };
    else if (myEntry.correct) revealChip = { text: `✓ +${myEntry.distanceGained}m`, tone: "good" };
    else if (myEntry.lostStreak) revealChip = { text: "Sequência perdida: 🧊 congelado na próxima", tone: "ice" };
    else revealChip = { text: myEntry.answerIndex === null ? "Sem resposta" : "✕ Errou", tone: "bad" };
  }

  const track = (compact: boolean) => (
    <RaceTrack
      players={players}
      finishProgress={room.finishProgress}
      mySocketId={mySocketId}
      reveal={isReveal ? room.reveal : null}
      overtakers={isReveal ? overtakers : []}
      showAnswered={!isReveal}
      compact={compact}
    />
  );

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      {/* barra do topo: sem GameHeader durante a corrida, pra sobrar espaco vertical */}
      <div className="sticky top-0 z-30 border-b-2 border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleLeaveRoom}
              aria-label="Sair da corrida"
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] transition hover:opacity-80"
            >
              <LogOut size={16} />
            </button>
            <SoundToggle />
          </div>
          <div className="flex min-w-0 flex-col items-center leading-tight">
            <span className="text-sm font-extrabold text-[var(--fg)]">Pergunta {room.questionIndex + 1}</span>
            {question && (
              <span className="truncate text-xs font-bold uppercase tracking-wide text-[var(--primary)]">
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

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-5">
        {/* a pista vem primeiro: a pergunta e' o combustivel, a corrida e' o jogo */}
        <div className={isReveal ? "hidden" : "lg:hidden"}>{track(true)}</div>
        <div className={isReveal ? "" : "hidden lg:block"}>{track(false)}</div>

        {finisher && (
          <div
            className="rounded-2xl bg-linear-to-r from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)] px-4 py-2 text-center text-sm font-black text-white"
            style={{ animation: "popIn 0.5s ease-out 0.8s backwards" }}
          >
            🏁 {finisher.name} cruzou a linha de chegada!
          </div>
        )}

        {frozenNow && (
          <div
            data-testid="frozen-banner"
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-sky-200 bg-sky-100 px-3 py-2 text-center text-sm font-bold text-sky-800"
            style={{ animation: "popIn 0.4s ease-out" }}
          >
            🧊 Congelado nesta rodada: responda, mas seu carro não anda
          </div>
        )}

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

        {/* status curto: nada de relatorio, so o essencial */}
        <div className="min-h-6 text-center text-sm font-bold">
          {!isReveal && !open && <span className="text-[var(--fg-muted)]">Prepare-se...</span>}
          {!isReveal && lockedIndex !== null && !notice && <span className="text-[var(--fg-muted)]">✓ Resposta travada</span>}
          {!isReveal && notice && <span className="text-[var(--danger)]">{notice}</span>}
          {revealChip && (
            <span
              data-testid="reveal-chip"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                revealChip.tone === "good"
                  ? "bg-[var(--primary-tint)] text-[var(--primary)]"
                  : revealChip.tone === "ice"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-[var(--danger-bg)] text-[var(--danger)]"
              }`}
              style={{ animation: revealChip.tone === "bad" ? "shake 0.4s" : "popIn 0.4s ease-out" }}
            >
              {revealChip.text}
            </span>
          )}
        </div>

        {isReveal && (
          <p className="text-center text-xs font-semibold text-[var(--fg-muted)]">
            {room.finishing ? "Resultado" : "Próxima pergunta"} em {nextIn}s
          </p>
        )}
      </div>
    </div>
  );
}
