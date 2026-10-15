"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useFriends } from "@/lib/social/FriendsProvider";
import { respondGameInvite } from "@/lib/social/api";
import { getStatus } from "@/lib/social/presence";
import { inviteHref, inviteText } from "@/lib/social/rules";

/** Aviso no canto: convite que acabou de chegar ou resultado do pedido feito pelo link pessoal. */
export function SocialToaster() {
  const { toast, dismissToast, notice, clearNotice, refresh } = useFriends();
  const router = useRouter();
  const pathname = usePathname();
  const inGame = pathname.startsWith("/games/");
  // no meio da partida o convite fica so no sino
  const invite = toast && getStatus()?.place !== "match" ? toast : null;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, Math.max(0, Date.parse(toast.expiresAt) - Date.now()));
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  useEffect(() => {
    if (!notice || pathname.startsWith("/amigo")) return;
    const t = setTimeout(clearNotice, 6000);
    return () => clearTimeout(t);
  }, [notice, clearNotice, pathname]);

  if (!invite && (!notice || pathname.startsWith("/amigo"))) return null;

  async function answer(accept: boolean) {
    if (!invite) return;
    dismissToast();
    try {
      await respondGameInvite(invite.id, accept);
    } catch {
      // convite vencido ou ja respondido: ainda da pra tentar entrar pela sala
    }
    refresh();
    if (accept) router.push(inviteHref(invite));
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-4 right-4 z-50 flex flex-col gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4 shadow-xl shadow-black/10 animate-[scaleIn_0.15s_ease-out] motion-reduce:animate-none sm:right-auto sm:w-96 ${
        inGame ? "bottom-4" : "bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6"
      }`}
    >
      {invite ? (
        <>
          <p className="text-sm font-bold text-[var(--fg)]">{inviteText(invite)}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => answer(true)}
              className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98]"
            >
              Entrar na sala
            </button>
            <button
              type="button"
              onClick={() => answer(false)}
              className="flex-1 rounded-xl border-2 border-[var(--border)] px-3 py-2 text-sm font-bold text-[var(--fg)] transition hover:bg-[var(--bg)]"
            >
              Agora não
            </button>
          </div>
        </>
      ) : (
        <p className="flex items-center justify-between gap-3 text-sm font-bold text-[var(--fg)]">
          {notice}
          <button
            type="button"
            onClick={clearNotice}
            aria-label="Fechar aviso"
            className="rounded-lg p-1 text-[var(--fg-muted)] hover:bg-[var(--bg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </p>
      )}
    </div>
  );
}
