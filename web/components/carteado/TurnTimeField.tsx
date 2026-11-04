"use client";

import type { CarteadoRoomConfig, TurnSeconds } from "@/lib/carteado/types";

const TURN_SECONDS: TurnSeconds[] = [10, 20, 0];

const chipClass = (active: boolean) =>
  `rounded-xl border-2 px-3 py-2 text-sm font-bold transition ${
    active
      ? "border-[var(--game-accent)] bg-[var(--game-accent)] text-white"
      : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:border-[var(--border-hover)]"
  }`;

/** Unica opcao da sala: tempo de cada vez. readOnly = quem nao e anfitriao so ve. */
export function TurnTimeField({ config, onChange, readOnly = false }: { config: CarteadoRoomConfig; onChange: (c: CarteadoRoomConfig) => void; readOnly?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-[var(--fg)]">Tempo por vez</span>
      <div className="grid grid-cols-3 gap-2">
        {TURN_SECONDS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={readOnly}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange({ ...config, turnSeconds: s })}
            className={`${chipClass(config.turnSeconds === s)} ${readOnly ? "cursor-default" : ""}`}
          >
            {s === 0 ? "Sem limite" : `${s}s`}
          </button>
        ))}
      </div>
      <span className="text-xs text-[var(--fg-muted)]">Acabou o tempo, a carta vira sozinha.</span>
    </div>
  );
}
