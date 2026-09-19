"use client";

import { useEffect, useState } from "react";
import { Globe, Lock, Users, X, KeyRound, Plus } from "lucide-react";
import type { RoomConfig } from "@/lib/buggle/types";

interface LobbyProps {
  defaultName: string;
  isNameLocked: boolean;
  onCreate: (name: string, config: RoomConfig) => void;
  onJoin: (name: string, code: string) => void;
  joinError: string | null;
  onModeChange?: (mode: "choose" | "create" | "join") => void;
}

const DURATION_OPTIONS = [30, 90, 120, 180, 250, 300];

function BoardPreview({ size }: { size: number }) {
  return (
    <div
      className="grid shrink-0 gap-0.75 rounded-lg bg-[#5a2fc2] p-2"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, width: 96, height: 96 }}
    >
      {Array.from({ length: size * size }).map((_, i) => (
        <span key={i} className="rounded-xs bg-white/90" />
      ))}
    </div>
  );
}

export function Lobby({ defaultName, isNameLocked, onCreate, onJoin, joinError, onModeChange }: LobbyProps) {
  const [mode, setModeState] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState(defaultName);

  function setMode(next: "choose" | "create" | "join") {
    setModeState(next);
    onModeChange?.(next);
  }

  useEffect(() => {
    if (isNameLocked) setName(defaultName);
  }, [defaultName, isNameLocked]);

  const [boardSize, setBoardSize] = useState(4);
  const [roundSeconds, setRoundSeconds] = useState(90);
  const [minWordLength, setMinWordLength] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [joinCode, setJoinCode] = useState("");

  if (mode === "choose") {
    return (
      <div className="flex flex-1 items-center justify-center bg-linear-to-br from-[var(--primary)] via-[var(--primary-dark)] to-[#1a0f38] p-6">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-3xl font-extrabold text-white backdrop-blur">
              abc
            </span>
            <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-white">Buggle</h2>
            <p className="font-medium text-white/70">Encontre o maximo de palavras no tabuleiro.</p>
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
              <span className="text-sm font-medium text-white/60">Configure o tabuleiro e convide amigos</span>
            </button>

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMode("join")}
              className="group flex flex-1 flex-col items-start gap-3 rounded-2xl border-2 border-white/15 bg-white/10 p-5 text-left backdrop-blur transition hover:-translate-y-1 hover:border-white/30 hover:bg-white/15"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
                <KeyRound className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold text-white">Entrar com codigo</span>
              <span className="text-sm font-medium text-white/60">Tem um codigo? Entre em uma sala existente</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="flex flex-1 items-center justify-center bg-linear-to-br from-[var(--accent)] via-[var(--accent-dark)] to-[#0c2b3d] p-6">
        <div className="w-full max-w-sm rounded-3xl border-2 border-white/15 bg-white/10 p-6 backdrop-blur">
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={isNameLocked}
              placeholder="Seu nome"
              className={`w-full rounded-xl border-2 border-white/20 bg-black/20 px-4 py-2.5 text-center font-bold text-white placeholder:text-white/40 ${
                isNameLocked ? "opacity-70" : ""
              }`}
            />
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Codigo da sala"
              maxLength={5}
              className="w-full rounded-xl border-2 border-white/20 bg-black/20 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-widest text-white placeholder:text-white/40"
            />
            {joinError && <p className="text-center text-sm font-semibold text-red-300">{joinError}</p>}

            <button
              onMouseDown={(e) => e.preventDefault()}
              disabled={!name.trim() || joinCode.length !== 5}
              onClick={() => onJoin(name.trim(), joinCode)}
              className="mt-1 w-full rounded-xl border-2 border-white/20 bg-white py-2.5 font-extrabold text-[var(--accent-dark)] transition disabled:opacity-40"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-linear-to-br from-[#7c3fe0] via-[#5a2fc2] to-[#26124f] p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-linear-to-b from-[#7c3fe0] to-[#3a1a7a] p-5 shadow-2xl">
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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={isNameLocked}
            placeholder="Seu nome"
            className={`w-full rounded-lg border-2 border-white/20 bg-[#1a0f38] px-4 py-2 text-center font-bold text-white ${
              isNameLocked ? "opacity-70" : ""
            }`}
          />

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-white/90">Tamanho do tabuleiro</p>
            <div className="rounded-xl border-2 border-[#a78bfa] bg-[#1a0f38]/60 p-1.5">
              <BoardPreview size={boardSize} />
            </div>
            <p className="text-xs font-semibold text-[#c4b5fd]">
              {boardSize}x{boardSize}
            </p>
            <input
              type="range"
              min={4}
              max={8}
              value={boardSize}
              onChange={(e) => setBoardSize(Number(e.target.value))}
              className="w-full accent-[#a78bfa]"
            />
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-white/90">
              Tempo por rodada: <span className="text-[#c4b5fd]">{roundSeconds}s</span>
            </p>
            <input
              type="range"
              min={0}
              max={DURATION_OPTIONS.length - 1}
              step={1}
              value={DURATION_OPTIONS.indexOf(roundSeconds)}
              onChange={(e) => setRoundSeconds(DURATION_OPTIONS[Number(e.target.value)])}
              className="w-full accent-[#a78bfa]"
            />
            <div className="flex justify-between text-[11px] font-semibold text-white/60">
              {DURATION_OPTIONS.map((mark) => (
                <span key={mark}>{mark}s</span>
              ))}
            </div>
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-white/90">
              Tamanho minimo da palavra: <span className="text-[#c4b5fd]">{minWordLength}</span>
            </p>
            <input
              type="range"
              min={3}
              max={5}
              value={minWordLength}
              onChange={(e) => setMinWordLength(Number(e.target.value))}
              className="w-full accent-[#a78bfa]"
            />
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-sm font-bold text-white/90">
              <Users size={14} />
              Maximo de jogadores: <span className="text-[#c4b5fd]">{maxPlayers}</span>
            </p>
            <input
              type="range"
              min={2}
              max={24}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-[#a78bfa]"
            />
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-white/90">Visibilidade</p>
            <div className="flex gap-2 rounded-xl bg-[#1a0f38] p-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setVisibility("public")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition ${
                  visibility === "public"
                    ? "bg-[#a78bfa] text-[#1a0f38]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Globe size={14} />
                Publica
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setVisibility("private")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition ${
                  visibility === "private"
                    ? "bg-[#a78bfa] text-[#1a0f38]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Lock size={14} />
                Privada
              </button>
            </div>
          </div>
        </div>

        <button
          onMouseDown={(e) => e.preventDefault()}
          disabled={!name.trim()}
          onClick={() =>
            onCreate(name.trim(), { boardSize, roundSeconds, minWordLength, visibility, maxPlayers })
          }
          className="mt-5 w-full rounded-2xl border-2 border-emerald-600 bg-emerald-400 py-3.5 text-base font-extrabold text-emerald-950 shadow-[0_4px_0_var(--color-emerald-600)] transition active:translate-y-1 active:border-b-2 active:shadow-none disabled:opacity-50"
        >
          Iniciar sala
        </button>
      </div>
    </div>
  );
}
