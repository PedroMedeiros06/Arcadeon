"use client";

import { useState } from "react";
import { Palette, Star } from "lucide-react";
import { DIFFICULTY_LABEL, type Difficulty, type WordEntry } from "@/lib/draw/types";

interface WordPickerProps {
  options: WordEntry[];
  onChoose: (word: string) => void;
}

export const CATEGORY_LABEL: Record<string, string> = {
  animal: "Animal",
  objeto: "Objeto",
  comida: "Comida",
  profissao: "Profissao",
  lugar: "Lugar",
  acao: "Acao",
  natureza: "Natureza",
  veiculo: "Veiculo",
  esporte: "Esporte",
  fantasia: "Fantasia",
};

export const DIFFICULTY_STYLE: Record<Difficulty, { color: string; bg: string }> = {
  1: { color: "#16a34a", bg: "rgba(34,197,94,0.14)" },
  2: { color: "#d97706", bg: "rgba(245,158,11,0.16)" },
  3: { color: "#dc2626", bg: "rgba(239,68,68,0.14)" },
};

export function DifficultyStars({ difficulty, size = 12 }: { difficulty: Difficulty; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" style={{ color: DIFFICULTY_STYLE[difficulty].color }}>
      {[1, 2, 3].map((n) => (
        <Star key={n} size={size} className={n <= difficulty ? "fill-current" : "opacity-30"} />
      ))}
    </span>
  );
}

export function WordPicker({ options, onChoose }: WordPickerProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const sorted = [...options].sort((a, b) => a.difficulty - b.difficulty);

  function choose(word: string) {
    if (chosen) return;
    setChosen(word);
    onChoose(word);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-fade-up w-full max-w-sm rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-white"
            style={{ animation: "wiggle 1.2s ease-in-out infinite" }}
          >
            <Palette className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-extrabold text-[var(--fg)]">Sua vez! Escolha uma palavra</h2>
          <p className="text-xs font-semibold text-[var(--fg-muted)]">
            Mais dificil = mais pontos pra quem acerta e pra voce
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {sorted.map((entry, i) => {
            const style = DIFFICULTY_STYLE[entry.difficulty];
            return (
              <button
                key={entry.word}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(entry.word)}
                disabled={!!chosen}
                className={`animate-pop-in flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-95 ${
                  chosen === entry.word
                    ? "scale-105 border-[var(--primary)] bg-[var(--primary-tint)]"
                    : chosen
                      ? "border-[var(--border)] bg-[var(--bg)] opacity-40"
                      : "border-[var(--border)] bg-[var(--bg)] shadow-[0_3px_0_var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-tint)]"
                }`}
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-lg font-extrabold capitalize leading-tight text-[var(--fg)]">
                    {entry.word}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
                      style={{ color: style.color, backgroundColor: style.bg }}
                    >
                      <DifficultyStars difficulty={entry.difficulty} size={10} />
                      {DIFFICULTY_LABEL[entry.difficulty]}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--fg-muted)]">
                      {CATEGORY_LABEL[entry.category] ?? entry.category}
                    </span>
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end leading-none">
                  <span className="text-[9px] font-bold uppercase text-[var(--fg-muted)]">ate</span>
                  <span className="text-xl font-black tabular-nums" style={{ color: style.color }}>
                    {entry.maxPoints}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-[var(--fg-muted)]">pts</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
