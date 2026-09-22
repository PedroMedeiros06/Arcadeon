"use client";

import { Palette } from "lucide-react";
import type { WordEntry } from "@/lib/draw/types";

interface WordPickerProps {
  options: WordEntry[];
  onChoose: (word: string) => void;
}

export function WordPicker({ options, onChoose }: WordPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
        <div className="mb-4 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-white">
            <Palette className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-extrabold text-[var(--fg)]">Escolha uma palavra</h2>
        </div>

        <div className="flex flex-col gap-2">
          {options.map((entry) => (
            <button
              key={entry.word}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChoose(entry.word)}
              className="rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] py-3 text-center text-lg font-extrabold capitalize text-[var(--fg)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-tint)]"
            >
              {entry.word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
