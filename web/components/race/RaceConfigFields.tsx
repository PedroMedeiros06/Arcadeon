"use client";

import { Globe, Lock, Users } from "lucide-react";
import type { RaceRoomConfig } from "@/lib/race/types";

const QUESTION_SECONDS: RaceRoomConfig["questionSeconds"][] = [10, 15, 20];

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  render,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => React.ReactNode;
}) {
  return (
    <div className="flex gap-2 rounded-xl bg-[var(--stage-4)] p-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(opt)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition active:scale-95 ${
            value === opt ? "bg-[var(--stage-soft)] text-[var(--stage-4)]" : "text-white/75 hover:text-white"
          }`}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  );
}

/** Campos de config compartilhados entre Lobby (criar) e EditRoomModal. Poucas opcoes de proposito. */
export function RaceConfigFields({
  config,
  onChange,
  minPlayers = 2,
}: {
  config: RaceRoomConfig;
  onChange: (config: RaceRoomConfig) => void;
  minPlayers?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-white/90">Tempo por pergunta</p>
        <Segmented
          options={QUESTION_SECONDS}
          value={config.questionSeconds}
          onChange={(questionSeconds) => onChange({ ...config, questionSeconds })}
          render={(v) => `${v}s`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-sm font-bold text-white/90">
          <Users size={14} />
          Máximo de jogadores: <span className="text-[var(--stage-softer)]">{config.maxPlayers}</span>
        </p>
        <input
          type="range"
          min={Math.max(2, minPlayers)}
          max={16}
          value={config.maxPlayers}
          onChange={(e) => onChange({ ...config, maxPlayers: Number(e.target.value) })}
          className="w-full accent-[var(--stage-soft)]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-white/90">Visibilidade</p>
        <Segmented
          options={["public", "private"] as const as ("public" | "private")[]}
          value={config.visibility}
          onChange={(visibility) => onChange({ ...config, visibility })}
          render={(v) =>
            v === "public" ? (
              <>
                <Globe size={14} /> Pública
              </>
            ) : (
              <>
                <Lock size={14} /> Privada
              </>
            )
          }
        />
      </div>
    </div>
  );
}
