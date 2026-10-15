"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { claimStreakReward, getArcadeonStreakShared } from "@/lib/economy/api";
import type { ArcadeonStreak } from "@/lib/economy/streak";

/** Sequencia do Arcadeon do usuario logado. streak null = sem conta ou RPC ainda nao existe. */
export function useArcadeonStreak() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const userId = user?.id ?? null;
  const [streak, setStreak] = useState<ArcadeonStreak | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !userId) return;
    let alive = true;
    getArcadeonStreakShared(userId).then((s) => {
      if (!alive) return;
      setStreak(s);
      setLoadedFor(userId);
    });
    return () => {
      alive = false;
    };
  }, [authLoading, userId]);

  const claim = useCallback(async () => {
    if (!userId || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      await claimStreakReward();
      const [fresh] = await Promise.all([getArcadeonStreakShared(userId), refreshProfile()]);
      setStreak(fresh);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setClaiming(false);
    }
  }, [userId, claiming, refreshProfile]);

  // trocou de conta: o valor antigo nao vale ate a busca nova voltar
  const current = loadedFor === userId ? streak : null;
  return { streak: current, loading: !!userId && loadedFor !== userId, claiming, error, claim };
}
