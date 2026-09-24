"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Grid3x3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { claimTermoWinReward } from "@/lib/inventory";
import { WinModal } from "./WinModal";

const WORD_LENGTH = 5;
type BoardCount = 1 | 2 | 4;
type PlayMode = "daily" | "infinite";

type LetterState = "correct" | "present" | "absent" | "empty";

interface EvaluatedLetter {
  letter: string;
  state: LetterState;
}

interface DailyResult {
  won: boolean;
  attempts: number;
  timeSeconds: number;
  targetWords: string[];
}

const OFFENSIVE_TARGET_WORDS = new Set([
  "buceta",
  "caceta",
  "cacete",
  "cralho",
  "piroca",
  "punheta",
  "corno",
  "putao",
  "putas",
  "veado",
  "bicha",
  "baitola",
  "escrota",
  "escroto",
  "fdp",
  "otaria",
  "otario",
  "viado",
  "xoxota",
  "arrombado",
  "arrombada",
  "babaca",
  "idiota",
  "estupro",
  "retardado",
  "retardada",
  "negrofobico",
  "pinto",
  "pinta",
  "penis",
  "vulva",
  "anus",
  "cu",
  "cus",
  "seios",
  "vagina",
  "testiculo",
  "anais",
  "xibiu",
  "bunda",
]);

function filterOffensive(pool: string[]) {
  return pool.filter((w) => !OFFENSIVE_TARGET_WORDS.has(w));
}

const MODES: { count: BoardCount; label: string }[] = [
  { count: 1, label: "Termo" },
  { count: 2, label: "Dueto" },
  { count: 4, label: "Quarteto" },
];

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Enter", "Z", "X", "C", "V", "B", "N", "M", "Back"],
];

function maxAttemptsFor(boardCount: BoardCount) {
  return boardCount + 5;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function hashString(s: string) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Conta letras (unicas) compartilhadas entre duas palavras, ignorando posicao.
function sharedLetterCount(a: string, b: string): number {
  const setB = new Set(b);
  let shared = 0;
  for (const letter of new Set(a)) {
    if (setB.has(letter)) shared++;
  }
  return shared;
}

// Conta quantas posicoes tem a mesma letra nas duas palavras (ex: JOIAS vs JOGAS = J,O,A,S nas mesmas posicoes = 4).
function samePositionCount(a: string, b: string): number {
  let same = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) same++;
  }
  return same;
}

// Recusa combinar palavras muito parecidas (ex: JOIAS/JOGAS/JOVAS: so 1 letra muda de lugar em lugar),
// pra evitar tabuleiros de Dueto/Quarteto onde uma dica resolve varias palavras de uma vez.
const MAX_SHARED_LETTERS = 1;
const MAX_SAME_POSITION = 0;

function tooSimilarToAny(candidate: string, chosen: string[]): boolean {
  return chosen.some(
    (w) => sharedLetterCount(candidate, w) > MAX_SHARED_LETTERS || samePositionCount(candidate, w) > MAX_SAME_POSITION,
  );
}

function pickDailyWords(pool: string[], boardCount: BoardCount, date: string): string[] {
  const words: string[] = [];
  const used = new Set<string>();
  let offset = 0;
  let skippedForSimilarity = 0;
  const maxSkips = pool.length * 4;

  while (words.length < boardCount) {
    const idx = hashString(`${date}-${boardCount}-${offset}`) % pool.length;
    const w = pool[idx];
    offset++;

    if (used.has(w)) continue;

    // Depois de tentar demais achar palavra distinta, desiste do criterio de similaridade
    // pra nao travar em pools pequenos.
    if (skippedForSimilarity < maxSkips && tooSimilarToAny(w, words)) {
      skippedForSimilarity++;
      continue;
    }

    used.add(w);
    words.push(w);
  }
  return words;
}

function pickRandomWords(pool: string[], boardCount: BoardCount): string[] {
  const words: string[] = [];
  const used = new Set<string>();
  let skippedForSimilarity = 0;
  const maxSkips = pool.length * 4;

  while (words.length < boardCount) {
    const w = pool[Math.floor(Math.random() * pool.length)];

    if (used.has(w)) continue;

    if (skippedForSimilarity < maxSkips && tooSimilarToAny(w, words)) {
      skippedForSimilarity++;
      continue;
    }

    used.add(w);
    words.push(w);
  }
  return words;
}

