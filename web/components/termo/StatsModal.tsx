"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Coins, Flame, Lock, Shield, Timer, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { MODES, type BoardCount } from "@/lib/termo/logic";
import { buyStreakShield, errorMessage, fetchMyStats, type MyStats } from "@/lib/termo/daily";
import { NextWordCountdown } from "./Extras";

const LETRADO_ACHIEVEMENTS = ["first_win", "streak_7", "termo_first_try", "termo_streak_30", "termo_quad_perfect", "termo_hard_win"];

interface AchievementRow {
  id: string;
  code: string;
  name: string;
  description: string;
  unlocked: boolean;
}

interface StatsModalProps {
  initialMode: BoardCount;
  /** tentativas da partida de hoje, pra destacar a barra no grafico */
  highlightAttempts?: number | null;
  onClose: () => void;
}

export function StatsModal({ initialMode, highlightAttempts, onClose }: StatsModalProps) {
  const { user, coins, refreshProfile } = useAuth();
  const [mode, setMode] = useState<BoardCount>(initialMode);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await fetchMyStats());
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
      setError("Não foi possível carregar as estatísticas.");
    }
    if (!user) return;
    const supabase = createClient();
    const [{ data: all }, { data: mine }] = await Promise.all([
      supabase.from("achievements").select("id, code, name, description").in("code", LETRADO_ACHIEVEMENTS),
      supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
    ]);
    const owned = new Set((mine ?? []).map((m) => m.achievement_id));
    setAchievements(
      (all ?? [])
        .map((a) => ({ ...a, unlocked: owned.has(a.id) }))
        .sort((a, b) => LETRADO_ACHIEVEMENTS.indexOf(a.code) - LETRADO_ACHIEVEMENTS.indexOf(b.code)),
    );
  }, [user]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleBuyShield() {
    setBuying(true);
    setError(null);
    try {
      await buyStreakShield();
      await Promise.all([refreshProfile(), load()]);
    } catch (err) {
      setError(errorMessage(err, "Não foi possível comprar o escudo."));
    } finally {
      setBuying(false);
    }
  }

  const m = stats?.modes[mode];
  const winPct = m && m.played > 0 ? Math.round((m.wins / m.played) * 100) : 0;
  const maxBar = m ? Math.max(1, ...m.distribution) : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Estatísticas"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl animate-[scaleIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-extrabold text-[var(--fg)]">Estatísticas</h2>

        <div className="flex gap-2">
          {MODES.map((opt) => (
            <button
              key={opt.count}
              onClick={() => setMode(opt.count)}
              aria-pressed={mode === opt.count}
              className={`rounded-xl border-2 px-3 py-1 text-xs font-extrabold uppercase transition ${
                mode === opt.count
                  ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {!stats || !m ? (
          <p className="py-6 text-center text-sm font-medium text-[var(--fg-muted)]">{error ?? "Carregando..."}</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { value: m.played, label: "Jogos" },
                { value: `${winPct}%`, label: "Vitórias" },
                { value: m.currentStreak ?? "–", label: "Sequência" },
                { value: m.bestStreak ?? "–", label: "Recorde" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center rounded-2xl bg-[var(--bg)] px-1 py-2.5">
                  <span className="text-2xl font-extrabold text-[var(--fg)]">{item.value}</span>
                  <span className="text-xs font-bold text-[var(--fg-muted)]">{item.label}</span>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
                Acertos por tentativa
              </h3>
              <div className="flex flex-col gap-1">
                {m.distribution.map((count, i) => {
                  const attempts = i + 1;
                  // nao da pra vencer com menos tentativas que palavras (Duplo >= 2, Quadruplo >= 4)
                  if (attempts < mode) return null;
                  const highlight = mode === initialMode && highlightAttempts === attempts;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm font-bold">
                      <span className="w-4 text-right text-[var(--fg-muted)]">{attempts}</span>
                      <div className="flex-1">
                        <div
                          className={`flex min-w-7 justify-end rounded-md px-2 py-0.5 text-white transition-all ${
                            highlight ? "bg-[var(--termo-correct)]" : "bg-[var(--fg-muted)]"
                          }`}
                          style={{ width: `${Math.max(8, (count / maxBar) * 100)}%` }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {user ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-extrabold text-[var(--fg)]">
                      Escudos de sequência: {stats.shields ?? 0}/2
                    </p>
                    <p className="text-xs font-medium text-[var(--fg-muted)]">
                      Cada escudo cobre um dia sem jogar, sem perder a sequência.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleBuyShield}
                  disabled={buying || (stats.shields ?? 0) >= 2 || coins < 30}
                  className="flex shrink-0 items-center gap-1 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Coins className="h-3.5 w-3.5" /> 30
                </button>
              </div>
            ) : (
              <p className="rounded-2xl bg-[var(--bg)] p-3 text-center text-xs font-semibold text-[var(--fg-muted)]">
                Entre na sua conta para guardar sequência, comprar escudos e ganhar conquistas.
              </p>
            )}

            {stats.speedBest !== null && (
              <p className="flex items-center gap-2 text-sm font-bold text-[var(--fg)]">
                <Timer className="h-4 w-4 text-[var(--accent)]" /> Recorde no Contra o Tempo: {stats.speedBest} palavras
              </p>
            )}

            {error && <p className="text-sm font-bold text-[var(--danger)]">{error}</p>}

            {achievements.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">Conquistas</h3>
                <ul className="flex flex-col gap-1.5">
                  {achievements.map((a) => (
                    <li
                      key={a.id}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
                        a.unlocked ? "border-[var(--termo-correct)] bg-[var(--bg)]" : "border-[var(--border)] opacity-60"
                      }`}
                    >
                      {a.unlocked ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--termo-correct)]" />
                      ) : a.code.includes("streak") ? (
                        <Flame className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
                      ) : (
                        <Lock className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
                      )}
                      <div>
                        <p className="text-sm font-extrabold text-[var(--fg)]">{a.name}</p>
                        <p className="text-xs font-medium text-[var(--fg-muted)]">{a.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <NextWordCountdown />
      </div>
    </div>
  );
}
