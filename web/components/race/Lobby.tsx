"use client";

import { useState } from "react";
import { Flag, KeyRound, Plus, X } from "lucide-react";
import { RaceConfigFields } from "./RaceConfigFields";
import type { RaceRoomConfig } from "@/lib/race/types";

interface LobbyProps {
  defaultName: string;
  isNameLocked: boolean;
  connected: boolean;
  onCreate: (config: RaceRoomConfig, name: string) => void;
  onJoin: (name: string, code: string) => void;
  joinError: string | null;
  onModeChange?: (mode: "choose" | "create" | "join") => void;
}

export function Lobby({ defaultName, isNameLocked, connected, onCreate, onJoin, joinError, onModeChange }: LobbyProps) {
  const [mode, setModeState] = useState<"choose" | "create" | "join">("choose");
  const [typedName, setName] = useState(defaultName);
  // logado: nome vem da conta e nao e editavel
  const name = isNameLocked ? defaultName : typedName;
  const [joinCode, setJoinCode] = useState("");
  const [config, setConfig] = useState<RaceRoomConfig>({
    questionCount: 10,
    questionSeconds: 15,
    visibility: "private",
    maxPlayers: 8,
  });

  function setMode(next: "choose" | "create" | "join") {
    setModeState(next);
    onModeChange?.(next);
  }

  const nameInput = (
    <input
      value={name}
      maxLength={10}
      onChange={(e) => setName(e.target.value)}
      readOnly={isNameLocked}
      placeholder="Seu nome"
      className={`w-full rounded-xl border-2 border-white/20 bg-black/20 px-4 py-2.5 text-center font-bold text-white placeholder:text-white/40 ${
        isNameLocked ? "opacity-70" : ""
      }`}
    />
  );

  const connecting = !connected && (
    <p className="mt-3 text-center text-xs font-semibold text-white/70">Conectando ao servidor...</p>
  );

  if (mode === "choose") {
    return (
      <div className="flex flex-1 items-center justify-center bg-linear-to-br from-[var(--primary)] via-[var(--primary-dark)] to-[#1a0f38] p-6">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <span className="mb-4 inline-flex h-16 w-16 animate-float-slow items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
              <Flag className="h-8 w-8" />
            </span>
            <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-white">Corrida do Conhecimento</h2>
            <p className="font-medium text-white/70">Responda rápido, acerte e cruze a linha de chegada primeiro.</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMode("create")}
              className="group flex flex-1 flex-col items-start gap-3 rounded-2xl border-2 border-white/15 bg-white/10 p-5 text-left backdrop-blur transition hover:-translate-y-1 hover:border-white/30 hover:bg-white/15"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
                <Plus className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold text-white">Criar sala</span>
              <span className="text-sm font-medium text-white/60">Configure a corrida e convide amigos</span>
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMode("join")}
              className="group flex flex-1 flex-col items-start gap-3 rounded-2xl border-2 border-white/15 bg-white/10 p-5 text-left backdrop-blur transition hover:-translate-y-1 hover:border-white/30 hover:bg-white/15"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
                <KeyRound className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold text-white">Entrar com código</span>
              <span className="text-sm font-medium text-white/60">Tem um código? Entre em uma sala existente</span>
            </button>
          </div>
          {connecting}
        </div>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="flex flex-1 items-center justify-center bg-linear-to-br from-[var(--accent)] via-[var(--accent-dark)] to-[#0c2b3d] p-4 sm:p-6">
        <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border-2 border-white/15 bg-white/10 p-5 backdrop-blur sm:p-6">
          <div className="relative mb-5 flex items-center justify-center">
            <h2 className="text-lg font-extrabold text-white">Entrar na sala</h2>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMode("choose")}
              className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {nameInput}
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Código da sala"
              maxLength={5}
              className="w-full rounded-xl border-2 border-white/20 bg-black/20 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-widest text-white placeholder:text-white/40"
            />
            {joinError && <p className="text-center text-sm font-semibold text-red-300">{joinError}</p>}

            <button
              onMouseDown={(e) => e.preventDefault()}
              disabled={!name.trim() || joinCode.length !== 5 || !connected}
              onClick={() => onJoin(name.trim(), joinCode)}
              className="mt-1 w-full rounded-xl border-2 border-white/20 bg-white py-2.5 font-extrabold text-[var(--accent-dark)] transition disabled:opacity-40"
            >
              Entrar
            </button>
          </div>
          {connecting}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-linear-to-br from-[#7c3fe0] via-[#5a2fc2] to-[#26124f] p-3 sm:p-4">
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-linear-to-b from-[#7c3fe0] to-[#3a1a7a] p-4 shadow-2xl sm:p-5">
        <div className="relative mb-4 flex items-center justify-center">
          <h2 className="text-lg font-extrabold text-white">Criar sala</h2>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMode("choose")}
            className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-2xl bg-[#26124f]/50 p-5 backdrop-blur">
          {nameInput}
          <div className="my-4 h-px bg-white/15" />
          <RaceConfigFields config={config} onChange={setConfig} />
        </div>

        <button
          onMouseDown={(e) => e.preventDefault()}
          disabled={!name.trim() || !connected}
          onClick={() => onCreate(config, name.trim())}
          className="mt-5 w-full rounded-2xl border-2 border-emerald-600 bg-emerald-400 py-3.5 text-base font-extrabold text-emerald-950 shadow-[0_4px_0_var(--color-emerald-600)] transition active:translate-y-1 active:border-b-2 active:shadow-none disabled:opacity-50"
        >
          Criar sala
        </button>
        {connecting}
      </div>
    </div>
  );
}
