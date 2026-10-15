"use client";

import { useEffect, useState } from "react";
import { Check, Gamepad2, Gift } from "lucide-react";
import { missionDone, missionPercent, missionsDoneCount, type DailyMissions } from "@/lib/economy/missions";
import { formatCountdown, msUntilBrasiliaMidnight } from "@/lib/time";

/** Tres missoes do dia; cada uma paga sozinha ao completar, e as tres juntas abrem o bau. */
export function MissionsCard({ missions }: { missions: DailyMissions }) {
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilBrasiliaMidnight(Date.now())));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const done = missionsDoneCount(missions);
  const total = missions.missions.length;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Missões de hoje</p>
        {countdown && <p className="text-xs font-medium text-[var(--fg-muted)]">Novas em {countdown}</p>}
      </div>

      <ul className="flex flex-col gap-3">
        {missions.missions.map((m) => {
          const finished = missionDone(m);
          const pct = missionPercent(m);
          return (
            <li key={m.id} className="flex items-center gap-3">
              {m.game ? (
                <span className={`pattern-${m.game} h-9 w-9 shrink-0 rounded-xl`} aria-hidden />
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]"
                  aria-hidden
                >
                  <Gamepad2 className="h-5 w-5" />
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`min-w-0 text-sm font-bold leading-snug ${finished ? "text-[var(--fg-muted)]" : "text-[var(--fg)]"}`}>
                    {m.text}
                  </p>
                  <span className="shrink-0 text-xs font-extrabold tabular-nums text-[var(--primary)]">
                    {finished ? <Check className="inline h-4 w-4" aria-label="feita" /> : `+${m.reward}`}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={m.text}
                  aria-valuemin={0}
                  aria-valuemax={m.target}
                  aria-valuenow={Math.min(m.progress, m.target)}
                  aria-valuetext={`${Math.min(m.progress, m.target)} de ${m.target}`}
                  className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-[width] motion-reduce:transition-none"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {missions.chest.reward > 0 && (
        <p className="flex items-center gap-2 border-t-2 border-[var(--border)] pt-3 text-sm text-[var(--fg-muted)]">
          <Gift className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
          {missions.chest.claimed
            ? `Baú aberto: +${missions.chest.reward} moedas`
            : `Complete as ${total} pra abrir o baú de +${missions.chest.reward} (${done} de ${total})`}
        </p>
      )}
    </div>
  );
}
