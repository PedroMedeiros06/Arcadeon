"use client";

import { useState } from "react";
import { CalendarDays, Dumbbell, Users } from "lucide-react";
import { GameHeader } from "@/components/GameHeader";
import { PracticeScreen } from "./PracticeScreen";

type Screen = "menu" | "treino";

const COMING_SOON = [
  { icon: Users, title: "Salas online", text: "Até 8 pessoas, com regras que você escolhe." },
  { icon: CalendarDays, title: "Golpe do dia", text: "O mesmo cofre pra todo mundo, com ranking diário." },
];

export function CofreGame() {
  const [screen, setScreen] = useState<Screen>("menu");

  return (
    <>
      <GameHeader slug="cofre" shortTitle="Cofre" />
      {screen === "treino" ? (
        <PracticeScreen onExit={() => setScreen("menu")} />
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-8">
          <div className="mb-2">
            <h1 className="text-3xl font-black text-[var(--fg)]">Cofre</h1>
            <p className="mt-1 text-[var(--fg-muted)]">Decore onde está cada peça, combine os pares e leve o espólio.</p>
          </div>
          <button
            type="button"
            onClick={() => setScreen("treino")}
            className="flex items-center gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--game-accent)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--game-accent)] text-white">
              <Dumbbell className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-black text-[var(--fg)]">Treino</span>
              <span className="text-sm text-[var(--fg-muted)]">Solo, no seu ritmo, com tabuleiro móvel se quiser.</span>
            </span>
          </button>
          {COMING_SOON.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-[var(--border)] p-4 opacity-60">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--border)] text-[var(--fg-muted)]">
                <Icon className="h-6 w-6" />
              </span>
              <span className="flex-1">
                <span className="block font-black text-[var(--fg)]">{title}</span>
                <span className="text-sm text-[var(--fg-muted)]">{text}</span>
              </span>
              <span className="rounded-lg bg-[var(--border)] px-2 py-1 text-xs font-bold text-[var(--fg-muted)]">Em breve</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
