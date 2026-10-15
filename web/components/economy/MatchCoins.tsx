"use client";

import { useEffect } from "react";
import { Coins } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { matchCoinsLabel } from "@/lib/economy/matchCoins";

/**
 * Selo ao lado do proprio nome na tela de resultado, com o retorno do evento `coins-awarded`.
 * Atualiza o saldo do header ao aparecer, mesmo quando nao mostra nada.
 */
export function MatchCoins({ awarded, capped }: { awarded: number; capped: boolean }) {
  const { refreshProfile } = useAuth();
  const label = matchCoinsLabel(awarded, capped);

  useEffect(() => {
    // mesmo sem moedas da partida (limite ou poucos logados), a partida pode ter pago missao;
    // a segunda busca pega o pagamento da missao, que o servidor grava depois
    refreshProfile();
    const t = setTimeout(refreshProfile, 2500);
    return () => clearTimeout(t);
  }, [awarded, capped, refreshProfile]);

  if (!label) return null;
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${
        awarded > 0 ? "bg-[var(--primary-tint)] text-[var(--primary)]" : "bg-[var(--bg)] text-[var(--fg-muted)]"
      }`}
    >
      <Coins className="h-3.5 w-3.5" aria-hidden /> {label}
    </span>
  );
}
