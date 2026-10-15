"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { fetchFriends, fetchInvites, sendFriendRequest } from "./api";
import { getStatus } from "./presence";
import { applyStatusRow, friendshipEventRelevant, splitFriends, type Friend, type GameInvite } from "./rules";

const PENDING_KEY = "arcadeon_pending_friend";
const PENDING_TTL_MS = 3_600_000;
// rede do Realtime cai (celular dormindo, troca de rede) e eventos se perdem; uma busca lenta cobre
const SAFETY_POLL_MS = 60_000;

interface FriendsValue {
  /** false sem login ou enquanto o banco nao tem `my_friends` */
  available: boolean;
  /** primeira busca desta conta ainda nao voltou */
  loading: boolean;
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

interface Note<T> {
  userId: string;
  value: T;
}

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // aviso e convite ficam presos a conta que recebeu; trocar de conta nao mostra o da anterior
  const [toast, setToast] = useState<Note<GameInvite> | null>(null);
  const [notice, setNotice] = useState<Note<string> | null>(null);
  const listRef = useRef<Friend[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [list, invites] = await Promise.all([fetchFriends(), fetchInvites()]);
    setLoaded((prev) => {
      // uma falha passageira nao apaga a lista boa que ja estava na tela
      if (!list && prev?.userId === userId && prev.list) return prev;
      return { userId, list, invites: invites ?? [] };
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // varias mudancas juntas viram uma busca so
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => alive && refresh(), 400);
    };

    const pending = takePendingFriend();
    (pending
      ? sendFriendRequest(pending)
          .then(
            (s) =>
              alive &&
              setNotice({ userId, value: s === "accepted" ? `Agora você e ${pending} são amigos` : `Pedido enviado pra ${pending}` }),
          )
          .catch((err: Error) => alive && setNotice({ userId, value: err.message }))
      : Promise.resolve()
    ).finally(() => alive && refresh());

    const supabase = createClient();
    const channel = supabase
      // topico unico por montagem: um canal antigo ainda saindo nao engole a assinatura nova
      .channel(`social:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, (payload) => {
        if (friendshipEventRelevant(payload, userId, listRef.current)) soon();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_status" }, (payload) => {
        // batida de amigo muda so a linha dele; nada de buscar a lista inteira a cada 30 s
        setLoaded((l) => {
          if (!l || l.userId !== userId || !l.list) return l;
          const next = applyStatusRow(l.list, payload.new);
          return next ? { ...l, list: next } : l;
        });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_invites", filter: `to_id=eq.${userId}` },
        async () => {
          const invites = await fetchInvites();
          if (!alive || !invites) return;
          setLoaded((l) => (l && l.userId === userId ? { ...l, invites } : l));
          // no meio da partida o convite fica so no sino
          if (getStatus()?.place === "match") return;
          const newest = [...invites].sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0];
          if (newest) setToast({ userId, value: newest });
        },
      )
      // reconectou: o que mudou enquanto a conexao estava fora nao chega por evento
      .subscribe((status) => {
        if (status === "SUBSCRIBED") soon();
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") soon();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, SAFETY_POLL_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const mine = loaded && loaded.userId === userId ? loaded : null;
  useEffect(() => {
    listRef.current = mine?.list ?? [];
  }, [mine]);

  const dismissToast = useCallback(() => setToast(null), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<FriendsValue>(() => {
    const split = splitFriends(mine?.list ?? []);
    return {
      available: !!mine?.list,
      loading: !!userId && !mine,
      ...split,
      invites: mine?.invites ?? [],
      refresh,
      toast: toast && toast.userId === userId ? toast.value : null,
      dismissToast,
      notice: notice && notice.userId === userId ? notice.value : null,
      clearNotice,
    };
  }, [mine, userId, refresh, toast, notice, dismissToast, clearNotice]);

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriends must be used within FriendsProvider");
  return ctx;
}
