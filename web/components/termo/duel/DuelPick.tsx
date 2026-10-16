"use client";

import { useState } from "react";
import { Swords } from "lucide-react";
import { MODES, maxAttemptsFor, type BoardCount } from "@/lib/termo/logic";
import { normalizeDuelCode } from "@/lib/termo/duelRules";
import { ModeGlyph } from "../ModeMenu";

interface DuelPickProps {
  busy: boolean;
  /** a sala anterior expirou (mostra o aviso) */
  expired: boolean;
  onCreate: (count: BoardCount) => void;
  onJoin: (code: string) => void;
}

/** Primeira tela do Duelo: escolher o modo e criar a sala, ou entrar com um codigo. */
export function DuelPick({ busy, expired, onCreate, onJoin }: DuelPickProps) {
  const [code, setCode] = useState("");
  const parsed = normalizeDuelCode(code);

  return (
    <div className="flex w-full flex-col gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
          <Swords className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-extrabold text-[var(--fg)]">Duelo</h2>
          <p className="text-xs font-semibold text-[var(--fg-muted)]">
            Mesmas palavras, ao vivo. Quem acertar primeiro vence; se ninguém acertar, vence quem chegou mais perto.
          </p>
        </div>
      </div>

      {expired && <p className="text-sm font-bold text-[var(--danger)]">A sala anterior expirou. Crie outra.</p>}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">Criar sala</h3>
        {MODES.map((m) => (
          <button
            key={m.count}
            disabled={busy}
            onClick={() => onCreate(m.count)}
            className="flex items-center gap-3 rounded-2xl border-2 border-[var(--border)] p-3 text-left shadow-[0_3px_0_var(--border)] transition hover:border-[var(--border-hover)] active:translate-y-0.5 disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--game-termo)] text-white">
              <ModeGlyph count={m.count} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-extrabold text-[var(--fg)]">{m.label}</span>
              <span className="block text-xs font-semibold text-[var(--fg-muted)]">{maxAttemptsFor(m.count)} tentativas cada</span>
            </span>
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed) onJoin(parsed);
        }}
      >
        <label htmlFor="duel-code" className="text-xs font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
          Entrar com código
        </label>
        <div className="flex gap-2">
          <input
            id="duel-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="K7M2Q"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={80}
            className="min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-display text-lg font-extrabold uppercase tracking-[0.2em] text-[var(--fg)] outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={busy || !parsed}
            className="rounded-xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-4 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2 disabled:opacity-50"
          >
            Entrar
          </button>
        </div>
      </form>
    </div>
  );
}
