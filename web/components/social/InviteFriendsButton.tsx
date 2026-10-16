"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, UserPlus, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFriends } from "@/lib/social/FriendsProvider";
import { sendGameInvite } from "@/lib/social/api";
import { sortFriends } from "@/lib/social/rules";
import { FriendRow } from "./FriendRow";
import { useNow } from "./useNow";

/** Botao da sala de espera: abre a lista de amigos (online primeiro) com "Convidar". */
export function InviteFriendsButton({ game, roomCode }: { game: "buggle" | "drawit" | "corrida" | "termo"; roomCode: string }) {
  const { user } = useAuth();
  const { available, friends } = useFriends();
  const now = useNow();
  const [open, setOpen] = useState(false);
  // por amigo: "sending", "sent" ou a mensagem de erro
  const [sent, setSent] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user || !available) return null;

  async function invite(userId: string) {
    setSent((s) => ({ ...s, [userId]: "sending" }));
    try {
      await sendGameInvite(userId, game, roomCode);
      setSent((s) => ({ ...s, [userId]: "sent" }));
    } catch (err) {
      setSent((s) => ({ ...s, [userId]: (err as Error).message }));
    }
  }

  const sorted = sortFriends(friends, now);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-bold text-[var(--fg)] transition hover:bg-[var(--bg)]"
      >
        <UserPlus className="h-4 w-4" aria-hidden /> Convidar amigos
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80dvh] w-full max-w-md flex-col gap-4 overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="invite-title" className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">
                Convidar amigos
              </h2>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-xl p-2 text-[var(--fg-muted)] hover:bg-[var(--bg)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sorted.length === 0 ? (
              <p className="text-sm text-[var(--fg-muted)]">
                Você ainda não tem amigos no Arcadeon.{" "}
                <Link href="/amigos" className="font-bold text-[var(--primary)] hover:underline">
                  Adicionar amigos
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-3 overflow-y-auto">
                {sorted.map((f) => {
                  const s = sent[f.userId];
                  return (
                    <li key={f.friendshipId} className="flex flex-col gap-1">
                      <FriendRow
                        friend={f}
                        now={now}
                        hideJoin
                        actions={
                          s === "sent" ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--fg-muted)]">
                              <Check className="h-3.5 w-3.5" aria-hidden /> Convidado
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => invite(f.userId)}
                              disabled={s === "sending"}
                              aria-label={`Convidar ${f.username}`}
                              className="shrink-0 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
                            >
                              {s === "sending" ? "Mandando..." : "Convidar"}
                            </button>
                          )
                        }
                      />
                      {s && s !== "sent" && s !== "sending" && (
                        <p role="alert" className="pl-12 text-xs font-bold text-[var(--danger)]">
                          {s}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
