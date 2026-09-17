"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
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

function pickDailyWords(pool: string[], boardCount: BoardCount, date: string): string[] {
  const words: string[] = [];
  const used = new Set<string>();
  let offset = 0;
  while (words.length < boardCount) {
    const idx = hashString(`${date}-${boardCount}-${offset}`) % pool.length;
    const w = pool[idx];
    if (!used.has(w)) {
      used.add(w);
      words.push(w);
    }
    offset++;
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

export function TermoGame() {
  const { user } = useAuth();
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
  const keyStates = useRef<Record<string, LetterState>>({});

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
        mode === "daily"
          ? pickDailyWords(pool, count, todayString())
          : (() => {
              const list: string[] = [];
              const used = new Set<string>();
              while (list.length < count) {
                const w = pool[Math.floor(Math.random() * pool.length)];
                if (!used.has(w)) {
                  used.add(w);
                  list.push(w);
                }
              }
              return list;
            })();

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
            const letter = guess[i];
            const prev = keyStates.current[letter];
            const next = states[i];
            if (STATE_PRIORITY[next] > STATE_PRIORITY[prev ?? "empty"]) {
              keyStates.current[letter] = next;
            }
          }
        });
      }
      setBoardGuesses(restoredBoardGuesses);
      setRawGuesses(restoredGuesses);
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

      console.log(`Palavra${count > 1 ? "s" : ""} secreta${count > 1 ? "s" : ""}:`, words.join(", "));
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

      const targets = parse(targetText);
      const accepted = new Set(parse(acceptedText));

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

    const newRawGuesses = [...rawGuesses, currentGuess];
    setRawGuesses(newRawGuesses);

    const newBoardGuesses = targetWords.map((target, boardIndex) => {
      const states = evaluateGuess(currentGuess, target);
      const evaluated: EvaluatedLetter[] = currentGuess
        .split("")
        .map((letter, i) => ({ letter, state: states[i] }));

      for (let i = 0; i < WORD_LENGTH; i++) {
        const letter = currentGuess[i];
        const prev = keyStates.current[letter];
        const next = states[i];
        if (STATE_PRIORITY[next] > STATE_PRIORITY[prev ?? "empty"]) {
          keyStates.current[letter] = next;
        }
      }

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

    if (allSolved) {
      setStatus("won");
      if (playMode === "daily") recordDailyResult(true, newRawGuesses.length, secondsTaken);
    } else if (outOfAttempts) {
      setStatus("lost");
      if (playMode === "daily") recordDailyResult(false, newRawGuesses.length, secondsTaken);
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

      clearDailyProgress(boardCount);
      setCurrentStreak(nextStreak);
      setLeaderboardRefresh((n) => n + 1);
    },
    [user, boardCount],
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
    correct: "bg-[#58cc02] border-[#4aa802] text-white shadow-[0_4px_0_#4aa802]",
    present: "bg-[#ffc800] border-[#e6b400] text-white shadow-[0_4px_0_#e6b400]",
    absent: "bg-[var(--fg-muted)] border-[var(--border-hover)] text-white",
    empty: "border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
  };

  const keyClasses: Record<LetterState, string> = {
    correct: "bg-[#58cc02] text-white shadow-[0_3px_0_#4aa802]",
    present: "bg-[#ffc800] text-white shadow-[0_3px_0_#e6b400]",
    absent: "bg-[var(--border-hover)] text-white",
    empty: "bg-[var(--border)] text-[var(--fg)] hover:bg-[var(--border-hover)]",
  };

  const modeSelector = (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {(["daily", "infinite"] as PlayMode[]).map((m) => (
          <button
            key={m}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changePlayMode(m)}
            className={`rounded-xl border-2 px-4 py-1.5 text-xs font-extrabold uppercase transition ${
              playMode === m
                ? "border-[var(--accent-dark)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
            }`}
          >
            {m === "daily" ? "Diário" : "Infinito"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {MODES.map((mode) => (
          <button
            key={mode.count}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changeMode(mode.count)}
            className={`rounded-xl border-2 px-4 py-1.5 text-xs font-extrabold uppercase transition ${
              boardCount === mode.count
                ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (status === "loading") {
    return (
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-6 overflow-x-auto px-4 py-8">
        {modeSelector}

        <div className={`flex justify-center ${boardCount === 4 ? "gap-6" : "gap-10"}`}>
          {Array.from({ length: boardCount }).map((_, boardIndex) => (
            <div key={boardIndex} className={`flex shrink-0 flex-col ${boardCount === 4 ? "gap-2" : "gap-3"}`}>
              {Array.from({ length: maxAttemptsFor(boardCount) }).map((_, rowIndex) => (
                <div key={rowIndex} className={`flex ${boardCount === 4 ? "gap-1.7" : "gap-5"}`}>
                  {Array.from({ length: WORD_LENGTH }).map((_, i) => (
                    <div
                      key={i}
                      className={`animate-pulse rounded-xl border-2 border-[var(--border)] bg-[var(--border)]/40 ${
                        boardCount === 4 ? "h-12 w-12" : boardCount === 2 ? "h-14 w-14" : "h-16 w-16"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          {KEY_ROWS.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              {row.map((key) => {
                const isWide = key === "Enter" || key === "Back";
                return (
                  <div
                    key={key}
                    className={`animate-pulse rounded-lg bg-[var(--border)]/40 ${
                      isWide ? "h-11 px-4" : "h-11 min-w-9"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (alreadyPlayedToday) {
    return (
      <div className="flex flex-1 flex-col items-center gap-6 py-8">
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
    );
  }

  const maxAttempts = maxAttemptsFor(boardCount);

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-6 overflow-x-auto px-4 py-8">
      {modeSelector}

      <div className={`flex justify-center ${boardCount === 4 ? "gap-6" : "gap-10"}`}>
        {targetWords.map((_, boardIndex) => (
          <div key={boardIndex} className={`flex shrink-0 flex-col ${boardCount === 4 ? "gap-2" : "gap-3"}`}>
            {Array.from({ length: maxAttempts }).map((_, rowIndex) => {
              const isCurrentRow = rowIndex === rawGuesses.length;
              const rowLetters = boardGuesses[boardIndex]?.[rowIndex]
                ? boardGuesses[boardIndex][rowIndex]
                : isCurrentRow
                  ? currentLetters.map((l) => ({ letter: l, state: "empty" as LetterState }))
                  : Array.from({ length: WORD_LENGTH }, () => ({ letter: "", state: "empty" as LetterState }));

              return (
                <div
                  key={rowIndex}
                  className={`flex ${boardCount === 4 ? "gap-1.7" : "gap-5"} ${isCurrentRow && shakeRow ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
                >
                  {rowLetters.map((cell, i) => (
                    <div
                      key={i}
                      onClick={() => isCurrentRow && status === "playing" && setCursor(i)}
                      className={`flex items-center justify-center rounded-xl border-2 font-extrabold uppercase transition-all duration-200 ${
                        boardCount === 4 ? "h-12 w-12 text-xl" : boardCount === 2 ? "h-14 w-14 text-2xl" : "h-16 w-16 text-3xl"
                      } ${cellClasses[cell.state]} ${
                        isCurrentRow && cursor === i
                          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40 scale-105"
                          : ""
                      } ${cell.letter && cell.state === "empty" ? "scale-105 border-[var(--fg-muted)]" : ""} ${
                        isCurrentRow ? "cursor-pointer" : ""
                      }`}
                    >
                      {cell.letter}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {message && (
        <p className="flex items-center gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-bold text-[var(--fg-muted)]">
          {message}
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {row.map((key) => {
              const state = keyStates.current[key.toLowerCase()] ?? "empty";
              const isWide = key === "Enter" || key === "Back";
              return (
                <button
                  key={key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKey(key)}
                  className={`rounded-lg text-xs font-extrabold uppercase transition active:scale-95 ${keyClasses[state]} ${
                    isWide ? "px-4 py-3.5 text-[10px]" : "min-w-9 px-2.5 py-3.5"
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
  );
}
