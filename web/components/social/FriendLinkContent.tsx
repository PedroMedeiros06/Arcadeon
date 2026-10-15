"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { rememberPendingFriend, useFriends } from "@/lib/social/FriendsProvider";
import { sendFriendRequest } from "@/lib/social/api";
import { normalizeUsername } from "@/lib/social/rules";
import { LoginModal } from "@/components/LoginModal";

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2 disabled:opacity-70";

export function FriendLinkContent({ rawUsername }: { rawUsername: string }) {
  const { user, username: me, loading } = useAuth();
  const { available, loading: friendsLoading, friends, outgoing, refresh, notice } = useFriends();
  const [loginOpen, setLoginOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  const target = normalizeUsername(rawUsername);
  const same = (a: string) => a.toLowerCase() === target?.toLowerCase();

  if (loading) return null;
  if (!target) return <Shell title="Link inválido" text="Esse link de amigo não existe. Peça o link de novo pra quem te mandou." />;

  if (!user) {
    return (
      <Shell title={`${target} te chamou pro Arcadeon`} text="Entre ou crie sua conta e o pedido de amizade sai na hora.">
        <button
          type="button"
          className={PRIMARY}
          onClick={() => {
            rememberPendingFriend(target);
            setLoginOpen(true);
          }}
        >
          <LogIn className="h-4 w-4" aria-hidden /> Entrar e adicionar
        </button>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </Shell>
    );
  }

  if (me && same(me)) {
    return (
      <Shell title="Esse é o seu link" text="Mande pra quem você quer adicionar. Quem abrir manda um pedido pra você.">
        <Link href="/amigos" className={PRIMARY}>
          Ver amigos
        </Link>
      </Shell>
    );
  }

  const already = friends.some((f) => same(f.username));
  const pending = outgoing.some((f) => same(f.username));

  async function add() {
    setSending(true);
    setResult(null);
    try {
      const status = await sendFriendRequest(target!);
      setResult({ text: status === "accepted" ? `Agora você e ${target} são amigos` : `Pedido enviado pra ${target}`, error: false });
      await refresh();
    } catch (err) {
      setResult({ text: (err as Error).message, error: true });
    } finally {
      setSending(false);
    }
  }

  const message = result ?? (notice ? { text: notice, error: false } : null);

  return (
    <Shell title={`Adicionar ${target}`} text="Amigos veem quando você está online e podem te chamar pra jogar.">
      {already ? (
        <p className="text-sm font-bold text-[var(--primary)]">Vocês já são amigos.</p>
      ) : pending && !result ? (
        <p className="text-sm font-bold text-[var(--fg-muted)]">Pedido enviado. Falta {target} aceitar.</p>
      ) : result && !result.error ? null : (
        // depois de um envio certo o botao some; depois de erro, continua pra tentar de novo
        <button type="button" className={PRIMARY} onClick={add} disabled={sending || !available}>
          <UserPlus className="h-4 w-4" aria-hidden /> {sending ? "Mandando..." : `Adicionar ${target}`}
        </button>
      )}
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={`text-sm font-bold ${message.error ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}
        >
          {message.text}
        </p>
      )}
      {!available && !friendsLoading && <p className="text-sm text-[var(--fg-muted)]">Amizades ainda não estão disponíveis. Volte daqui a pouco.</p>}
      <Link href="/amigos" className="text-sm font-bold text-[var(--primary)] hover:underline">
        Ver meus amigos
      </Link>
    </Shell>
  );
}

function Shell({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] px-6 py-10 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--fg)]">{title}</h1>
      <p className="text-sm text-[var(--fg-muted)]">{text}</p>
      {children && <div className="mt-2 flex flex-col items-center gap-3">{children}</div>}
    </div>
  );
}