function getAnonKey() {
  let key = localStorage.getItem("termo_anon_key");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("termo_anon_key", key);
  }
  return key;
}

interface DailyProgress {
  date: string;
  boardCount: BoardCount;
  targetWords: string[];
  rawGuesses: string[];
  startedAt: number;
}

function dailyProgressKey(boardCount: BoardCount) {
  return `termo_daily_progress_${boardCount}`;
}

function loadDailyProgress(boardCount: BoardCount): DailyProgress | null {
  const raw = localStorage.getItem(dailyProgressKey(boardCount));
  if (!raw) return null;
  try {
    const parsed: DailyProgress = JSON.parse(raw);
    if (parsed.date !== todayString() || parsed.boardCount !== boardCount) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDailyProgress(progress: DailyProgress) {
  localStorage.setItem(dailyProgressKey(progress.boardCount), JSON.stringify(progress));
}

function clearDailyProgress(boardCount: BoardCount) {
  localStorage.removeItem(dailyProgressKey(boardCount));
}

function evaluateGuess(guess: string, target: string): LetterState[] {
  const result: LetterState[] = Array(WORD_LENGTH).fill("absent");
  const letterCount: Record<string, number> = {};

  for (const letter of target) {
    letterCount[letter] = (letterCount[letter] ?? 0) + 1;
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
      letterCount[guess[i]]--;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "absent" && letterCount[guess[i]] > 0) {
      result[i] = "present";
      letterCount[guess[i]]--;
    }
  }

  return result;
}

const STATE_PRIORITY: Record<LetterState, number> = { correct: 3, present: 2, absent: 1, empty: 0 };

function setKeyBoardState(
  store: Record<string, LetterState[]>,
  letter: string,
  boardIndex: number,
  count: number,
  state: LetterState,
) {
  const arr = store[letter] ?? Array(count).fill("empty");
  if (STATE_PRIORITY[state] > STATE_PRIORITY[arr[boardIndex] ?? "empty"]) {
    arr[boardIndex] = state;
  }
  store[letter] = arr;
}

export function TermoGame() {
  const { user, refreshProfile } = useAuth();
  const [playMode, setPlayMode] = useState<PlayMode>("daily");
  const [boardCount, setBoardCount] = useState<BoardCount>(1);
  const [targetWordPool, setTargetWordPool] = useState<string[]>([]);
  const [acceptedWords, setAcceptedWords] = useState<Set<string>>(new Set());
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [boardGuesses, setBoardGuesses] = useState<EvaluatedLetter[][][]>([]);
  const [rawGuesses, setRawGuesses] = useState<string[]>([]);
  const [currentLetters, setCurrentLetters] = useState<string[]>(Array(WORD_LENGTH).fill(""));
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<"loading" | "playing" | "won" | "lost">("loading");
  const [alreadyPlayedToday, setAlreadyPlayedToday] = useState<DailyResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shakeRow, setShakeRow] = useState(false);
  const startTimeRef = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [currentStreak, setCurrentStreak] = useState<number | undefined>(undefined);
  const [keyStatesVersion, setKeyStatesVersion] = useState(0);
  const keyStates = useRef<Record<string, LetterState[]>>({});
  const [revealRowIndex, setRevealRowIndex] = useState<number | null>(null);

  const checkDailyPlayed = useCallback(
    async (count: BoardCount): Promise<DailyResult | null> => {
      const date = todayString();
      const supabase = createClient();

      if (user) {
        const { data } = await supabase
          .from("termo_daily_results")
          .select("won, attempts, time_seconds")
          .eq("user_id", user.id)
          .eq("board_count", count)
          .eq("play_date", date)
          .maybeSingle();
        if (data) return { won: data.won, attempts: data.attempts, timeSeconds: data.time_seconds, targetWords: [] };
        return null;
      }

      const anonKey = getAnonKey();
      const { data } = await supabase
        .from("termo_daily_results")
        .select("won, attempts, time_seconds")
        .eq("anon_key", anonKey)
        .eq("board_count", count)
        .eq("play_date", date)
        .maybeSingle();
      if (data) return { won: data.won, attempts: data.attempts, timeSeconds: data.time_seconds, targetWords: [] };
      return null;
    },
    [user],
  );

  const startGame = useCallback(
    async (pool: string[], count: BoardCount, mode: PlayMode) => {
      setStatus("loading");
      setAlreadyPlayedToday(null);

      if (mode === "daily") {
        const played = await checkDailyPlayed(count);
        if (played) {
          clearDailyProgress(count);
          setAlreadyPlayedToday(played);
          setBoardCount(count);
          setPlayMode(mode);
          setStatus("playing");
          return;
        }
      }

      const words =
        mode === "daily" ? pickDailyWords(pool, count, todayString()) : pickRandomWords(pool, count);

      const savedProgress = mode === "daily" ? loadDailyProgress(count) : null;
      const restoredGuesses = savedProgress?.rawGuesses ?? [];

      setBoardCount(count);
      setPlayMode(mode);
      setTargetWords(words);
      keyStates.current = {};
      const restoredBoardGuesses: EvaluatedLetter[][][] = Array.from({ length: count }, () => []);
      for (const guess of restoredGuesses) {
        words.forEach((target, boardIndex) => {
          const states = evaluateGuess(guess, target);
          const evaluated: EvaluatedLetter[] = guess.split("").map((letter, i) => ({ letter, state: states[i] }));
          restoredBoardGuesses[boardIndex].push(evaluated);
          for (let i = 0; i < WORD_LENGTH; i++) {
            setKeyBoardState(keyStates.current, guess[i], boardIndex, count, states[i]);
          }
        });
      }
      setBoardGuesses(restoredBoardGuesses);
      setRawGuesses(restoredGuesses);
      setRevealRowIndex(null);
      setCurrentLetters(Array(WORD_LENGTH).fill(""));
      setCursor(0);
      setStatus("playing");
      setMessage(null);
      setKeyStatesVersion((v) => v + 1);
      startTimeRef.current = savedProgress?.startedAt ?? Date.now();

      if (mode === "daily" && !savedProgress) {
        saveDailyProgress({
          date: todayString(),
          boardCount: count,
          targetWords: words,
          rawGuesses: [],
          startedAt: startTimeRef.current,
        });
      }
    },
    [checkDailyPlayed],
  );

  useEffect(() => {
    Promise.all([
      fetch("/words5_target.txt").then((res) => res.text()),
      fetch("/words5_accepted.txt").then((res) => res.text()),
    ]).then(([targetText, acceptedText]) => {
      const parse = (text: string) =>
        text
          .split("\n")
          .map((w) => w.trim().toLowerCase())
          .filter((w) => w.length === WORD_LENGTH);

      const targets = filterOffensive(parse(targetText));
      const accepted = new Set(filterOffensive(parse(acceptedText)));

      setTargetWordPool(targets);
      setAcceptedWords(accepted);
      startGame(targets, 1, "daily");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeMode = useCallback(
    (count: BoardCount) => {
      if (targetWordPool.length > 0) startGame(targetWordPool, count, playMode);
    },
    [targetWordPool, playMode, startGame],
  );

  const changePlayMode = useCallback(
    (mode: PlayMode) => {
      if (targetWordPool.length > 0) startGame(targetWordPool, boardCount, mode);
    },
    [targetWordPool, boardCount, startGame],
  );

  const submitGuess = useCallback(() => {
    const currentGuess = currentLetters.join("");
    const maxAttempts = maxAttemptsFor(boardCount);

    if (currentGuess.length < WORD_LENGTH) {
      setShakeRow(true);
      setMessage("Palavra incompleta");
      setTimeout(() => setShakeRow(false), 400);
      return;
    }

    if (!acceptedWords.has(currentGuess)) {
      setShakeRow(true);
      setMessage("Palavra nao esta na lista");
      setTimeout(() => setShakeRow(false), 400);
      return;
    }

    setMessage(null);

    const submittedRowIndex = rawGuesses.length;
    const newRawGuesses = [...rawGuesses, currentGuess];
    setRawGuesses(newRawGuesses);
    setRevealRowIndex(submittedRowIndex);

    const newBoardGuesses = targetWords.map((target, boardIndex) => {
      const alreadySolved = rawGuesses.includes(target);
      const states = evaluateGuess(currentGuess, target);

      for (let i = 0; i < WORD_LENGTH; i++) {
        setKeyBoardState(keyStates.current, currentGuess[i], boardIndex, boardCount, states[i]);
      }

      if (alreadySolved) return boardGuesses[boardIndex];

      const evaluated: EvaluatedLetter[] = currentGuess
        .split("")
        .map((letter, i) => ({ letter, state: states[i] }));
      return [...boardGuesses[boardIndex], evaluated];
    });
    setBoardGuesses(newBoardGuesses);
    setKeyStatesVersion((v) => v + 1);

    setCurrentLetters(Array(WORD_LENGTH).fill(""));
    setCursor(0);

    const secondsTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setElapsedSeconds(secondsTaken);

    const allSolved = targetWords.every((target) => newRawGuesses.includes(target));
    const outOfAttempts = newRawGuesses.length === maxAttempts;

    if (playMode === "daily") {
      saveDailyProgress({
        date: todayString(),
        boardCount,
        targetWords,
        rawGuesses: newRawGuesses,
        startedAt: startTimeRef.current,
      });
    }

    if (allSolved || outOfAttempts) {
      const revealDuration = WORD_LENGTH * 200 + 500;
      setTimeout(() => {
        setStatus(allSolved ? "won" : "lost");
      }, revealDuration);
      if (playMode === "daily") {
        recordDailyResult(allSolved, newRawGuesses.length, secondsTaken);
      }
    }
  }, [currentLetters, rawGuesses, boardGuesses, targetWords, acceptedWords, boardCount, playMode]);

  const recordDailyResult = useCallback(
    async (won: boolean, attempts: number, timeSeconds: number) => {
      const supabase = createClient();
      const date = todayString();
      const anonKey = user ? null : getAnonKey();

      const { error: insertError } = await supabase.from("termo_daily_results").insert({
        user_id: user?.id ?? null,
        anon_key: anonKey,
        board_count: boardCount,
        play_date: date,
        won,
        attempts,
        time_seconds: timeSeconds,
      });
      if (insertError) console.error("Erro ao salvar resultado diario:", insertError);

      const filter = user ? { column: "user_id", value: user.id } : null;

      const query = supabase
        .from("termo_scores")
        .select("attempts, time_seconds, wins, current_streak, best_streak")
        .eq("board_count", boardCount);
      const { data: existing, error: selectError } = filter
        ? await query.eq(filter.column, filter.value).maybeSingle()
        : await query.is("user_id", null).maybeSingle();
      if (selectError) console.error("Erro ao ler score:", selectError);

      const prevWins = existing?.wins ?? 0;
      const prevStreak = existing?.current_streak ?? 0;
      const prevBestStreak = existing?.best_streak ?? 0;

      const nextWins = prevWins + (won ? 1 : 0);
      const nextStreak = won ? prevStreak + 1 : 0;
      const nextBestStreak = Math.max(prevBestStreak, nextStreak);

      const isBetterScore =
        won &&
        (!existing ||
          existing.attempts === 999 ||
          attempts < existing.attempts ||
          (attempts === existing.attempts && timeSeconds < existing.time_seconds));

      const payload = {
        board_count: boardCount,
        wins: nextWins,
        current_streak: nextStreak,
        best_streak: nextBestStreak,
        last_played_date: date,
        ...(isBetterScore ? { attempts, time_seconds: timeSeconds } : {}),
      };

      const { error: writeError } = existing
        ? filter
          ? await supabase
              .from("termo_scores")
              .update(payload)
              .eq(filter.column, filter.value)
              .eq("board_count", boardCount)
          : await supabase.from("termo_scores").update(payload).is("user_id", null).eq("board_count", boardCount)
        : await supabase
            .from("termo_scores")
            .insert({ user_id: user?.id ?? null, attempts, time_seconds: timeSeconds, ...payload });
      if (writeError) console.error("Erro ao salvar score:", writeError);

      if (won && user) {
        try {
          await claimTermoWinReward(boardCount, date);
          await refreshProfile();
        } catch (err) {
          console.error("Erro ao dar moedas:", err);
        }
      }

      clearDailyProgress(boardCount);
      setCurrentStreak(nextStreak);
      setLeaderboardRefresh((n) => n + 1);
    },
    [user, boardCount, refreshProfile],
  );

  const handleKey = useCallback(
    (key: string) => {
      if (status !== "playing") return;

      if (key === "Enter") {
        submitGuess();
        return;
      }

      if (key === "Back") {
        setCurrentLetters((letters) => {
          const next = [...letters];
          if (next[cursor]) {
            next[cursor] = "";
            return next;
          }
          const prev = Math.max(0, cursor - 1);
          next[prev] = "";
          setCursor(prev);
          return next;
        });
        return;
      }

      if (/^[a-zA-Z]$/.test(key)) {
        setCurrentLetters((letters) => {
          const next = [...letters];
          next[cursor] = key.toLowerCase();
          return next;
        });
        setCursor((c) => {
          for (let i = c + 1; i < WORD_LENGTH; i++) {
            if (!currentLetters[i]) return i;
          }
          return Math.min(c + 1, WORD_LENGTH - 1);
        });
      }
    },
    [cursor, currentLetters, status, submitGuess],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Backspace") handleKey("Back");
      else if (e.key === "Enter") handleKey("Enter");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  const cellClasses: Record<LetterState, string> = {
    correct: "bg-[#8bbf6f] border-[#749f5c] text-white shadow-[0_4px_0_#749f5c]",
    present: "bg-[#e0c26e] border-[#c2a558] text-white shadow-[0_4px_0_#c2a558]",
    absent: "bg-[var(--fg-muted)] border-[var(--border-hover)] text-white",
    empty: "border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
  };

  const keySliceBg: Record<LetterState, string> = {
    correct: "bg-[#8bbf6f]",
    present: "bg-[#e0c26e]",
    absent: "bg-[var(--border-hover)]",
    empty: "bg-[var(--border)]",
  };

  const keyClasses: Record<LetterState, string> = {
    correct: "bg-[#8bbf6f] text-white shadow-[0_3px_0_#749f5c]",
    present: "bg-[#e0c26e] text-white shadow-[0_3px_0_#c2a558]",
    absent: "bg-[var(--border-hover)] text-white",
    empty: "bg-[var(--border)] text-[var(--fg)] hover:bg-[var(--border-hover)]",
  };

  const dailySwitch = (
    <div className="flex gap-1 sm:gap-2">
      {(["daily", "infinite"] as PlayMode[]).map((m) => (
        <button
          key={m}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => changePlayMode(m)}
          className={`rounded-lg border-2 px-2 py-1 text-[10px] font-extrabold uppercase transition sm:rounded-xl sm:px-4 sm:py-1.5 sm:text-xs lg:px-3 lg:py-1 ${
            playMode === m
              ? "border-[var(--accent-dark)] bg-[var(--accent)] text-white"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
          }`}
        >
          {m === "daily" ? "Diário" : "Infinito"}
        </button>
      ))}
    </div>
  );

  const header = (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--border)] bg-[var(--card)] px-3 py-2.5 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--fg-muted)] transition hover:bg-[var(--bg)] sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Hub</span>
        </Link>

        <h1 className="flex min-w-0 shrink items-center gap-1.5 text-sm font-extrabold tracking-tight text-[var(--fg)] sm:gap-2.5 sm:text-lg">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white sm:h-9 sm:w-9 sm:rounded-xl">
            <Grid3x3 className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="truncate">Termo</span>
        </h1>

        <div className="flex shrink-0 justify-end">{dailySwitch}</div>
      </div>
    </header>
  );

  const modeSelector = (
    <div className="flex gap-2">
      {MODES.map((mode) => (
        <button
          key={mode.count}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => changeMode(mode.count)}
          className={`rounded-xl border-2 px-4 py-1.5 text-xs font-extrabold uppercase transition lg:px-3 lg:py-1 ${
            boardCount === mode.count
              ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-4 overflow-x-auto px-3 pb-6 pt-3 sm:gap-6 sm:px-4 sm:pb-8">
        {modeSelector}

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
              {row.map((key) => {
                const isWide = key === "Enter" || key === "Back";
                return (
                  <div
                    key={key}
                    className={`animate-pulse rounded-lg bg-[var(--border)]/40 ${
                      isWide ? "h-11 px-3 sm:h-14 sm:px-5" : "h-11 min-w-8 sm:h-14 sm:min-w-11"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        </div>
      </div>
    );
  }

  if (alreadyPlayedToday) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <div className="flex flex-1 flex-col items-center gap-6 pb-8 pt-3">
        {modeSelector}
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <div className="text-5xl">{alreadyPlayedToday.won ? "🎉" : "😔"}</div>
          <h2 className="text-xl font-extrabold text-[var(--fg)]">Você já jogou o diário de hoje!</h2>
          <p className="text-sm font-medium text-[var(--fg-muted)]">Volte amanhã para uma nova palavra.</p>
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-3">
              <span className="text-xl font-extrabold text-[var(--primary)]">{alreadyPlayedToday.attempts}</span>
              <span className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">Tentativas</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-3">
              <span className="text-xl font-extrabold text-[var(--accent)]">
                {Math.floor(alreadyPlayedToday.timeSeconds / 60)}m {alreadyPlayedToday.timeSeconds % 60}s
              </span>
              <span className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">Tempo</span>
            </div>
          </div>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changePlayMode("infinite")}
            className="rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
          >
            Jogar modo infinito
          </button>
        </div>
        </div>
      </div>
    );
  }

  const maxAttempts = maxAttemptsFor(boardCount);

  // Tamanho de célula calculado p/ caber tudo (board + teclado) sem scroll no desktop,
  // dividindo o espaço disponível pelas linhas (altura) e colunas totais (largura).
  const cellVh = boardCount === 4 ? 4.2 : boardCount === 2 ? 5.2 : 6.1;
  const cellVw = boardCount === 4 ? 4.4 : boardCount === 2 ? 6.5 : 9.5;
  const cellStyle = { "--cell": `clamp(2.25rem, min(${cellVw}vw, ${cellVh}vh), 4rem)` } as React.CSSProperties;

  return (
    <div className="flex flex-1 flex-col">
      {header}
      <div
        style={cellStyle}
        className={`relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-between overflow-x-auto px-3 sm:gap-6 sm:px-4 sm:pb-8 sm:pt-3 lg:gap-3 lg:overflow-visible lg:pb-4 lg:pt-3 ${boardCount === 4 ? "gap-1 pb-1 pt-1" : "gap-4 pb-6 pt-3"}`}
      >
      <div className={`flex flex-col items-center sm:gap-6 lg:mt-6 lg:flex-1 lg:justify-start lg:gap-3 ${boardCount === 4 ? "gap-1.5" : "gap-4"}`}>
      {modeSelector}

      <div
        className={
          boardCount === 4
            ? "grid grid-cols-2 gap-x-2 gap-y-1 sm:flex sm:justify-center sm:gap-8 lg:gap-4"
            : `flex justify-center sm:gap-8 lg:gap-4 gap-4`
        }
      >
        {targetWords.map((target, boardIndex) => {
          const boardSolved = rawGuesses.includes(target);
          return (
          <div key={boardIndex} className={`flex shrink-0 flex-col transition-opacity sm:gap-2.5 lg:gap-1.5 ${boardCount === 4 ? "gap-[3px]" : "gap-1.5"} ${boardSolved ? "opacity-60" : ""}`}>
            {Array.from({ length: maxAttempts }).map((_, rowIndex) => {
              const isCurrentRow = rowIndex === rawGuesses.length && !boardSolved;
              const rowLetters = boardGuesses[boardIndex]?.[rowIndex]
                ? boardGuesses[boardIndex][rowIndex]
                : isCurrentRow
                  ? currentLetters.map((l) => ({ letter: l, state: "empty" as LetterState }))
                  : Array.from({ length: WORD_LENGTH }, () => ({ letter: "", state: "empty" as LetterState }));

              return (
                <div
                  key={rowIndex}
                  className={`flex sm:gap-2 lg:gap-1.5 ${boardCount === 4 ? "gap-1" : "gap-1"} ${isCurrentRow && shakeRow ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
                >
                  {rowLetters.map((cell, i) => {
                    const isRevealing = rowIndex === revealRowIndex && cell.state !== "empty";
                    const sizeClasses =
                      boardCount === 4
                        ? "h-[min(8vw,3.7vh)] w-[min(8vw,3.7vh)] text-[10px] sm:h-12 sm:w-12 sm:text-xl lg:h-[var(--cell)] lg:w-[var(--cell)] lg:text-lg"
                        : boardCount === 2
                          ? "h-[7.8vw] w-[7.8vw] text-sm sm:h-14 sm:w-14 sm:text-2xl lg:h-[var(--cell)] lg:w-[var(--cell)] lg:text-xl"
                          : "h-12 w-12 text-2xl sm:h-16 sm:w-16 sm:text-3xl lg:h-[var(--cell)] lg:w-[var(--cell)] lg:text-2xl";

                    if (isRevealing) {
                      return (
                        <div key={i} className={`relative ${sizeClasses}`} style={{ perspective: "400px" }}>
                          <div
                            className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 font-extrabold uppercase ${cellClasses["empty"]}`}
                            style={{
                              animation: "flipRevealFront 0.5s ease-in both",
                              animationDelay: `${i * 200}ms`,
                              backfaceVisibility: "hidden",
                            }}
                          >
                            {cell.letter}
                          </div>
                          <div
                            className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 font-extrabold uppercase ${cellClasses[cell.state]}`}
                            style={{
                              animation: "flipRevealBack 0.5s ease-out both",
                              animationDelay: `${i * 200}ms`,
                              backfaceVisibility: "hidden",
                            }}
                          >
                            {cell.letter}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={i}
                        onClick={() => isCurrentRow && status === "playing" && setCursor(i)}
                        className={`flex items-center justify-center rounded-xl border-2 font-extrabold uppercase transition-all duration-200 ${sizeClasses} ${cellClasses[cell.state]} ${
                          isCurrentRow && cursor === i
                            ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40 scale-105"
                            : ""
                        } ${cell.letter && cell.state === "empty" ? "scale-105 border-[var(--fg-muted)]" : ""} ${
                          isCurrentRow ? "cursor-pointer" : ""
                        }`}
                      >
                        {cell.letter}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          );
        })}
      </div>

      {message && (
        <p className="flex items-center gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-bold text-[var(--fg-muted)]">
          {message}
        </p>
      )}
      </div>

      <div className={`flex shrink-0 flex-col items-center sm:gap-2.5 lg:gap-1.5 ${boardCount === 4 ? "gap-1" : "gap-1.5"}`}>
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="flex gap-1 sm:gap-2 lg:gap-1.5">
            {row.map((key) => {
              const isWide = key === "Enter" || key === "Back";
              const isLetter = !isWide;
              const boardStates = isLetter
                ? (keyStates.current[key.toLowerCase()] ?? Array(boardCount).fill("empty"))
                : null;
              const soloState = boardStates ? boardStates[0] : "empty";

              if (isLetter && boardCount > 1 && boardStates) {
                return (
                  <button
                    key={key}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleKey(key)}
                    className={`relative min-w-8 overflow-hidden rounded-lg text-xs font-extrabold uppercase text-white transition active:scale-95 sm:h-14 sm:min-w-11 sm:text-sm lg:h-11 lg:min-w-9 ${boardCount === 4 ? "h-9" : "h-11"}`}
                  >
                    <div className={`absolute inset-0 grid ${boardCount === 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-2"}`}>
                      {boardStates.map((s, i) => (
                        <div key={i} className={keySliceBg[s]} />
                      ))}
                    </div>
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {key}
                    </span>
                  </button>
                );
              }

              const state = isLetter ? soloState : "empty";
              return (
                <button
                  key={key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKey(key)}
                  className={`rounded-lg text-xs font-extrabold uppercase transition active:scale-95 sm:text-sm ${keyClasses[state]} ${
                    isWide
                      ? `px-3 sm:px-5 sm:py-4 lg:py-3 ${boardCount === 4 ? "py-2" : "py-3"}`
                      : `min-w-8 px-2 sm:min-w-11 sm:px-3 sm:py-4 lg:min-w-9 lg:py-3 ${boardCount === 4 ? "py-2" : "py-3"}`
                  }`}
                >
                  {key === "Back" ? "⌫" : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <WinModal
        open={status === "won" || status === "lost"}
        won={status === "won"}
        attempts={rawGuesses.length}
        timeString={`${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`}
        leaderboardRefresh={leaderboardRefresh}
        currentStreak={playMode === "daily" ? currentStreak : undefined}
        targetWord={targetWords.join(", ")}
        showLeaderboard={playMode === "daily"}
        boardCount={boardCount}
        onPlayAgain={() => startGame(targetWordPool, boardCount, playMode)}
      />
      </div>
    </div>
  );
}
