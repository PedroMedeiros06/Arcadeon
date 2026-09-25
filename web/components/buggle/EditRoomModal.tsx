"use client";

import { useState } from "react";
import { Globe, Lock, Users, X } from "lucide-react";
import type { RoomConfig } from "@/lib/buggle/types";

interface EditRoomModalProps {
  config: RoomConfig;
  currentPlayerCount: number;
  onSave: (config: RoomConfig) => void;
  onClose: () => void;
}

const DURATION_OPTIONS = [30, 90, 120, 180, 250, 300];

function closestDuration(seconds: number): number {
  return DURATION_OPTIONS.reduce((closest, option) =>
    Math.abs(option - seconds) < Math.abs(closest - seconds) ? option : closest
  );
}

function BoardPreview({ size }: { size: number }) {
  return (
    <div
      className="grid gap-0.75 rounded-lg bg-[var(--stage-3)] p-2"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, width: 88, height: 88 }}
    >
      {Array.from({ length: size * size }).map((_, i) => (
        <span key={i} className="rounded-xs bg-white/90" />
      ))}
    </div>
  );
}

export function EditRoomModal({ config, currentPlayerCount, onSave, onClose }: EditRoomModalProps) {
  const [boardSize, setBoardSize] = useState(config.boardSize);
  const [roundSeconds, setRoundSeconds] = useState(closestDuration(config.roundSeconds));
  const [minWordLength, setMinWordLength] = useState(config.minWordLength);
  const [maxPlayers, setMaxPlayers] = useState(config.maxPlayers);
  const [visibility, setVisibility] = useState(config.visibility);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-linear-to-b from-[var(--stage-1)] to-[var(--stage-2)] p-5 shadow-2xl">
        <div className="relative mb-4 flex items-center justify-center">
          <h2 className="text-lg font-extrabold text-white">Editar partida</h2>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--stage-3)]/50 p-5 backdrop-blur">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-white/90">Tamanho do tabuleiro</p>
            <div className="rounded-xl border-2 border-[var(--stage-soft)] bg-[var(--stage-4)]/60 p-1.5">
              <BoardPreview size={boardSize} />
            </div>
            <p className="text-xs font-semibold text-[var(--stage-softer)]">
              {boardSize}x{boardSize}
            </p>
            <input
              type="range"
              min={4}
              max={8}
              value={boardSize}
              onChange={(e) => setBoardSize(Number(e.target.value))}
              className="w-full accent-[var(--stage-soft)]"
            />
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-white/90">
              Duração da partida: <span className="text-[var(--stage-softer)]">{roundSeconds}s</span>
            </p>
            <input
              type="range"
              min={0}
              max={DURATION_OPTIONS.length - 1}
              step={1}
              value={DURATION_OPTIONS.indexOf(roundSeconds)}
              onChange={(e) => setRoundSeconds(DURATION_OPTIONS[Number(e.target.value)])}
              className="w-full accent-[var(--stage-soft)]"
            />
            <div className="flex justify-between text-xs font-semibold text-white/75">
              {DURATION_OPTIONS.map((mark) => (
                <span key={mark}>{mark}s</span>
              ))}
            </div>
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-white/90">
              Tamanho mínimo da palavra: <span className="text-[var(--stage-softer)]">{minWordLength}</span>
            </p>
            <input
              type="range"
              min={3}
              max={5}
              value={minWordLength}
              onChange={(e) => setMinWordLength(Number(e.target.value))}
              className="w-full accent-[var(--stage-soft)]"
            />
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-sm font-bold text-white/90">
              <Users size={14} />
              Máximo de jogadores: <span className="text-[var(--stage-softer)]">{maxPlayers}</span>
            </p>
            <input
              type="range"
              min={Math.max(2, currentPlayerCount)}
              max={24}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-[var(--stage-soft)]"
            />
            {currentPlayerCount > 2 && (
              <p className="text-xs font-semibold text-white/50">
                Mínimo {currentPlayerCount} (jogadores já na sala)
              </p>
            )}
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-white/90">Visibilidade</p>
            <div className="flex gap-2 rounded-xl bg-[var(--stage-4)] p-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setVisibility("public")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition ${
                  visibility === "public"
                    ? "bg-[var(--stage-soft)] text-[var(--stage-4)]"
                    : "text-white/75 hover:text-white"
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
                    ? "bg-[var(--stage-soft)] text-[var(--stage-4)]"
                    : "text-white/75 hover:text-white"
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
          onClick={() => {
            onSave({ boardSize, roundSeconds, minWordLength, visibility, maxPlayers });
            onClose();
          }}
          className="mt-5 w-full rounded-2xl border-2 border-emerald-600 bg-emerald-400 py-3.5 text-base font-extrabold text-emerald-950 shadow-[0_4px_0_var(--color-emerald-600)] transition active:translate-y-1 active:border-b-2 active:shadow-none"
        >
          Salvar alteracoes
        </button>
      </div>
    </div>
  );
}
