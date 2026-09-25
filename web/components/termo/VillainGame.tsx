"use client";

import { useMemo, useState } from "react";
import { Share2, Skull } from "lucide-react";
import { codeToStates, computeKeyStates, villainStep, withAccents, WORD_LENGTH, type LetterState } from "@/lib/termo/logic";
import { useWordInput } from "@/lib/termo/useWordInput";
import { Boards, cellStyle } from "./Board";
import { Keyboard } from "./Keyboard";

const REVEAL_MS = WORD_LENGTH * 200 + 500;
const BEST_KEY = "termoVillainBest";

function readBest(): number | null {
  try {
    const v = Number(window.localStorage.getItem(BEST_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

interface VillainGameProps {
  targets: string[];
  acceptedWords: Set<string>;
  accents: Record<string, string>;
  onShare: (text: string) => void;
  message: string | null;
  setMessage: (m: string | null) => void;
}

/**
 * Vilao (estilo Absurdle): nao existe palavra escolhida. A cada palpite o jogo responde com as cores
 * que deixam o maior numero de palavras possiveis, fugindo de voce. Tentativas ilimitadas.
 */
export function VillainGame({ targets, acceptedWords, accents, onShare, message, setMessage }: VillainGameProps) {
  const [candidates, setCandidates] = useState(targets);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [evals, setEvals] = useState<LetterState[][][]>([]);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [showResult, setShowResult] = useState(false);
  // so monta depois que o jogador escolhe o modo (nunca no SSR), entao pode ler o localStorage direto
  const [best, setBest] = useState<number | null>(() => (typeof window === "undefined" ? null : readBest()));

  const input = useWordInput({ enabled: !won, onSubmit: submit });

  function submit(guess: string) {
    if (guess.length < WORD_LENGTH) {
      setMessage("Palavra incompleta");
      return input.shakeRow();
    }
    if (!acceptedWords.has(guess)) {
      setMessage("Palavra não está na lista");
      return input.shakeRow();
    }
    const { pattern, remaining } = villainStep(candidates, guess);
    const nextGuesses = [...guesses, guess];
    const isWin = pattern === "CCCCC";
    setGuesses(nextGuesses);
    setEvals([...evals, [codeToStates(pattern)]]);
    setCandidates(remaining);
    setRevealRow(nextGuesses.length - 1);
    input.reset();
    setMessage(
      isWin ? null : `Ainda restam ${remaining.length} palavra${remaining.length === 1 ? "" : "s"} possíve${remaining.length === 1 ? "l" : "is"}.`,
    );
    if (isWin) {
      setWon(true);
      if (best === null || nextGuesses.length < best) {
        setBest(nextGuesses.length);
        try {
          window.localStorage.setItem(BEST_KEY, String(nextGuesses.length));
        } catch {
          // armazenamento bloqueado: recorde vale so nesta visita
        }
      }
      setTimeout(() => setShowResult(true), REVEAL_MS);
    }
  }

  function restart() {
    setCandidates(targets);
    setGuesses([]);
    setEvals([]);
    setRevealRow(null);
    setWon(false);
    setShowResult(false);
    setMessage(null);
    input.reset();
  }

  const keyStates = useMemo(() => computeKeyStates(guesses, evals, 1), [guesses, evals]);
  const answer = won ? guesses[guesses.length - 1] : null;
  const shareText = `Letrado Vilão 😈\nVenci o vilão em ${guesses.length} tentativas\n${evals
    .map((e) => e[0].map((s) => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛")).join(""))
    .join("\n")}`;

  return (
    <div style={cellStyle(1)} className="flex w-full flex-1 flex-col items-center justify-between gap-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between text-sm font-bold text-[var(--fg-muted)]">
          <span className="flex items-center gap-1.5 text-[var(--danger)]">
            <Skull className="h-4 w-4" /> Vilão
          </span>
          <span>
            Tentativas: <b className="text-[var(--fg)]">{guesses.length}</b>
            {best !== null && <> · Recorde: {best}</>}
          </span>
        </div>
        <p className="text-center text-xs font-medium text-[var(--fg-muted)]">
          O vilão troca a palavra a cada palpite para fugir de você. Encurrale até sobrar uma só.
        </p>

        <div className="max-h-[55vh] overflow-y-auto px-1 py-1">
          <Boards
            boardCount={1}
            guesses={guesses}
            evals={evals}
            currentLetters={input.letters}
            cursor={input.cursor}
            revealRowIndex={revealRow}
            shakeRow={input.shake}
            editable={!won}
            onCellClick={input.setCursor}
            accents={accents}
            bounceRowIndex={won ? guesses.length - 1 : null}
            rowCount={won ? guesses.length : guesses.length + 1}
          />
        </div>

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

        {showResult && answer && (
          <div className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5 text-center animate-[scaleIn_0.25s_ease-out]">
            <p className="text-lg font-extrabold text-[var(--fg)]">
              Você venceu o vilão em {guesses.length} tentativas! 😈
            </p>
            <p className="text-sm font-semibold text-[var(--fg-muted)]">
              A palavra acabou sendo <b className="uppercase text-[var(--fg)]">{withAccents(answer, accents)}</b>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onShare(shareText)}
                className="flex items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-extrabold text-[var(--fg)] transition hover:bg-[var(--bg)]"
              >
                <Share2 className="h-4 w-4" /> Compartilhar
              </button>
              <button
                onClick={restart}
                className="rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-2 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
              >
                Jogar de novo
              </button>
            </div>
          </div>
        )}
      </div>
      {!won && <Keyboard boardCount={1} keyStates={keyStates} onKey={input.handleKey} />}
    </div>
  );
}
