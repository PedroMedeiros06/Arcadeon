"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { fetchFriends, fetchInvites, sendFriendRequest } from "./api";
import { splitFriends, type Friend, type GameInvite } from "./rules";

const PENDING_KEY = "arcadeon_pending_friend";
const PENDING_TTL_MS = 3_600_000;

interface FriendsValue {
  /** false sem login ou enquanto o banco nao tem `my_friends` */
  available: boolean;
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  invites: GameInvite[];
  refresh: () => Promise<void>;
  /** convite que acabou de chegar, pro aviso */
  toast: GameInvite | null;
  dismissToast: () => void;
  /** resultado do pedido guardado pelo link pessoal antes do login */
  notice: string | null;
  clearNotice: () => void;
}

const FriendsContext = createContext<FriendsValue | undefined>(undefined);

/** Guarda o pedido feito pelo link pessoal por quem ainda nao entrou; sai assim que a pessoa entra. */
export function rememberPendingFriend(username: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ username, at: Date.now() }));
  } catch {
    // storage bloqueado: a pessoa manda o pedido de novo depois de entrar
  }
}

function takePendingFriend(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    const p = raw ? (JSON.parse(raw) as { username?: unknown; at?: unknown }) : null;
    if (typeof p?.username !== "string" || typeof p.at !== "number" || Date.now() - p.at > PENDING_TTL_MS) return null;
    return p.username;
  } catch {
    return null;
  }
}

interface Loaded {
  userId: string;
  list: Friend[] | null;
  invites: GameInvite[];
}

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [toast, setToast] = useState<GameInvite | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [list, invites] = await Promise.all([fetchFriends(), fetchInvites()]);
    setLoaded({ userId, list, invites: invites ?? [] });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // varias mudancas juntas (amigo trocando de pagina) viram uma busca so
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => alive && refresh(), 400);
    };

    const pending = takePendingFriend();
    (pending
      ? sendFriendRequest(pending)
          .then((s) => alive && setNotice(s === "accepted" ? `Agora você e ${pending} são amigos` : `Pedido enviado pra ${pending}`))
          .catch((err: Error) => alive && setNotice(err.message))
      : Promise.resolve()
    ).finally(() => alive && refresh());

    const supabase = createClient();
    const channel = supabase
      .channel(`social:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_status" }, (payload) => {
        // o proprio batimento a cada 30 s nao precisa recarregar a lista
        if ((payload.new as { user_id?: string } | null)?.user_id === userId) return;
        soon();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_invites", filter: `to_id=eq.${userId}` },
        async () => {
          const invites = await fetchInvites();
          if (!alive || !invites) return;
          setLoaded((l) => (l && l.userId === userId ? { ...l, invites } : l));
          const newest = [...invites].sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0];
          if (newest) setToast(newest);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const value = useMemo<FriendsValue>(() => {
    const mine = loaded && loaded.userId === userId ? loaded : null;
    const split = splitFriends(mine?.list ?? []);
    return {
      available: !!mine?.list,
      ...split,
      invites: mine?.invites ?? [],
      refresh,
      toast: userId ? toast : null,
      dismissToast: () => setToast(null),
      notice: userId ? notice : null,
      clearNotice: () => setNotice(null),
    };
  }, [loaded, userId, refresh, toast, notice]);

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriends must be used within FriendsProvider");
  return ctx;
}
