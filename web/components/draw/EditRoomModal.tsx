"use client";

import { useState } from "react";
import { Globe, Lock, Users, X } from "lucide-react";
import type { DrawRoomConfig } from "@/lib/draw/types";

interface EditRoomModalProps {
  config: DrawRoomConfig;
  currentPlayerCount: number;
  onSave: (config: DrawRoomConfig) => void;
  onClose: () => void;
}

const TURN_OPTIONS = [60, 90, 120];

function closestTurn(seconds: number): number {
  return TURN_OPTIONS.reduce((closest, option) =>
    Math.abs(option - seconds) < Math.abs(closest - seconds) ? option : closest
  );
}

export function EditRoomModal({ config, currentPlayerCount, onSave, onClose }: EditRoomModalProps) {
  const [roundsPerPlayer, setRoundsPerPlayer] = useState(config.roundsPerPlayer);
  const [turnSeconds, setTurnSeconds] = useState(closestTurn(config.turnSeconds));
  const [maxPlayers, setMaxPlayers] = useState(config.maxPlayers);
  const [visibility, setVisibility] = useState(config.visibility);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-linear-to-b from-[#7c3fe0] to-[#3a1a7a] p-5 shadow-2xl">
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

        <div className="rounded-2xl bg-[#26124f]/50 p-5 backdrop-blur">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-white/90">
              Rodadas por jogador: <span className="text-[#c4b5fd]">{roundsPerPlayer}</span>
            </p>
            <input
              type="range"
              min={1}
              max={5}
              value={roundsPerPlayer}
              onChange={(e) => setRoundsPerPlayer(Number(e.target.value))}
              className="w-full accent-[#a78bfa]"
            />
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-white/90">
              Tempo por turno: <span className="text-[#c4b5fd]">{turnSeconds}s</span>
            </p>
            <input
              type="range"
              min={0}
              max={TURN_OPTIONS.length - 1}
              step={1}
              value={TURN_OPTIONS.indexOf(turnSeconds)}
              onChange={(e) => setTurnSeconds(TURN_OPTIONS[Number(e.target.value)])}
              className="w-full accent-[#a78bfa]"
            />
            <div className="flex justify-between text-[11px] font-semibold text-white/60">
              {TURN_OPTIONS.map((mark) => (
                <span key={mark}>{mark}s</span>
              ))}
            </div>
          </div>

          <div className="my-4 h-px bg-white/15" />

          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-sm font-bold text-white/90">
              <Users size={14} />
              Maximo de jogadores: <span className="text-[#c4b5fd]">{maxPlayers}</span>
            </p>
            <input
              type="range"
              min={Math.max(2, currentPlayerCount)}
              max={16}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-[#a78bfa]"
            />
            {currentPlayerCount > 2 && (
              <p className="text-[11px] font-semibold text-white/50">
                Minimo {currentPlayerCount} (jogadores ja na sala)
              </p>
            )}
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
                  visibility === "public" ? "bg-[#a78bfa] text-[#1a0f38]" : "text-white/60 hover:text-white"
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
                  visibility === "private" ? "bg-[#a78bfa] text-[#1a0f38]" : "text-white/60 hover:text-white"
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
            onSave({ roundsPerPlayer, turnSeconds, visibility, maxPlayers });
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
