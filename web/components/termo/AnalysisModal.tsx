"use client";

import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import { analyzeBoard, type GuessAnalysis } from "@/lib/termo/analysis";
import { evaluateGuess, withAccents, type LetterState } from "@/lib/termo/logic";

const MINI: Record<LetterState, string> = {
  correct: "bg-[var(--termo-correct)] text-white",
  present: "bg-[var(--termo-present)] text-white",
  absent: "bg-[var(--fg-muted)] text-white",
  empty: "bg-[var(--border)]",
};

function scoreColor(score: number) {
  if (score >= 85) return "var(--termo-correct)";
  if (score >= 55) return "var(--termo-present)";
  return "var(--danger)";
}

interface AnalysisModalProps {
  guesses: string[];
  answers: string[];
  targets: string[];
  accents: Record<string, string>;
  onClose: () => void;
}

/** "Como foi minha partida?": palavras que restavam a cada palpite e o que o bot teria jogado. */
export function AnalysisModal({ guesses, answers, targets, accents, onClose }: AnalysisModalProps) {
  const [board, setBoard] = useState(0);
  const [results, setResults] = useState<Record<number, GuessAnalysis[]>>({});
  const current = results[board];

  useEffect(() => {
    if (results[board]) return;
    // calculo pesado (~1s no primeiro palpite): deixa o modal pintar antes
    const id = setTimeout(() => {
      const r = analyzeBoard(guesses, answers[board], targets);
      setResults((prev) => ({ ...prev, [board]: r }));
    }, 50);
    return () => clearTimeout(id);
  }, [board, guesses, answers, targets, results]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = (w: string) => withAccents(w, accents).toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Análise da partida"
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl animate-[scaleIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-[var(--fg)]">
            <Bot className="h-5 w-5 text-[var(--primary)]" /> Análise da partida
          </h2>
          <p className="mt-1 text-xs font-medium text-[var(--fg-muted)]">
            Quantas respostas ainda eram possíveis a cada palpite e o que o robô teria jogado.
          </p>
        </div>

        {answers.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {answers.map((a, i) => (
              <button
                key={a}
                onClick={() => setBoard(i)}
                aria-pressed={board === i}
                className={`rounded-xl border-2 px-3 py-1 text-xs font-extrabold uppercase transition ${
                  board === i
                    ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
                }`}
              >
                {shown(a)}
              </button>
            ))}
          </div>
        )}

        {!current ? (
          <p className="py-8 text-center text-sm font-bold text-[var(--fg-muted)]">Analisando...</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {current.map((row, i) => {
              const states = evaluateGuess(row.guess, answers[board]);
              return (
                <li key={i} className="flex flex-col gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-1">
                      {shown(row.guess)
                        .split("")
                        .map((l, j) => (
                          <span
                            key={j}
                            className={`flex h-7 w-7 items-center justify-center rounded-md text-sm font-extrabold ${MINI[states[j]]}`}
                          >
                            {l}
                          </span>
                        ))}
                    </div>
                    <span className="text-right text-xs font-bold text-[var(--fg-muted)]">
                      {row.solved ? (
                        <span className="text-[var(--termo-correct)]">Acertou!</span>
                      ) : (
                        <>
                          {row.before} → <span className="text-[var(--fg)]">{row.after}</span> palavras
                        </>
                      )}
                    </span>
                  </div>
                  {!row.solved && (
                    <>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.score}%`, backgroundColor: scoreColor(row.score) }}
                        />
                      </div>
                      <p className="text-xs font-semibold text-[var(--fg-muted)]">
                        {row.guess === row.botGuess ? (
                          "Mesmo palpite que o robô escolheria!"
                        ) : (
                          <>
                            Robô: <span className="font-extrabold text-[var(--fg)]">{shown(row.botGuess)}</span> (deixaria ~
                            {row.botExpected.toFixed(1)} palavras; o seu, ~{row.expected.toFixed(1)})
                          </>
                        )}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
