"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { BarChart3, CircleHelp, Lightbulb, Settings, Share2, Skull, Timer } from "lucide-react";
import { GameHeader, headerButtonClass } from "@/components/GameHeader";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLocalFlag } from "@/lib/race/useLocalFlag";
import {
  MODES,
  WORD_LENGTH,
  buildBoardRows,
  buildShareText,
  computeKeyStates,
  decodeChallenge,
  encodeChallenge,
  evaluateGuess,
  hardModeViolation,
  maxAttemptsFor,
  parseWordList,
  pickRandomWords,
  withAccents,
  type BoardCount,
  type Challenge,
  type LetterState,
  type PlayMode,
} from "@/lib/termo/logic";
import {
  clearLegacyProgress,
  errorMessage,
  fetchDailyState,
  payInfiniteHint,
  requestDailyHint,
  sendDailyGuess,
  setDailyHardMode,
  type DailyState,
  type Hint,
} from "@/lib/termo/daily";
import { useWordInput } from "@/lib/termo/useWordInput";
import { Boards, cellStyle } from "./Board";
import { Keyboard, KEY_ROWS } from "./Keyboard";
import { WinModal } from "./WinModal";
import { TermoTutorial } from "./TermoTutorial";
import { StatsModal } from "./StatsModal";
import { AnalysisModal } from "./AnalysisModal";
import { SpeedGame } from "./SpeedGame";
import { VillainGame } from "./VillainGame";
import { Confetti, NextWordCountdown } from "./Extras";

const TUTORIAL_KEY = "termoTutorialSeen";
const COLORBLIND_KEY = "termoColorblind";
const HARD_KEY = "termoHardMode";
const REVEAL_MS = WORD_LENGTH * 200 + 500;
const HINT_PRICE = 5;

type Status = "loading" | "error" | "playing" | "revealing" | "won" | "lost";
/** modos que nao usam os tabuleiros Letrado/Duplo/Quadruplo */
type ExtraMode = "speed" | "villain";

interface Game {
  mode: PlayMode;
  boardCount: BoardCount;
  guesses: string[];
  evals: LetterState[][][];
  /** Infinito: conhecidas desde o inicio. Diario: so chegam do servidor no fim. */
  answers: string[] | null;
  playDate: string | null;
  startedAt: number;
  /** Diario ja terminado quando a tela abriu: mostra o resumo em vez do tabuleiro. */
  alreadyPlayed: boolean;
  won: boolean;
  timeSeconds: number;
  hard: boolean;
  hints: Hint[];
  streak: number | null;
  coinsAwarded: number;
  shieldsUsed: number;
  achievements: string[];
  /** partida aberta por link de desafio */
  challenge: Challenge | null;
}

function gameFromDaily(state: DailyState, boardCount: BoardCount, alreadyPlayed: boolean): Game {
  return {
    mode: "daily",
    boardCount,
    guesses: state.guesses,
    evals: state.evals,
    answers: state.answers,
    playDate: state.playDate,
    startedAt: Date.now(),
    alreadyPlayed,
    won: state.won,
    timeSeconds: state.timeSeconds ?? 0,
    hard: state.hard,
    hints: state.hints,
    streak: state.currentStreak,
    coinsAwarded: state.coinsAwarded,
    shieldsUsed: state.shieldsUsed,
    achievements: state.achievements,
    challenge: null,
  };
}

