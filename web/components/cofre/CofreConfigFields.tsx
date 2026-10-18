"use client";

import { Eye, Shuffle, Sparkles, Users } from "lucide-react";
import { BOARD_SIZES, type BoardSize } from "@/lib/cofre/engine";
import type { CofreRoomConfig, TurnSeconds } from "@/lib/cofre/types";

const SIZES = Object.keys(BOARD_SIZES) as BoardSize[];
const TURN_SECONDS: TurnSeconds[] = [8, 12, 20, 0];

export const chipClass = (active: boolean) =>
  `rounded-xl border-2 px-3 py-2 text-sm font-bold transition ${
    active
      ? "border-[var(--game-accent)] bg-[var(--game-accent)] text-white"
      : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:border-[var(--border-hover)]"
  }`;

function Toggle({
  checked,
  onChange,
  icon,
  title,
  text,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  title: string;
  text: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-3 ${disabled ? "opacity-70" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--game-accent)]"
      />
      <span>
        <span className="flex items-center gap-1.5 font-bold text-[var(--fg)]">
          {icon} {title}
        </span>
        <span className="text-sm text-[var(--fg-muted)]">{text}</span>
      </span>
    </label>
  );
}

/** Opcoes da sala, usadas na criacao e na sala de espera. readOnly = quem nao e anfitriao so ve. */
export function CofreConfigFields({
  config,
  onChange,
  minPlayers = 2,
  readOnly = false,
}: {
  config: CofreRoomConfig;
  onChange: (config: CofreRoomConfig) => void;
  minPlayers?: number;
  readOnly?: boolean;
}) {
  const set = (patch: Partial<CofreRoomConfig>) => {
    if (!readOnly) onChange({ ...config, ...patch });
  };
  const smallBoard = config.size === "4x4" || config.size === "6x4";

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-[var(--fg)]">Tamanho do tabuleiro</h3>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={readOnly && config.size !== s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => set({ size: s })}
              className={chipClass(config.size === s)}
            >
              {s.replace("x", "×")} <span className="font-medium opacity-75">· {(BOARD_SIZES[s].cols * BOARD_SIZES[s].rows) / 2} pares</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-[var(--fg)]">Tempo por vez</h3>
        <div className="flex flex-wrap gap-2">
          {TURN_SECONDS.map((t) => (
            <button
              key={t}
              type="button"
              disabled={readOnly && config.turnSeconds !== t}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => set({ turnSeconds: t })}
              className={chipClass(config.turnSeconds === t)}
            >
              {t === 0 ? "Sem limite" : `${t}s`}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[var(--fg)]">
          <Users className="h-4 w-4" /> Máximo de jogadores: <span className="text-[var(--game-accent)]">{config.maxPlayers}</span>
        </h3>
        <input
          type="range"
          min={Math.max(2, minPlayers)}
          max={8}
          value={config.maxPlayers}
          disabled={readOnly}
          onChange={(e) => set({ maxPlayers: Number(e.target.value) })}
          className="w-full accent-[var(--game-accent)]"
        />
        {config.maxPlayers > 5 && smallBoard && (
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Com muita gente, um tabuleiro 6×5 ou 6×6 deixa cada um jogar mais.</p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <Toggle
          checked={config.movingBoard}
          onChange={(movingBoard) => set({ movingBoard })}
          disabled={readOnly}
          icon={<Shuffle className="h-4 w-4" />}
          title="Tabuleiro móvel"
          text="A cada erro, duas cartas escondidas trocam de lugar."
        />
        <Toggle
          checked={config.coringa}
          onChange={(coringa) => set({ coringa })}
          disabled={readOnly}
          icon={<Sparkles className="h-4 w-4" />}
          title="Coringa"
          text="Um par especial que vale 3 pontos."
        />
        <Toggle
          checked={config.peek}
          onChange={(peek) => set({ peek })}
          disabled={readOnly}
          icon={<Eye className="h-4 w-4" />}
          title="Espiada inicial"
          text="Todas as cartas aparecem por 3 segundos no começo."
        />
      </div>
    </div>
  );
}
