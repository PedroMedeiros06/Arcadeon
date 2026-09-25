"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Share2, Timer, Trophy, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { computeKeyStates, withAccents, WORD_LENGTH } from "@/lib/termo/logic";
import { errorMessage, finishSpeedRun, sendSpeedGuess, startSpeedRun, type SpeedState } from "@/lib/termo/daily";
import { useWordInput } from "@/lib/termo/useWordInput";
import { Boards, cellClasses, cellStyle } from "./Board";
import { Keyboard } from "./Keyboard";

const DURATION_S = 180;

interface SpeedRow {
  id: string;
  username: string;
  best: number;
}

interface SpeedGameProps {
  acceptedWords: Set<string>;
  accents: Record<string, string>;
  onShare: (text: string) => void;
  message: string | null;
  setMessage: (m: string | null) => void;
}

/** Contra o Tempo: 3 minutos pra acertar o maximo de palavras (6 tentativas cada). Validado no servidor. */
export function SpeedGame({ acceptedWords, accents, onShare, message, setMessage }: SpeedGameProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"intro" | "playing" | "finished">("intro");
  const [run, setRun] = useState<SpeedState | null>(null);
  const [timeLeft, setTimeLeft] = useState(DURATION_S * 1000);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ word: string; solved: boolean; key: number } | null>(null);
  const [ranking, setRanking] = useState<SpeedRow[] | null>(null);
  const busyRef = useRef(false);
  const finishingRef = useRef(false);

  const loadRanking = useCallback(() => {
    createClient()
      .from("termo_speed_leaderboard")
      .select("id, username, best")
      .limit(10)
      .then(({ data }) => setRanking((data as SpeedRow[] | null) ?? []));
  }, []);

  useEffect(() => {
    const id = setTimeout(loadRanking, 0);
    return () => clearTimeout(id);
  }, [loadRanking]);

  const finish = useCallback(async (runId: string) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      setRun(await finishSpeedRun(runId));
    } catch (err) {
      console.error("Erro ao encerrar rodada:", err);
    }
    setPhase("finished");
    loadRanking();
  }, [loadRanking]);

  // relogio da rodada
  useEffect(() => {
    if (phase !== "playing" || !run) return;
    const id = setInterval(() => {
      const left = run.endsAt - Date.now();
      setTimeLeft(Math.max(0, left));
      if (left <= 0) finish(run.runId);
    }, 200);
    return () => clearInterval(id);
  }, [phase, run, finish]);

  async function start() {
    setMessage(null);
    finishingRef.current = false;
    try {
      const state = await startSpeedRun();
      setRun(state);
      setTimeLeft(DURATION_S * 1000); // o relogio corrige no primeiro tique
      setRevealRow(null);
      setFlash(null);
      input.reset();
      setPhase("playing");
    } catch (err) {
      console.error("Erro ao iniciar Contra o Tempo:", err);
      setMessage("Não foi possível iniciar. Tente de novo.");
    }
  }

  const input = useWordInput({ enabled: phase === "playing", onSubmit: submit });

  async function submit(guess: string) {
    if (!run || busyRef.current) return;
    if (guess.length < WORD_LENGTH) {
      setMessage("Palavra incompleta");
      return input.shakeRow();
    }
    if (!acceptedWords.has(guess)) {
      setMessage("Palavra não está na lista");
      return input.shakeRow();
    }
    setMessage(null);
    busyRef.current = true;
    try {
      const state = await sendSpeedGuess(run.runId, guess);
      setRun(state);
      input.reset();
      if (state.last?.word) {
        // palavra encerrada: mostra qual era e comeca a proxima
        setFlash({ word: state.last.word, solved: !!state.last.solved, key: Date.now() });
        setRevealRow(null);
      } else {
        setRevealRow(state.guesses.length - 1);
      }
      if (state.finished) {
        setPhase("finished");
        loadRanking();
      }
    } catch (err) {
      setMessage(errorMessage(err, "Sem conexão. Tente de novo."));
    } finally {
      busyRef.current = false;
    }
  }


  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(id);
  }, [flash]);

  const keyStates = useMemo(() => (run ? computeKeyStates(run.guesses, run.evals, 1) : {}), [run]);
  const seconds = Math.ceil(timeLeft / 1000);
  const urgent = seconds <= 20;

  const messageBox = (
    <p
      role="status"
      aria-live="polite"
      className={
        message
          ? "rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-bold text-[var(--fg-muted)]"
          : "sr-only"
      }
    >
      {message}
    </p>
  );

  const rankingList = (
    <div className="w-full">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
        <Trophy className="h-4 w-4" /> Ranking Contra o Tempo
      </h3>
      {!ranking ? (
        <p className="py-3 text-center text-sm text-[var(--fg-muted)]">Carregando...</p>
      ) : ranking.length === 0 ? (
        <p className="py-3 text-center text-sm text-[var(--fg-muted)]">Ninguém pontuou ainda.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {ranking.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
              <span className="w-5 text-center text-sm font-extrabold text-[var(--fg-muted)]">{i + 1}</span>
              <span className="flex-1 truncate text-sm font-bold text-[var(--fg)]">{r.username}</span>
              <span className="text-sm font-extrabold text-[var(--primary)]">{r.best}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  if (phase === "intro") {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-7 text-center">
        <Timer className="h-12 w-12 text-[var(--accent)]" />
        <h2 className="text-2xl font-extrabold text-[var(--fg)]">Contra o Tempo</h2>
        <p className="text-sm font-medium text-[var(--fg-muted)]">
          Você tem <b>3 minutos</b> para acertar o máximo de palavras. Cada palavra tem 6 tentativas; se errar, ela é
          revelada e vem a próxima.
        </p>
        {!user && (
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Entre na sua conta para aparecer no ranking.</p>
        )}
        <button
          onClick={start}
          className="rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-8 py-3 text-base font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
        >
          Começar
        </button>
        {messageBox}
        {rankingList}
      </div>
    );
  }

  if (phase === "finished" && run) {
    const shareText = `Letrado Contra o Tempo ⏱\n${run.solved} palavra${run.solved === 1 ? "" : "s"} em 3 minutos\n${run.history
      .map((h) => (h.solved ? "🟩" : "🟥"))
      .join("")}\n\n${window.location.origin}/games/termo`;
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-7 text-center">
        <div className="text-5xl">⏱</div>
        <h2 className="text-2xl font-extrabold text-[var(--fg)]">Tempo esgotado!</h2>
        <p className="text-4xl font-black text-[var(--primary)]">
          {run.solved} <span className="text-base font-bold text-[var(--fg-muted)]">palavra{run.solved === 1 ? "" : "s"}</span>
        </p>
        {run.history.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-1.5">
            {run.history.map((h, i) => (
              <li
                key={i}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold uppercase text-white ${
                  h.solved ? "bg-[var(--termo-correct)]" : "bg-[var(--fg-muted)]"
                }`}
              >
                {h.solved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {withAccents(h.word, accents)}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => onShare(shareText)}
            className="flex items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-extrabold text-[var(--fg)] transition hover:bg-[var(--bg)]"
          >
            <Share2 className="h-4 w-4" /> Compartilhar
          </button>
          <button
            onClick={start}
            className="rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
          >
            Jogar de novo
          </button>
        </div>
        {messageBox}
        {rankingList}
      </div>
    );
  }

  return (
    <div style={cellStyle(1)} className="flex w-full flex-1 flex-col items-center justify-between gap-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between">
          <span className={`flex items-center gap-1.5 text-2xl font-black tabular-nums ${urgent ? "text-[var(--danger)]" : "text-[var(--fg)]"}`}>
            <Timer className="h-6 w-6" /> {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
          <span className="text-lg font-extrabold text-[var(--primary)]">
            {run?.solved ?? 0} <span className="text-sm text-[var(--fg-muted)]">acertos</span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${urgent ? "bg-[var(--danger)]" : "bg-[var(--accent)]"}`}
            style={{ width: `${(timeLeft / (DURATION_S * 1000)) * 100}%` }}
          />
        </div>

        <div className="relative">
          <Boards
            boardCount={1}
            guesses={run?.guesses ?? []}
            evals={run?.evals ?? []}
            currentLetters={input.letters}
            cursor={input.cursor}
            revealRowIndex={revealRow}
            shakeRow={input.shake}
            editable
            onCellClick={input.setCursor}
            accents={accents}
          />
          {flash && (
            <div
              key={flash.key}
              className="absolute inset-0 flex items-center justify-center"
              style={{ animation: "fadeIn 0.15s ease-out" }}
            >
              <div className="animate-pop-in flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-2xl">
                <span className="text-sm font-extrabold uppercase text-[var(--fg-muted)]">
                  {flash.solved ? "Acertou!" : "Era"}
                </span>
                <div className="flex gap-1">
                  {withAccents(flash.word, accents)
                    .split("")
                    .map((l, i) => (
                      <span
                        key={i}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 text-lg font-extrabold uppercase ${
                          cellClasses[flash.solved ? "correct" : "absent"]
                        }`}
                      >
                        {l}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
        {messageBox}
      </div>
      <Keyboard boardCount={1} keyStates={keyStates} onKey={input.handleKey} />
    </div>
  );
}
