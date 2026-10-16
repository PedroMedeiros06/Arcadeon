"use client";

import { useEffect, useMemo, useState } from "react";
import { Flag } from "lucide-react";
import { claimDuel, guessDuel } from "@/lib/termo/duel";
import { opponentAway, type DuelState } from "@/lib/termo/duelRules";
import { codeToStates, computeKeyStates, WORD_LENGTH } from "@/lib/termo/logic";
import { useFitBoards } from "@/lib/termo/useFitBoards";
import { useWordInput } from "@/lib/termo/useWordInput";
import { Boards } from "../Board";
import { Keyboard } from "../Keyboard";
import { OpponentBoards } from "./OpponentBoards";

const REVEAL_MS = WORD_LENGTH * 200 + 500;

/** Hora local que avanca enquanto `active`. */
function useTick(active: boolean, ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

interface DuelGameProps {
  duel: DuelState;
  acceptedWords: Set<string>;
  accents: Record<string, string>;
  message: string | null;
  setMessage: (m: string | null) => void;
  onState: (s: DuelState) => void;
  onLeave: () => void;
  /** chamado depois da animacao da ultima linha, quando o duelo termina */
  onShowResult: () => void;
}

export function DuelGame({ duel, acceptedWords, accents, message, setMessage, onState, onLeave, onShowResult }: DuelGameProps) {
  const [pending, setPending] = useState(false);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const guesses = useMemo(() => duel.me.guesses ?? [], [duel.me.guesses]);
  const evals = useMemo(() => duel.me.patterns.map((row) => row.map(codeToStates)), [duel.me.patterns]);
  const keyStates = useMemo(() => computeKeyStates(guesses, evals, duel.boardCount), [guesses, evals, duel.boardCount]);

  const startAt = duel.startedAt ?? 0;
  const now = useTick(true, 500);
  const serverNow = now + duel.serverOffset;
  const countdown = Math.ceil((startAt - serverNow) / 1000);
  const started = countdown <= 0;
  const finished = duel.status === "finished";
  const outOfTries = !!duel.me.finishedAt && !finished;
  const away = opponentAway(duel, now);

  const input = useWordInput({ enabled: started && !finished && !outOfTries && !pending, onSubmit: submit });
  const { ref: boardsAreaRef, fit } = useFitBoards(duel.boardCount, duel.maxAttempts);

  // fim do duelo: deixa a ultima linha virar antes de trocar pra tela de resultado
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(onShowResult, REVEAL_MS + 400);
    return () => clearTimeout(t);
  }, [finished, onShowResult]);

  async function submit(guess: string) {
    if (guess.length < WORD_LENGTH) {
      setMessage("Palavra incompleta");
      return input.shakeRow();
    }
    if (!acceptedWords.has(guess)) {
      setMessage("Palavra não está na lista");
      return input.shakeRow();
    }
    setPending(true);
    setMessage(null);
    try {
      const next = await guessDuel(duel.code, guess);
      const added = (next.me.guesses?.length ?? 0) > guesses.length;
      onState(next);
      if (added) {
        setRevealRow((next.me.guesses?.length ?? 1) - 1);
        input.reset();
      }
    } catch (err) {
      setMessage((err as Error).message);
      input.shakeRow();
    } finally {
      setPending(false);
    }
  }

  async function claim() {
    try {
      onState(await claimDuel(duel.code));
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  const rival = duel.opponent;
  const note = rival?.finishedAt && !finished ? "Acabou as tentativas" : away ? "Sem sinal…" : null;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col items-center gap-2">
      {rival && (
        <OpponentBoards player={rival} boardCount={duel.boardCount} maxAttempts={duel.maxAttempts} note={note}>
          {!finished && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              {away && (
                <button
                  onClick={claim}
                  className="h-7 rounded-lg bg-[var(--primary)] px-2 text-[11px] font-extrabold text-white transition hover:brightness-110"
                >
                  Reivindicar vitória
                </button>
              )}
              {confirmLeave ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => setConfirmLeave(false)}
                    className="h-7 rounded-lg border-2 border-[var(--border)] px-2 text-[11px] font-extrabold text-[var(--fg-muted)]"
                  >
                    Não
                  </button>
                  <button onClick={onLeave} className="h-7 rounded-lg bg-[var(--danger)] px-2 text-[11px] font-extrabold text-white">
                    Desistir
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmLeave(true)}
                  aria-label="Desistir"
                  title="Desistir"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[var(--border)] text-[var(--fg-muted)] transition hover:text-[var(--danger)]"
                >
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </OpponentBoards>
      )}

      {/* area medida: os tabuleiros ocupam o que sobra entre o topo e o teclado */}
      <div ref={boardsAreaRef} className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
          <p
            role="status"
            aria-live="polite"
            className={
              message || outOfTries
                ? "rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-bold text-[var(--fg)] shadow-lg"
                : "sr-only"
            }
          >
            {message ?? (outOfTries ? `Suas tentativas acabaram. Esperando ${rival?.username ?? "o rival"}…` : "")}
          </p>
        </div>
        {fit && (
          <Boards
            boardCount={duel.boardCount}
            guesses={guesses}
            evals={evals}
            currentLetters={input.letters}
            cursor={input.cursor}
            revealRowIndex={revealRow}
            shakeRow={input.shake}
            editable={started && !finished && !outOfTries}
            onCellClick={input.setCursor}
            accents={accents}
            rowCount={duel.maxAttempts}
            fit={fit}
          />
        )}
        {!started && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[var(--bg)]/70 backdrop-blur-sm">
            <span className="text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">Valendo em</span>
            <span key={countdown} className="font-display text-7xl font-extrabold text-[var(--primary)] animate-[scaleIn_0.3s_ease-out]">
              {Math.max(1, countdown)}
            </span>
          </div>
        )}
      </div>

      <Keyboard boardCount={duel.boardCount} keyStates={keyStates} onKey={input.handleKey} />
    </div>
  );
}
