"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Swords } from "lucide-react";
import { GameHeader } from "@/components/GameHeader";
import { OnlineGame } from "./OnlineGame";
import { PracticeScreen } from "./PracticeScreen";
import { NoveCard } from "./NoveCard";

type Screen = "menu" | "treino" | "online";

const MODES = [
  { screen: "online" as const, icon: Swords, title: "Duelo online", text: "Você contra um amigo, pelo código ou QR." },
  { screen: "treino" as const, icon: Bot, title: "Treino", text: "Contra o robô, pra pegar o jeito." },
];

const RULES = [
  "Cada um tem uma cartela de 1 a 9. Na sua vez, vire a carta do monte.",
  "Número que falta na cartela entra nela. Número repetido ou 0 só passa a vez.",
  "Bloqueio passa a sua vez. +1 deixa virar outra carta.",
  "Carta preta: você escolhe a cor, e a próxima carta de número do adversário só conta se for dessa cor.",
  "Quem completar os 9 números primeiro vence.",
];

export function NoveGame() {
  const joinCode = useSearchParams().get("join");
  // link/QR de convite cai direto na sala
  const [screen, setScreen] = useState<Screen>(joinCode ? "online" : "menu");

  if (screen === "online") return <OnlineGame joinCode={joinCode} onExit={() => setScreen("menu")} />;

  return (
    <>
      <GameHeader slug="nove" />
      {screen === "treino" ? (
        <PracticeScreen onExit={() => setScreen("menu")} />
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-8">
          <div className="mb-2 flex items-center gap-4">
            <div className="flex -space-x-8">
              <NoveCard card={{ id: -1, kind: "number", value: 9, color: "verde" }} width={56} className="-rotate-12" />
              <NoveCard card={{ id: -2, kind: "number", value: 4, color: "amarelo" }} width={56} className="rotate-0" />
              <NoveCard card={{ id: -3, kind: "wild" }} width={56} className="rotate-12" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-[var(--fg)]">Nove</h1>
              <p className="mt-1 text-[var(--fg-muted)]">Vire cartas e complete sua cartela de 1 a 9 antes do adversário.</p>
            </div>
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
          <div className="mt-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">Como jogar</p>
            <ul className="flex flex-col gap-1.5 text-sm text-[var(--fg)]">
              {RULES.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-[var(--game-accent)]">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
