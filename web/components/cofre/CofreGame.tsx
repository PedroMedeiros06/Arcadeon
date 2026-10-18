"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Dumbbell, Users } from "lucide-react";
import { GameHeader } from "@/components/GameHeader";
import { OnlineGame } from "./OnlineGame";
import { PracticeScreen } from "./PracticeScreen";

type Screen = "menu" | "treino" | "online";

const COMING_SOON = [{ icon: CalendarDays, title: "Golpe do dia", text: "O mesmo cofre pra todo mundo, com ranking diário." }];

const MODES = [
  { screen: "online" as const, icon: Users, title: "Salas online", text: "Até 8 pessoas, com regras que você escolhe." },
  { screen: "treino" as const, icon: Dumbbell, title: "Treino", text: "Solo, no seu ritmo, com tabuleiro móvel se quiser." },
];

export function CofreGame() {
  const joinCode = useSearchParams().get("join");
  // link/QR de convite cai direto na sala
  const [screen, setScreen] = useState<Screen>(joinCode ? "online" : "menu");

  if (screen === "online") return <OnlineGame joinCode={joinCode} onExit={() => setScreen("menu")} />;

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
          {MODES.map(({ screen: target, icon: Icon, title, text }) => (
            <button
              key={target}
              type="button"
              onClick={() => setScreen(target)}
              className="flex items-center gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--game-accent)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--game-accent)] text-white">
                <Icon className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-black text-[var(--fg)]">{title}</span>
                <span className="text-sm text-[var(--fg-muted)]">{text}</span>
              </span>
            </button>
          ))}
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
