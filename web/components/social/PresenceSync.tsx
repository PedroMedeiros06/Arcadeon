"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getStatus, setStatus, startPresence } from "@/lib/social/presence";
import { nextStatus } from "@/lib/social/rules";

/** Marca a pagina atual no status; na rota de um jogo, quem marca sala e partida e o proprio jogo. */
export function PresenceSync() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pathname = usePathname();

  useEffect(() => {
    if (!userId) return;
    return startPresence();
  }, [userId]);

  useEffect(() => {
    const next = nextStatus(getStatus(), pathname);
    if (next) setStatus(next);
  }, [pathname]);

  return null;
}
