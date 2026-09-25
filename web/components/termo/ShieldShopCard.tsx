"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buyStreakShield, errorMessage } from "@/lib/termo/daily";

const PRICE = 30;
const MAX = 2;

/** Item da loja: escudo que cobre um dia sem jogar o Letrado sem perder a sequência. */
export function ShieldShopCard() {
  const { user, coins, refreshProfile } = useAuth();
  const [shields, setShields] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    createClient()
      .from("profiles")
      .select("streak_shields")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setShields((data as { streak_shields: number } | null)?.streak_shields ?? 0));
  }, [user]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  async function buy() {
    setBusy(true);
    setFeedback(null);
    try {
      setShields(await buyStreakShield());
      setFeedback("Escudo comprado!");
      await refreshProfile();
    } catch (err) {
      setFeedback(errorMessage(err, "Não foi possível comprar."));
    } finally {
      setBusy(false);
    }
  }

  const full = (shields ?? 0) >= MAX;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--fg)]">Itens do Letrado</h2>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]">
          <Shield className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-[var(--fg)]">Escudo de sequência</p>
          <p className="text-sm text-[var(--fg-muted)]">
            Cobre um dia sem jogar o Letrado diário sem zerar sua sequência. Guarde até {MAX}.
          </p>
          {user && shields !== null && (
            <p className="mt-1 text-xs font-bold text-[var(--primary)]">
              Você tem {shields}/{MAX}
              {feedback && <span className="ml-2 text-[var(--fg-muted)]">{feedback}</span>}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={buy}
          disabled={!user || busy || full || coins < PRICE}
          title={!user ? "Entre na sua conta para comprar" : full ? "Limite de escudos atingido" : undefined}
          className="flex items-center gap-1 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Coins className="h-4 w-4" /> {PRICE}
        </button>
      </div>
    </section>
  );
}