function localGame(boardCount: BoardCount, answers: string[], hard: boolean, challenge: Challenge | null): Game {
  return {
    mode: "infinite",
    boardCount,
    guesses: [],
    evals: [],
    answers,
    playDate: null,
    startedAt: Date.now(),
    alreadyPlayed: false,
    won: false,
    timeSeconds: 0,
    hard: hard && boardCount === 1,
    hints: [],
    streak: null,
    coinsAwarded: 0,
    shieldsUsed: 0,
    achievements: [],
    challenge,
  };
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

async function shareResult(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (err) {
    // fechar o menu de compartilhar sem escolher nada nao e erro
    if (err instanceof DOMException && err.name === "AbortError") return "shared";
    return "failed";
  }
}

/** Primeiro tabuleiro ainda nao resolvido e a proxima posicao que a dica revelaria nele. */
function nextHintTarget(game: Game): { board: number; pos: number } | null {
  for (let b = 0; b < game.boardCount; b++) {
    if (buildBoardRows(game.guesses, game.evals, b).solved) continue;
    const answer = game.answers?.[b];
    for (let i = 0; i < WORD_LENGTH; i++) {
      const known = game.guesses.some((g, gi) => game.evals[gi]?.[b]?.[i] === "correct" && g[i]);
      const hinted = game.hints.some((h) => h.board === b && h.pos === i);
      if (!known && !hinted) return answer || game.mode === "daily" ? { board: b, pos: i } : null;
    }
  }
  return null;
}

export function TermoGame() {
  const { user, username, coins, refreshProfile } = useAuth();
  const userId = user?.id ?? null;
  const [playMode, setPlayMode] = useState<PlayMode>("daily");
  const [extraMode, setExtraMode] = useState<ExtraMode | null>(null);
  const [boardCount, setBoardCount] = useState<BoardCount>(1);
  const [targetWordPool, setTargetWordPool] = useState<string[]>([]);
  const [acceptedWords, setAcceptedWords] = useState<Set<string>>(new Set());
  const [accents, setAccents] = useState<Record<string, string>>({});
  const [game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [revealRowIndex, setRevealRowIndex] = useState<number | null>(null);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [tutorialSeen, setTutorialSeen] = useLocalFlag(TUTORIAL_KEY, true);
  const [colorblind, setColorblind] = useLocalFlag(COLORBLIND_KEY, false);
  const [hardPref, setHardPref] = useLocalFlag(HARD_KEY, false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  // primeira visita abre sozinho; depois so pelo botao "Como jogar"
  const showTutorial = tutorialOpen || !tutorialSeen;
  const overlayOpen = showTutorial || statsOpen || settingsOpen || analysisOpen;
  // numero da ultima troca de modo: resposta atrasada de uma troca antiga e descartada
  const requestRef = useRef(0);
  // palpite do Diario em voo: segura Enter repetido enquanto o servidor responde
  const submittingRef = useRef(false);

  function closeTutorial() {
    setTutorialSeen(true);
    setTutorialOpen(false);
  }

  const input = useWordInput({
    enabled: status === "playing" && !overlayOpen && extraMode === null && !!game && !game.alreadyPlayed,
    onSubmit: submitGuess,
  });

  const { reset: resetInput, shakeRow } = input;

  function flashError(text: string) {
    setMessage(text);
    shakeRow();
  }

  const startGame = useCallback(
    async (pool: string[], count: BoardCount, mode: PlayMode, challenge: Challenge | null = null) => {
      const request = ++requestRef.current;
      setExtraMode(null);
      setBoardCount(count);
      setPlayMode(mode);
      setStatus("loading");
      setMessage(null);
      setRevealRowIndex(null);
      setAnalysisOpen(false);
      resetInput();
      submittingRef.current = false;

      let next: Game;
      if (mode === "daily") {
        try {
          let state = await fetchDailyState(count);
          // modo dificil so vale no Letrado e antes do primeiro palpite
          if (count === 1 && !state.finished && state.guesses.length === 0 && state.hard !== hardPref) {
            state = await setDailyHardMode(count, hardPref);
          }
          next = gameFromDaily(state, count, state.finished);
        } catch (err) {
          console.error("Erro ao carregar o Diário:", err);
          if (request === requestRef.current) setStatus("error");
          return;
        }
      } else {
        next = localGame(count, challenge?.words ?? pickRandomWords(pool, count), hardPref, challenge);
      }

      if (request !== requestRef.current) return;
      setGame(next);
      setStatus("playing");
    },
    [hardPref, resetInput],
  );

  useEffect(() => {
    clearLegacyProgress();
    Promise.all([
      fetch("/words5_target.txt").then((res) => res.text()),
      fetch("/words5_accepted.txt").then((res) => res.text()),
      fetch("/words5_accents.json")
        .then((res) => res.json() as Promise<Record<string, string>>)
        .catch(() => ({})),
    ])
      .then(([targetText, acceptedText, accentMap]) => {
        const targets = parseWordList(targetText);
        setTargetWordPool(targets);
        setAcceptedWords(new Set(parseWordList(acceptedText)));
        setAccents(accentMap);

        // link de desafio: ?desafio=<codigo> abre o Infinito com as palavras do amigo
        const params = new URLSearchParams(window.location.search);
        const code = params.get("desafio");
        const challenge = code ? decodeChallenge(code, new Set(targets)) : null;
        if (code) {
          params.delete("desafio");
          const qs = params.toString();
          window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
        }
        if (challenge) {
          startGame(targets, challenge.words.length as BoardCount, "infinite", challenge);
        } else {
          startGame(targets, 1, "daily");
          if (code) setMessage("Link de desafio inválido.");
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar palavras:", err);
        setStatus("error");
      });
    // so na montagem: startGame muda quando hardPref muda, e isso nao deve recarregar tudo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // entrar/sair da conta muda de quem e a partida diaria: recarrega do servidor
  const lastUserRef = useRef(userId);
  useEffect(() => {
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;
    if (targetWordPool.length === 0 || playMode !== "daily" || extraMode !== null) return;
    const timer = setTimeout(() => startGame(targetWordPool, boardCount, "daily"), 0);
    return () => clearTimeout(timer);
  }, [userId, targetWordPool, playMode, boardCount, extraMode, startGame]);

  const changeMode = (count: BoardCount) => {
    if (targetWordPool.length > 0) startGame(targetWordPool, count, playMode);
  };

  const changePlayMode = (mode: PlayMode) => {
    if (targetWordPool.length > 0) startGame(targetWordPool, boardCount, mode);
  };

  function openExtra(mode: ExtraMode) {
    requestRef.current++;
    setExtraMode(mode);
    setMessage(null);
    setStatus("playing");
  }

  async function submitGuess(guess: string) {
    if (!game || status !== "playing" || submittingRef.current) return;

    if (guess.length < WORD_LENGTH) return flashError("Palavra incompleta");
    if (!acceptedWords.has(guess)) return flashError("Palavra não está na lista");
    if (game.hard) {
      const violation = hardModeViolation(game.guesses, game.evals, guess);
      if (violation) return flashError(violation);
    }
    setMessage(null);

    let next: Game;
    let finished: boolean;
    if (game.mode === "infinite" && game.answers) {
      const answers = game.answers;
      const guesses = [...game.guesses, guess];
      const evals = [...game.evals, answers.map((target) => evaluateGuess(guess, target))];
      const won = answers.every((target) => guesses.includes(target));
      finished = won || guesses.length >= maxAttemptsFor(game.boardCount);
      next = { ...game, guesses, evals, won, timeSeconds: Math.floor((Date.now() - game.startedAt) / 1000) };
    } else {
      submittingRef.current = true;
      const request = requestRef.current;
      try {
        const state = await sendDailyGuess(game.boardCount, guess);
        next = gameFromDaily(state, game.boardCount, false);
        finished = state.finished;
      } catch (err) {
        console.error("Erro ao enviar palpite:", err);
        submittingRef.current = false;
        return flashError(errorMessage(err, "Sem conexão. Tente de novo."));
      }
      // trocou de modo enquanto o palpite ia: a resposta nao e mais desta tela
      if (request !== requestRef.current) return;
      submittingRef.current = false;
    }

    setGame(next);
    setRevealRowIndex(next.guesses.length - 1);
    resetInput();

    if (finished) {
      // trava a entrada ja; o modal so abre depois da animacao (e do pulo da linha vencedora)
      setStatus("revealing");
      setTimeout(
        () => {
          setStatus(next.won ? "won" : "lost");
          setLeaderboardRefresh((n) => n + 1);
        },
        next.won ? REVEAL_MS + 700 : REVEAL_MS,
      );
      if (next.coinsAwarded > 0) refreshProfile().catch(() => {});
    }
  }

  async function handleHint() {
    if (!game || hintBusy || status !== "playing") return;
    if (!user) return setMessage("Entre na sua conta para usar dicas.");
    const target = nextHintTarget(game);
    if (!target) return setMessage("Não há letra para revelar.");
    setHintBusy(true);
    try {
      if (game.mode === "daily") {
        const state = await requestDailyHint(game.boardCount, target.board);
        setGame({ ...gameFromDaily(state, game.boardCount, false), startedAt: game.startedAt });
      } else if (game.answers) {
        await payInfiniteHint();
        const letter = game.answers[target.board][target.pos];
        setGame({ ...game, hints: [...game.hints, { ...target, letter }] });
      }
      setMessage(`Dica revelada (−${HINT_PRICE} moedas).`);
      refreshProfile().catch(() => {});
    } catch (err) {
      setMessage(errorMessage(err, "Não foi possível pegar a dica."));
    } finally {
      setHintBusy(false);
    }
  }

  function toggleHard() {
    const next = !hardPref;
    setHardPref(next);
    if (!game || game.boardCount !== 1 || game.guesses.length > 0 || game.alreadyPlayed) {
      setMessage(next ? "Modo difícil vale a partir da próxima partida do Letrado." : "Modo difícil desligado na próxima partida.");
      return;
    }
    if (game.mode === "daily") {
      setDailyHardMode(1, next)
        .then((state) => setGame((g) => (g ? { ...g, hard: state.hard } : g)))
        .catch(() => setMessage("Não foi possível mudar o modo difícil."));
    } else {
      setGame({ ...game, hard: next });
    }
  }

  const keyStates = useMemo(
    () => (game ? computeKeyStates(game.guesses, game.evals, game.boardCount) : {}),
    [game],
  );

  async function share(text: string) {
    const result = await shareResult(text);
    if (result === "copied") setMessage("Resultado copiado!");
    if (result === "failed") setMessage("Não deu para compartilhar.");
  }

  function handleShare() {
    if (!game) return;
    share(
      buildShareText({
        boardCount: game.boardCount,
        mode: game.challenge ? "challenge" : game.mode,
        playDate: game.playDate,
        guesses: game.guesses,
        evals: game.evals,
        won: game.won,
        url: `${window.location.origin}/games/termo`,
        hard: game.hard,
        hintsUsed: game.hints.length,
        colorblind,
      }),
    );
  }

  async function handleChallenge() {
    if (!game?.answers) return;
    const code = encodeChallenge({
      words: game.answers,
      attempts: game.won ? game.guesses.length : null,
      timeSeconds: game.won ? game.timeSeconds : null,
      name: username,
    });
    const url = `${window.location.origin}/games/termo?desafio=${code}`;
    const brag = game.won ? `Acertei em ${game.guesses.length} tentativas.` : "Não consegui acertar.";
    const result = await shareResult(`Te desafio no Letrado ${game.boardCount > 1 ? MODES.find((m) => m.count === game.boardCount)?.label : ""}! ${brag} Consegue fazer melhor?\n${url}`);
    if (result === "copied") setMessage("Link do desafio copiado!");
    if (result === "failed") setMessage("Não deu para compartilhar.");
  }

  const dailySwitch = (
    <div className="flex h-9 shrink-0 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] p-0.5">
      {(["daily", "infinite"] as PlayMode[]).map((m) => (
        <button
          key={m}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => changePlayMode(m)}
          aria-pressed={playMode === m && !extraMode}
          className={`rounded-lg px-2 text-xs font-bold transition sm:px-3 ${
            playMode === m && !extraMode ? "bg-[var(--game-termo)] text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          {m === "daily" ? "Diário" : "Infinito"}
        </button>
      ))}
    </div>
  );

  const header = (
    <GameHeader
      slug="termo"
      actions={
        <>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTutorialOpen(true)}
            aria-label="Como jogar"
            title="Como jogar"
            className={headerButtonClass}
          >
            <CircleHelp className="h-4 w-4" /> <span className="hidden lg:inline">Como jogar</span>
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setStatsOpen(true)}
            aria-label="Estatísticas"
            title="Estatísticas"
            className={headerButtonClass}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="Configurações"
              aria-expanded={settingsOpen}
              title="Configurações"
              className={headerButtonClass}
            >
              <Settings className="h-4 w-4" />
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                <div className="absolute right-0 top-11 z-50 flex w-64 flex-col gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-2 shadow-xl animate-[scaleIn_0.15s_ease-out]">
                  {[
                    {
                      label: "Modo difícil",
                      hint: "Letrado: use sempre as letras já descobertas. +5 moedas no Diário.",
                      on: hardPref,
                      toggle: toggleHard,
                    },
                    {
                      label: "Cores para daltônicos",
                      hint: "Laranja e azul no lugar de verde e amarelo.",
                      on: colorblind,
                      toggle: () => setColorblind(!colorblind),
                    },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      role="switch"
                      aria-checked={opt.on}
                      onClick={opt.toggle}
                      className="flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--bg)]"
                    >
                      <span>
                        <span className="block text-sm font-extrabold text-[var(--fg)]">{opt.label}</span>
                        <span className="block text-xs font-medium text-[var(--fg-muted)]">{opt.hint}</span>
                      </span>
                      <span
                        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                          opt.on ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                        }`}
                      >
                        <span className={`h-4 w-4 rounded-full bg-white shadow transition ${opt.on ? "translate-x-4" : ""}`} />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {dailySwitch}
        </>
      }
    />
  );

  const overlays = (
    <>
      {showTutorial && <TermoTutorial onClose={closeTutorial} />}
      {statsOpen && (
        <StatsModal
          initialMode={boardCount}
          highlightAttempts={game?.mode === "daily" && game.won ? game.guesses.length : null}
          onClose={() => setStatsOpen(false)}
        />
      )}
      {analysisOpen && game?.answers && (
        <AnalysisModal
          guesses={game.guesses}
          answers={game.answers}
          targets={targetWordPool}
          accents={accents}
          onClose={() => setAnalysisOpen(false)}
        />
      )}
    </>
  );

  const modeSelector = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {MODES.map((mode) => (
        <button
          key={mode.count}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => changeMode(mode.count)}
          aria-pressed={boardCount === mode.count && !extraMode}
          className={`rounded-xl border-2 px-4 py-1.5 text-xs font-extrabold uppercase transition lg:px-3 lg:py-1 ${
            boardCount === mode.count && !extraMode
              ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
          }`}
        >
          {mode.label}
        </button>
      ))}
      <span aria-hidden className="hidden h-5 w-0.5 rounded bg-[var(--border)] sm:block" />
      {(
        [
          { mode: "speed", label: "Contra o Tempo", Icon: Timer },
          { mode: "villain", label: "Vilão", Icon: Skull },
        ] as const
      ).map(({ mode, label, Icon }) => (
        <button
          key={mode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => openExtra(mode)}
          aria-pressed={extraMode === mode}
          className={`flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold uppercase transition lg:py-1 ${
            extraMode === mode
              ? "border-[var(--accent-dark)] bg-[var(--accent)] text-white"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );

  // sempre montado (leitor de tela anuncia mudancas); invisivel quando vazio
  const messageBox = (
    <p
      role="status"
      aria-live="polite"
      className={
        message
          ? "flex items-center gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-bold text-[var(--fg-muted)]"
          : "sr-only"
      }
    >
      {message}
    </p>
  );

  const root = (children: React.ReactNode) => (
    <div className="flex flex-1 flex-col" data-colorblind={colorblind ? "true" : undefined}>
      {header}
      {overlays}
      {children}
    </div>
  );

  if (extraMode) {
    return root(
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-4 px-3 pb-6 pt-3 sm:px-4">
        {modeSelector}
        {extraMode === "speed" ? (
          <SpeedGame
            acceptedWords={acceptedWords}
            accents={accents}
            onShare={share}
            message={message}
            setMessage={setMessage}
          />
        ) : (
          <VillainGame
            targets={targetWordPool}
            acceptedWords={acceptedWords}
            accents={accents}
            onShare={share}
            message={message}
            setMessage={setMessage}
          />
        )}
      </div>,
    );
  }

  if (status === "loading" || status === "error" || !game) {
    return root(
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-4 overflow-x-auto px-3 pb-6 pt-3 sm:gap-6 sm:px-4 sm:pb-8">
        {modeSelector}

        {status === "error" ? (
          <div className="flex max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <div className="text-5xl">📡</div>
            <h2 className="text-xl font-extrabold text-[var(--fg)]">Não foi possível carregar</h2>
            <p className="text-sm font-medium text-[var(--fg-muted)]">Confira sua conexão e tente de novo.</p>
            <button
              onClick={() =>
                targetWordPool.length > 0 ? startGame(targetWordPool, boardCount, playMode) : location.reload()
              }
              className="rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-3 sm:gap-8">
              {Array.from({ length: boardCount }).map((_, boardIndex) => (
                <div key={boardIndex} className="flex shrink-0 flex-col gap-1.5 sm:gap-2.5">
                  {Array.from({ length: maxAttemptsFor(boardCount) }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex gap-1.5 sm:gap-2">
                      {Array.from({ length: WORD_LENGTH }).map((_, i) => (
                        <div
                          key={i}
                          className={`animate-pulse rounded-xl border-2 border-[var(--border)] bg-[var(--border)]/40 ${
                            boardCount === 4
                              ? "h-9 w-9 sm:h-12 sm:w-12"
                              : boardCount === 2
                                ? "h-11 w-11 sm:h-14 sm:w-14"
                                : "h-12 w-12 sm:h-16 sm:w-16"
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-1.5 sm:gap-2.5">
              {KEY_ROWS.map((row, i) => (
                <div key={i} className="flex gap-1 sm:gap-2">
                  {row.map((key) => (
                    <div
                      key={key}
                      className={`animate-pulse rounded-lg bg-[var(--border)]/40 ${
                        key === "Enter" || key === "Back" ? "h-11 px-3 sm:h-14 sm:px-5" : "h-11 min-w-8 sm:h-14 sm:min-w-11"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>,
    );
  }

  if (game.alreadyPlayed) {
    return root(
      <div className="flex flex-1 flex-col items-center gap-6 px-4 pb-8 pt-3">
        {modeSelector}
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <div className="text-5xl">{game.won ? "🎉" : "😔"}</div>
          <h2 className="text-xl font-extrabold text-[var(--fg)]">Você já jogou o diário de hoje!</h2>
          {game.answers && (
            <p className="text-sm font-semibold text-[var(--fg-muted)]">
              {game.answers.length > 1 ? "As palavras eram" : "A palavra era"}{" "}
              <span className="font-extrabold uppercase text-[var(--fg)]">
                {game.answers.map((a) => withAccents(a, accents)).join(", ")}
              </span>
            </p>
          )}
          <NextWordCountdown />
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-3">
              <span className="text-xl font-extrabold text-[var(--primary)]">{game.guesses.length || "–"}</span>
              <span className="text-xs font-bold uppercase text-[var(--fg-muted)]">Tentativas</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-3">
              <span className="text-xl font-extrabold text-[var(--accent)]">{formatTime(game.timeSeconds)}</span>
              <span className="text-xs font-bold uppercase text-[var(--fg-muted)]">Tempo</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {game.guesses.length > 0 && (
              <>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleShare}
                  className="flex items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-extrabold text-[var(--fg)] transition hover:bg-[var(--bg)]"
                >
                  <Share2 className="h-4 w-4" /> Compartilhar
                </button>
                {game.answers && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setAnalysisOpen(true)}
                    className="flex items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-extrabold text-[var(--fg)] transition hover:bg-[var(--bg)]"
                  >
                    Análise
                  </button>
                )}
              </>
            )}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changePlayMode("infinite")}
              className="rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
            >
              Jogar modo infinito
            </button>
          </div>
          {messageBox}
        </div>
      </div>,
    );
  }

  const canHint = status === "playing" && nextHintTarget(game) !== null;
  const lastRow = game.guesses.length - 1;

  return root(
    <div
      style={cellStyle(boardCount)}
      className={`relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-between overflow-x-auto px-3 sm:gap-6 sm:px-4 sm:pb-8 sm:pt-3 lg:gap-3 lg:overflow-visible lg:pb-4 lg:pt-3 ${boardCount === 4 ? "gap-1 pb-1 pt-1" : "gap-4 pb-6 pt-3"}`}
    >
      <div className={`flex flex-col items-center sm:gap-6 lg:mt-6 lg:flex-1 lg:justify-start lg:gap-3 ${boardCount === 4 ? "gap-1.5" : "gap-4"}`}>
        {modeSelector}

        {(game.hard || game.challenge) && (
          <div className="flex flex-wrap justify-center gap-2 text-xs font-extrabold uppercase">
            {game.hard && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--danger-bg)] px-2.5 py-1 text-[var(--danger)]">
                <Skull className="h-3.5 w-3.5" /> Modo difícil
              </span>
            )}
            {game.challenge && (
              <span className="rounded-full bg-[var(--bg)] px-2.5 py-1 text-[var(--primary)]">
                Desafio de {game.challenge.name ?? "um amigo"}
              </span>
            )}
          </div>
        )}

        <Boards
          boardCount={game.boardCount}
          guesses={game.guesses}
          evals={game.evals}
          currentLetters={input.letters}
          cursor={input.cursor}
          revealRowIndex={revealRowIndex}
          shakeRow={input.shake}
          editable={status === "playing"}
          onCellClick={input.setCursor}
          hints={game.hints}
          accents={accents}
          bounceRowIndex={game.won && status !== "playing" ? lastRow : null}
        />

        <div className="flex flex-wrap items-center justify-center gap-2">
          {messageBox}
          {canHint && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleHint}
              disabled={hintBusy || (!!user && coins < HINT_PRICE)}
              title={user ? `Revela uma letra por ${HINT_PRICE} moedas` : "Entre na sua conta para usar dicas"}
              className="flex items-center gap-1.5 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-extrabold text-[var(--fg-muted)] transition hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Lightbulb className="h-4 w-4 text-[var(--termo-present)]" /> Dica · {HINT_PRICE}
            </button>
          )}
        </div>
      </div>

      <Keyboard boardCount={game.boardCount} keyStates={keyStates} onKey={input.handleKey} />

      {status === "won" && <Confetti />}

      <WinModal
        open={status === "won" || status === "lost"}
        won={status === "won"}
        attempts={game.guesses.length}
        boardCount={game.boardCount}
        timeString={formatTime(game.timeSeconds)}
        leaderboardRefresh={leaderboardRefresh}
        currentStreak={game.mode === "daily" && game.streak !== null ? game.streak : undefined}
        coinsAwarded={game.coinsAwarded}
        answers={(game.answers ?? []).map((a) => withAccents(a, accents))}
        showLeaderboard={game.mode === "daily"}
        loginHint={game.mode === "daily" && !userId}
        shareFeedback={message}
        onShare={handleShare}
        onPlayAgain={() =>
          game.mode === "daily" ? changePlayMode("infinite") : startGame(targetWordPool, boardCount, "infinite")
        }
        playAgainLabel={game.mode === "daily" ? "Jogar modo infinito" : "Jogar novamente"}
        showCountdown={game.mode === "daily"}
        achievements={game.achievements}
        shieldsUsed={game.shieldsUsed}
        onAnalyze={game.answers ? () => setAnalysisOpen(true) : undefined}
        onChallenge={game.mode === "infinite" ? handleChallenge : undefined}
        challenger={game.challenge}
      />
    </div>,
  );
}
