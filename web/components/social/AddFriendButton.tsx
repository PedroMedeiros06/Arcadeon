"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFriends } from "@/lib/social/FriendsProvider";
import { sendFriendRequestTo } from "@/lib/social/api";

/** "Adicionar" ao lado de um jogador logado na tela de resultado. */
export function AddFriendButton({ userId, username }: { userId: string; username: string }) {
  const { user } = useAuth();
  const { available, friends, outgoing, refresh } = useFriends();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!user || !available || user.id === userId) return null;
  if (friends.some((f) => f.userId === userId)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--fg-muted)]">
        <Check className="h-3.5 w-3.5" aria-hidden /> Amigos
      </span>
    );
  }
  if (state === "sent" || outgoing.some((f) => f.userId === userId)) {
    return <span className="text-xs font-bold text-[var(--fg-muted)]">Pedido enviado</span>;
  }

  async function add() {
    setState("sending");
    setError(null);
    try {
      await sendFriendRequestTo(userId);
      setState("sent");
      refresh();
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={add}
        disabled={state === "sending"}
        aria-label={`Adicionar ${username} aos amigos`}
        className="inline-flex items-center gap-1 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--bg)] disabled:opacity-60"
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden /> {state === "sending" ? "Mandando..." : "Adicionar"}
      </button>
      {error && (
        <span role="alert" className="text-xs font-bold text-[var(--danger)]">
          {error}
        </span>
      )}
    </span>
  );
}
