"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchDailyMissions } from "@/lib/economy/api";
import { missionsDoneCount, type DailyMissions } from "@/lib/economy/missions";
import { MissionsCard } from "@/components/economy/MissionsCard";
import { StreakCalendar } from "@/components/economy/StreakCalendar";
import { useArcadeonStreak } from "@/components/economy/useArcadeonStreak";

/** Missoes e sequencia, logo abaixo do destaque. Some sem conta ou enquanto o banco nao tem as RPCs. */
export function HomeDaily() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const userId = user?.id ?? null;
  const { streak, loading: streakLoading, claiming, error, claim } = useArcadeonStreak();
  const [missions, setMissions] = useState<DailyMissions | null>(null);
  const [missionsFor, setMissionsFor] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !userId) return;
    let alive = true;
    fetchDailyMissions().then((m) => {
      if (!alive) return;
      setMissions(m);
      setMissionsFor(userId);
      // missao paga sozinha no servidor; com alguma feita, o saldo do header pode estar velho
      if (m && missionsDoneCount(m) > 0) refreshProfile();
    });
    return () => {
      alive = false;
    };
  }, [authLoading, userId, refreshProfile]);

  if (authLoading || !userId) return null;

  const currentMissions = missionsFor === userId ? missions : null;
  if (streakLoading || missionsFor !== userId) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-hidden>
        <div className="skeleton h-44 rounded-3xl" />
        <div className="skeleton h-44 rounded-3xl" />
      </div>
    );
  }
  if (!currentMissions && !streak) return null;

  const calendar = streak && <StreakCalendar streak={streak} claiming={claiming} error={error} onClaim={claim} />;
  if (!currentMissions) return <div className="lg:w-1/3">{calendar}</div>;
  if (!streak) return <MissionsCard missions={currentMissions} />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <MissionsCard missions={currentMissions} />
      {calendar}
    </div>
  );
}
