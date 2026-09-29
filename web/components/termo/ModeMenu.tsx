"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, Infinity as InfinityIcon, Skull, Timer, X } from "lucide-react";
import { MODES, maxAttemptsFor, type BoardCount, type PlayMode } from "@/lib/termo/logic";
import type { DailyModeStatus } from "@/lib/termo/daily";

export type ExtraMode = "speed" | "villain";

const MODE_INFO: Record<BoardCount, string> = {
  1: "1 palavra",
  2: "2 palavras",
  4: "4 palavras",
};

const EXTRAS: { mode: ExtraMode; label: string; description: string; Icon: typeof Timer }[] = [
  { mode: "speed", label: "Contra o Tempo", description: "3 minutos para acertar o máximo de palavras", Icon: Timer },
  { mode: "villain", label: "Vilão", description: "A palavra muda para fugir dos seus palpites", Icon: Skull },
];

/** Desenho do modo: um quadradinho por tabuleiro. */
export function ModeGlyph({ count, size = 18 }: { count: BoardCount; size?: number }) {
  const cells = count === 4 ? 2 : count;
  const tile = count === 1 ? size : (size - 2) / 2;
  return (
    <span
      aria-hidden
      className="grid shrink-0 gap-0.5"
      style={{ gridTemplateColumns: `repeat(${cells}, ${tile}px)`, width: count === 1 ? size : undefined }}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="rounded-[3px] bg-current"
          style={{ height: count === 2 ? size : tile }}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: DailyModeStatus | undefined }) {
  if (status === "won")
    return (
      <span className="flex items-center gap-1 rounded-full bg-[var(--termo-correct)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
        <Check className="h-3 w-3" /> Feito
      </span>
    );
  if (status === "lost")
    return (
      <span className="rounded-full bg-[var(--fg-muted)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
        Não foi
      </span>
    );
  if (status === "playing")
    return (
      <span className="rounded-full bg-[var(--termo-present)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
        Jogando
      </span>
    );
  if (status === "not_started")
    return (
      <span className="rounded-full border-2 border-[var(--border)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[var(--fg-muted)]">
        Novo
      </span>
    );
  return null;
}

interface ModeMenuProps {
  playMode: PlayMode;
  boardCount: BoardCount;
  extraMode: ExtraMode | null;
  /** status do Diario de hoje por modo; undefined enquanto carrega ou sem rede */
  dailyStatus: Record<BoardCount, DailyModeStatus> | null;
  /** avisa o jogo pra pausar o teclado fisico e atualizar o status do Diario */
  onOpenChange: (open: boolean) => void;
  onPick: (mode: PlayMode, count: BoardCount) => void;
  onPickExtra: (mode: ExtraMode) => void;
}

/** Botao com o modo atual + painel pra trocar (folha de baixo no celular, janela no desktop). */
export function ModeMenu({ playMode, boardCount, extraMode, dailyStatus, onOpenChange, onPick, onPickExtra }: ModeMenuProps) {
  const [open, setOpenState] = useState(false);
  const [tab, setTab] = useState<PlayMode>(playMode);

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenState(false);
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function show() {
    setTab(playMode);
    setOpen(true);
  }

  const extra = EXTRAS.find((e) => e.mode === extraMode);
  const current = MODES.find((m) => m.count === boardCount)!;

  return (
    <>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="group flex h-10 items-center gap-2.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] py-1 pl-2.5 pr-2 shadow-[0_3px_0_var(--border)] transition hover:border-[var(--game-termo)] active:translate-y-0.5 active:shadow-none"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--game-termo)] text-white">
          {extra ? <extra.Icon className="h-4 w-4" /> : <ModeGlyph count={boardCount} size={14} />}
        </span>
        <span className="font-display text-sm font-extrabold text-[var(--fg)]">{extra ? extra.label : current.label}</span>
        {!extra && (
          <span className="rounded-md bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
            {playMode === "daily" ? "Diário" : "Infinito"}
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-[var(--fg-muted)] transition group-hover:text-[var(--fg)]" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Escolher modo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out] sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border-2 border-b-0 border-[var(--border)] bg-[var(--card)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-[termoSheetUp_0.25s_ease-out] sm:rounded-3xl sm:border-b-2 sm:animate-[scaleIn_0.2s_ease-out]"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-[var(--fg)]">Como quer jogar?</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--fg-muted)] transition hover:bg-[var(--bg)] hover:text-[var(--fg)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--bg)] p-1">
              {(
                [
                  { mode: "daily", label: "Diário", hint: "Mesma palavra para todos", Icon: CalendarDays },
                  { mode: "infinite", label: "Infinito", hint: "Quantas partidas quiser", Icon: InfinityIcon },
                ] as const
              ).map(({ mode, label, hint, Icon }) => (
                <button
                  key={mode}
                  onClick={() => setTab(mode)}
                  aria-pressed={tab === mode}
                  className={`flex flex-col items-center rounded-xl px-2 py-2 transition ${
                    tab === mode ? "bg-[var(--card)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span className={`flex items-center gap-1.5 text-sm font-extrabold ${tab === mode ? "text-[var(--game-termo)]" : ""}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--fg-muted)]">{hint}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {MODES.map((m) => {
                const active = !extraMode && playMode === tab && boardCount === m.count;
                return (
                  <button
                    key={m.count}
                    onClick={() => {
                      setOpen(false);
                      onPick(tab, m.count);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition active:translate-y-0.5 ${
                      active
                        ? "border-[var(--game-termo)] bg-[var(--bg)] shadow-[0_3px_0_var(--game-termo)]"
                        : "border-[var(--border)] shadow-[0_3px_0_var(--border)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--game-termo)] text-white">
                      <ModeGlyph count={m.count} size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-extrabold text-[var(--fg)]">{m.label}</span>
                      <span className="block text-xs font-semibold text-[var(--fg-muted)]">
                        {MODE_INFO[m.count]} · {maxAttemptsFor(m.count)} tentativas
                      </span>
                    </span>
                    {tab === "daily" && <StatusBadge status={dailyStatus?.[m.count]} />}
                  </button>
                );
              })}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">Outros desafios</h3>
              <div className="grid grid-cols-2 gap-2">
                {EXTRAS.map(({ mode, label, description, Icon }) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setOpen(false);
                      onPickExtra(mode);
                    }}
                    className={`flex flex-col gap-1.5 rounded-2xl border-2 p-3 text-left transition active:translate-y-0.5 ${
                      extraMode === mode
                        ? "border-[var(--accent)] bg-[var(--bg)] shadow-[0_3px_0_var(--accent)]"
                        : "border-[var(--border)] shadow-[0_3px_0_var(--border)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-display text-sm font-extrabold text-[var(--fg)]">{label}</span>
                    <span className="text-[11px] font-semibold leading-snug text-[var(--fg-muted)]">{description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
