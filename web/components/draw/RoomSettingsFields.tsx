"use client";

import { Globe, Lock, Users } from "lucide-react";
import { MODE_INFO, MODIFIERS, MODIFIER_INFO } from "@/lib/draw/modes";
import type { DrawRoomConfig, GameMode } from "@/lib/draw/types";

const TURN_OPTIONS = [60, 90, 120];
const MODES: GameMode[] = ["classic", "teams", "impostor"];

export function closestTurn(seconds: number): number {
  return TURN_OPTIONS.reduce((closest, option) =>
    Math.abs(option - seconds) < Math.abs(closest - seconds) ? option : closest
  );
}

interface RoomSettingsFieldsProps {
  value: DrawRoomConfig;
  onChange: (config: DrawRoomConfig) => void;
  /** editar partida: nao da pra baixar o maximo abaixo de quem ja esta na sala */
  currentPlayerCount?: number;
}

/** Campos de configuracao da sala, iguais em "Criar sala" e "Editar partida". */
export function RoomSettingsFields({ value, onChange, currentPlayerCount = 0 }: RoomSettingsFieldsProps) {
  const set = (patch: Partial<DrawRoomConfig>) => onChange({ ...value, ...patch });
  const isImpostor = value.mode === "impostor";
  const minMax = Math.max(2, currentPlayerCount);

  const segment = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition ${
      active ? "bg-[var(--stage-soft)] text-[var(--stage-4)]" : "text-white/75 hover:text-white"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-white/90">Modo de jogo</p>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--stage-4)] p-1">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={value.mode === mode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => set({ mode })}
              className={`rounded-lg px-1 py-2 text-xs font-extrabold leading-tight transition sm:text-sm ${
                value.mode === mode ? "bg-[var(--stage-soft)] text-[var(--stage-4)]" : "text-white/75 hover:text-white"
              }`}
            >
              {MODE_INFO[mode].label}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-white/70">
          {MODE_INFO[value.mode].short} Mínimo de {MODE_INFO[value.mode].minPlayers} jogadores.
        </p>
      </div>

      {!isImpostor && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-white/90">
            Modificadores <span className="font-semibold text-white/60">(um sorteado por turno)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MODIFIERS.map((m) => {
              const on = value.modifiers.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  title={MODIFIER_INFO[m].short}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    set({ modifiers: on ? value.modifiers.filter((x) => x !== m) : [...value.modifiers, m] })
                  }
                  className={`flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-bold transition ${
                    on
                      ? "border-[var(--stage-soft)] bg-[var(--stage-soft)] text-[var(--stage-4)]"
                      : "border-white/20 text-white/75 hover:border-white/40 hover:text-white"
                  }`}
                >
                  <span aria-hidden>{MODIFIER_INFO[m].emoji}</span>
                  {MODIFIER_INFO[m].label}
                </button>
              );
            })}
          </div>
          <p className="text-xs font-semibold text-white/60">
            {value.modifiers.length === 0
              ? "Nenhum ligado: partida normal."
              : value.modifiers.map((m) => `${MODIFIER_INFO[m].label}: ${MODIFIER_INFO[m].short.toLowerCase()}`).join(" · ")}
          </p>
        </div>
      )}

      <div className="h-px bg-white/15" />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-white/90">
          {isImpostor ? "Rodadas" : "Rodadas por jogador"}:{" "}
          <span className="text-[var(--stage-softer)]">{value.roundsPerPlayer}</span>
        </p>
        <input
          type="range"
          min={1}
          max={isImpostor ? 8 : 5}
          value={value.roundsPerPlayer}
          onChange={(e) => set({ roundsPerPlayer: Number(e.target.value) })}
          className="w-full accent-[var(--stage-soft)]"
        />
      </div>

      {!isImpostor && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-white/90">
            Tempo por turno: <span className="text-[var(--stage-softer)]">{value.turnSeconds}s</span>
          </p>
          <input
            type="range"
            min={0}
            max={TURN_OPTIONS.length - 1}
            step={1}
            value={TURN_OPTIONS.indexOf(closestTurn(value.turnSeconds))}
            onChange={(e) => set({ turnSeconds: TURN_OPTIONS[Number(e.target.value)] })}
            className="w-full accent-[var(--stage-soft)]"
          />
          <div className="flex justify-between text-xs font-semibold text-white/75">
            {TURN_OPTIONS.map((mark) => (
              <span key={mark}>{mark}s</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-sm font-bold text-white/90">
          <Users size={14} />
          Máximo de jogadores: <span className="text-[var(--stage-softer)]">{value.maxPlayers}</span>
        </p>
        <input
          type="range"
          min={minMax}
          max={16}
          value={value.maxPlayers}
          onChange={(e) => set({ maxPlayers: Number(e.target.value) })}
          className="w-full accent-[var(--stage-soft)]"
        />
        {currentPlayerCount > 2 && (
          <p className="text-xs font-semibold text-white/50">Mínimo {currentPlayerCount} (jogadores já na sala)</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-white/90">Visibilidade</p>
        <div className="flex gap-2 rounded-xl bg-[var(--stage-4)] p-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => set({ visibility: "public" })}
            className={segment(value.visibility === "public")}
          >
            <Globe size={14} />
            Pública
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => set({ visibility: "private" })}
            className={segment(value.visibility === "private")}
          >
            <Lock size={14} />
            Privada
          </button>
        </div>
      </div>
    </div>
  );
}
