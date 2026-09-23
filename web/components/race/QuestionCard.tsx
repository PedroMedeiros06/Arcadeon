"use client";

import { Check, X } from "lucide-react";
import type { QuestionReveal, RaceQuestionPublic } from "@/lib/race/types";

const LETTERS = ["A", "B", "C", "D"];
// cor fixa por letra: ajuda a achar a alternativa rapido, sem depender de hover
const LETTER_COLORS = ["#8b6cff", "#1cb0f6", "#f59e0b", "#ec4899"];
const CORRECT_COLOR = "#8bbf6f";

interface QuestionCardProps {
  question: RaceQuestionPublic;
  /** alternativa que eu travei (confirmada pelo servidor via answer-locked) */
  lockedIndex: number | null;
  /** enviei mas o servidor ainda nao confirmou */
  pendingIndex: number | null;
  /** null durante a pergunta; preenchido em question-results */
  reveal: QuestionReveal | null;
  /** antes de startsAt as opcoes aparecem mas nao aceitam clique */
  open: boolean;
  onAnswer: (index: number) => void;
}

export function QuestionCard({ question, lockedIndex, pendingIndex, reveal, open, onAnswer }: QuestionCardProps) {
  const chosen = lockedIndex ?? pendingIndex;
  const canAnswer = open && chosen === null && !reveal;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-5 text-center shadow-[0_6px_0_var(--border)] sm:px-6 sm:py-7">
        <p className="text-lg font-extrabold leading-snug text-[var(--fg)] sm:text-2xl">{question.text}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3">
        {question.options.map((option, i) => {
          const isChosen = chosen === i;
          const isCorrect = reveal?.correctIndex === i;
          const isWrongChoice = !!reveal && isChosen && !isCorrect;
          const dimmed = (reveal && !isCorrect && !isChosen) || (!reveal && chosen !== null && !isChosen);

          let bg = "var(--card)";
          let border = "var(--border)";
          if (reveal && isCorrect) {
            bg = CORRECT_COLOR;
            border = CORRECT_COLOR;
          } else if (isWrongChoice) {
            bg = "var(--danger)";
            border = "var(--danger)";
          } else if (isChosen) {
            border = LETTER_COLORS[i];
          }
          const filled = (reveal && isCorrect) || isWrongChoice;

          return (
            <button
              key={i}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!canAnswer}
              onClick={() => onAnswer(i)}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition active:scale-[0.98] disabled:active:scale-100 ${
                dimmed ? "opacity-45" : ""
              } ${isChosen && !reveal ? "ring-4 ring-offset-0" : ""} ${!open && !reveal ? "cursor-wait" : ""}`}
              style={{
                backgroundColor: bg,
                borderColor: border,
                ...(isChosen && !reveal ? { ["--tw-ring-color" as string]: `${LETTER_COLORS[i]}55` } : {}),
                animation: reveal && isCorrect ? "popIn 0.4s ease-out" : isWrongChoice ? "shake 0.4s" : undefined,
              }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                style={{ backgroundColor: filled ? "rgba(0,0,0,0.2)" : LETTER_COLORS[i] }}
              >
                {reveal && isCorrect ? <Check size={18} strokeWidth={3} /> : isWrongChoice ? <X size={18} strokeWidth={3} /> : LETTERS[i]}
              </span>
              <span className={`flex-1 text-sm font-bold sm:text-base ${filled ? "text-white" : "text-[var(--fg)]"}`}>
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
