"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useFriends } from "@/lib/social/FriendsProvider";
import { respondFriendRequest, respondGameInvite } from "@/lib/social/api";
import { inviteHref, inviteText } from "@/lib/social/rules";

const YES = "flex-1 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110";
const NO =
  "flex-1 rounded-xl border-2 border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--card)]";

/** Pedidos de amizade e convites que chegaram, inclusive com a aba fechada. */
export function NotificationBell() {
  const { available, incoming, invites, refresh } = useFriends();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!available) return null;
  const count = incoming.length + invites.length;

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
    } catch {
      // ja respondido em outra aba: a lista nova resolve
    }
    refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={count === 0 ? "Notificações" : `Notificações, ${count} ${count === 1 ? "nova" : "novas"}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] transition hover:border-[var(--border-hover)]"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[0.65rem] font-extrabold tabular-nums text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        // no celular o sino nao fica na ponta do header: o menu ocupa a largura da tela
        <div className="fixed inset-x-4 top-16 z-50 mt-2 rounded-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-80 border-2 border-[var(--border)] bg-[var(--card)] p-3 shadow-xl shadow-black/10 animate-[scaleIn_0.15s_ease-out] motion-reduce:animate-none">
          {count === 0 ? (
            <p className="px-2 py-3 text-sm text-[var(--fg-muted)]">Nada novo por aqui.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 rounded-xl bg-[var(--bg)] p-3">
                  <p className="text-sm font-bold text-[var(--fg)]">{inviteText(i)}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        run(() => respondGameInvite(i.id, true));
                        router.push(inviteHref(i));
                      }}
                      className={YES}
                    >
                      Entrar na sala
                    </button>
                    <button type="button" onClick={() => run(() => respondGameInvite(i.id, false))} className={NO}>
                      Agora não
                    </button>
                  </div>
                </li>
              ))}
              {incoming.map((f) => (
                <li key={f.friendshipId} className="flex flex-col gap-2 rounded-xl bg-[var(--bg)] p-3">
                  <p className="text-sm font-bold text-[var(--fg)]">{f.username} quer ser seu amigo</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => run(() => respondFriendRequest(f.friendshipId, true))} className={YES}>
                      Aceitar
                    </button>
                    <button type="button" onClick={() => run(() => respondFriendRequest(f.friendshipId, false))} className={NO}>
                      Recusar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/amigos"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-xl px-2 py-2 text-center text-sm font-bold text-[var(--primary)] hover:bg-[var(--bg)]"
          >
            Ver amigos
          </Link>
        </div>
      )}
    </div>
  );
}
