"use client";

import { Check, Coins, Flame, Gift } from "lucide-react";
import { streakHint, streakSlots, todayReward, type ArcadeonStreak, type SlotState } from "@/lib/economy/streak";

const SLOT: Record<SlotState, string> = {
  done: "border-transparent bg-[var(--primary-tint)] text-[var(--primary)]",
  claimed: "border-transparent bg-[var(--primary)] text-white",
  claimable: "border-[var(--primary)] bg-[var(--card)] text-[var(--primary)]",
  waiting: "border-dashed border-[var(--border-hover)] bg-[var(--card)] text-[var(--fg)]",
  upcoming: "border-transparent bg-[var(--bg)] text-[var(--fg-muted)]",
};

const SLOT_LABEL: Record<SlotState, string> = {
  done: "feito",
  claimed: "resgatado",
  claimable: "pronto pra resgatar",
  waiting: "hoje, falta terminar uma partida",
  upcoming: "ainda vem",
};

/** Ciclo de 7 dias da sequencia do Arcadeon, com o resgate do dia. */
export function StreakCalendar({
  streak,
  claiming,
  error,
  onClaim,
}: {
  streak: ArcadeonStreak;
  claiming: boolean;
  error: string | null;
  onClaim: () => void;
}) {
  const slots = streakSlots(streak);
  const claimable = slots.some((s) => s.state === "claimable");

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Sequência</p>
        <p className="flex items-center gap-1 text-sm font-bold tabular-nums text-[var(--fg)]">
          <Flame className="h-4 w-4 text-[var(--primary)]" aria-hidden />
          {streak.streak} {streak.streak === 1 ? "dia" : "dias"}
        </p>
      </div>

      <ol className="grid grid-cols-7 gap-1.5">
        {slots.map((slot) => (
          <li
            key={slot.day}
            aria-label={`Dia ${slot.day}, ${slot.reward} moedas, ${SLOT_LABEL[slot.state]}`}
            className={`flex aspect-[3/4] flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-xs font-extrabold tabular-nums ${SLOT[slot.state]}`}
          >
            {slot.state === "done" || slot.state === "claimed" ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : slot.day === 7 ? (
              <Gift className="h-4 w-4" aria-hidden />
            ) : (
              <span aria-hidden>{slot.day}</span>
            )}
            <span aria-hidden className="text-[0.65rem] font-bold opacity-80">
              {slot.reward}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-sm text-[var(--fg-muted)]">{streakHint(streak)}</p>

      {claimable && (
        <button
          type="button"
          onClick={onClaim}
          disabled={claiming}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2 disabled:cursor-wait disabled:opacity-70"
        >
          <Coins className="h-4 w-4" aria-hidden />
          {claiming ? "Resgatando..." : `Resgatar ${todayReward(streak)} moedas`}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      )}
      <p className="text-xs text-[var(--fg-muted)]">
        Recorde: {streak.bestStreak} {streak.bestStreak === 1 ? "dia" : "dias"}
      </p>
    </div>
  );
}
