"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getDailyStatusShared } from "@/lib/home/dailyStatus";
import { formatCountdown, msUntilBrasiliaMidnight } from "@/lib/time";

const MODES = [1, 2, 4] as const;

/** Progresso do Letrado de hoje e quanto falta pra palavra nova. */
export function SidebarDaily() {
  const { user, loading } = useAuth();
  const [done, setDone] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    getDailyStatusShared(user?.id ?? "anon")
      .then((s) => {
        if (!alive) return;
        setDone(MODES.filter((m) => s.modes[m] === "won" || s.modes[m] === "lost").length);
      })
      .catch(() => alive && setDone(null));
    return () => {
      alive = false;
    };
  }, [loading, user?.id]);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilBrasiliaMidnight(Date.now())));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Link
      href="/games/termo"
      className="flex flex-col gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-4 transition hover:border-[var(--border-hover)]"
    >
      <span className="flex items-center gap-2 text-sm font-extrabold text-[var(--fg)]">
        <span className="pattern-termo h-4 w-4 rounded-md" aria-hidden /> Letrado de hoje
      </span>
      {done !== null && (
        <span className="flex gap-1" aria-label={`${done} de 3 modos feitos`}>
          {MODES.map((m, i) => (
            <span key={m} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-[var(--game-termo)]" : "bg-[var(--border)]"}`} />
          ))}
        </span>
      )}
      <span className="text-xs font-medium text-[var(--fg-muted)]">
        {done === 3 ? "Dia fechado. " : ""}
        {countdown ? `Palavra nova em ${countdown}` : "Palavra nova todo dia"}
      </span>
    </Link>
  );
}
