"use client";

import { useEffect, useState } from "react";
import { Check, Copy, UserPlus, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFriends } from "@/lib/social/FriendsProvider";
import {
  fetchAppearOffline,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  setAppearOffline,
} from "@/lib/social/api";
import { isOnline, normalizeUsername, sortFriends } from "@/lib/social/rules";
import { LoginPrompt } from "@/components/LoginPrompt";
import { FriendRow } from "./FriendRow";
import { useNow } from "./useNow";

const CARD = "flex flex-col gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5";
const TITLE = "font-display text-lg font-extrabold tracking-tight text-[var(--fg)]";
const SMALL_BTN =
  "inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--bg)] disabled:opacity-60";

export function FriendsPageContent() {
  const { user, username, loading } = useAuth();
  const { available, friends, incoming, outgoing, refresh, notice, clearNotice } = useFriends();
  const now = useNow();
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offline, setOffline] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchAppearOffline().then((v) => alive && setOffline(v));
    return () => {
      alive = false;
    };
  }, [user]);

  if (loading) return null;
  if (!user) {
    return (
      <LoginPrompt
        title="Seus amigos ficam aqui"
        text="Entre na sua conta pra adicionar amigos, ver quem está online e chamar pra jogar."
      />
    );
  }
  if (!available) {
    return (
      <p className="rounded-3xl border-2 border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--fg-muted)]">
        A lista de amigos ainda não está disponível. Volte daqui a pouco.
      </p>
    );
  }

  const link = typeof window !== "undefined" && username ? `${window.location.origin}/amigo/${username}` : "";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const target = normalizeUsername(name);
    if (!target) {
      setMessage({ text: "Digite um nome de usuário com 3 a 20 letras, números, ponto, hífen ou _.", error: true });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const status = await sendFriendRequest(target);
      setMessage({ text: status === "accepted" ? `Agora você e ${target} são amigos` : `Pedido enviado pra ${target}`, error: false });
      setName("");
      await refresh();
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setSending(false);
    }
  }

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setMessage(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleOffline() {
    if (offline === null) return;
    const next = !offline;
    setOffline(next);
    try {
      await setAppearOffline(next);
    } catch (err) {
      setOffline(!next);
      setMessage({ text: (err as Error).message, error: true });
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ text: "Não deu pra copiar. Selecione o link e copie à mão.", error: true });
    }
  }

  const sorted = sortFriends(friends, now);
  const onlineCount = sorted.filter((f) => isOnline(f.presence, now)).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        {notice && (
          <p
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--primary-tint)] px-4 py-3 text-sm font-bold text-[var(--primary)]"
          >
            {notice}
            <button type="button" onClick={clearNotice} aria-label="Fechar aviso" className="rounded-lg p-1 hover:bg-[var(--card)]">
              <X className="h-4 w-4" />
            </button>
          </p>
        )}

        {incoming.length > 0 && (
          <section className={CARD}>
            <h2 className={TITLE}>Pedidos recebidos</h2>
            <ul className="flex flex-col gap-3">
              {incoming.map((f) => (
                <li key={f.friendshipId}>
                  <FriendRow
                    friend={f}
                    now={now}
                    actions={
                      <span className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === f.friendshipId}
                          onClick={() => act(f.friendshipId, () => respondFriendRequest(f.friendshipId, true))}
                          className={`${SMALL_BTN} border-transparent bg-[var(--primary)] text-white hover:bg-[var(--primary)] hover:brightness-110`}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden /> Aceitar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === f.friendshipId}
                          onClick={() => act(f.friendshipId, () => respondFriendRequest(f.friendshipId, false))}
                          className={SMALL_BTN}
                        >
                          Recusar
                        </button>
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={CARD}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={TITLE}>Amigos</h2>
            {sorted.length > 0 && (
              <p className="text-xs font-medium text-[var(--fg-muted)]">
                {onlineCount} de {sorted.length} online
              </p>
            )}
          </div>
          {sorted.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">
              Você ainda não tem amigos aqui. Mande um pedido pelo nome ou compartilhe seu link.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sorted.map((f) => (
                <li key={f.friendshipId}>
                  <FriendRow
                    friend={f}
                    now={now}
                    actions={
                      <button
                        type="button"
                        disabled={busyId === f.friendshipId}
                        onClick={() => {
                          if (window.confirm(`Remover ${f.username} dos amigos?`)) act(f.friendshipId, () => removeFriend(f.userId));
                        }}
                        aria-label={`Remover ${f.username}`}
                        className="shrink-0 rounded-xl p-2 text-[var(--fg-muted)] transition hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {outgoing.length > 0 && (
          <section className={CARD}>
            <h2 className={TITLE}>Pedidos enviados</h2>
            <ul className="flex flex-col gap-3">
              {outgoing.map((f) => (
                <li key={f.friendshipId}>
                  <FriendRow
                    friend={f}
                    now={now}
                    actions={
                      <button
                        type="button"
                        disabled={busyId === f.friendshipId}
                        onClick={() => act(f.friendshipId, () => removeFriend(f.userId))}
                        className={SMALL_BTN}
                      >
                        Cancelar
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-6 self-start">
        <section className={CARD}>
          <h2 className={TITLE}>Adicionar amigo</h2>
          <form onSubmit={add} className="flex flex-col gap-2">
            <label htmlFor="friend-name" className="text-sm font-bold text-[var(--fg)]">
              Nome de usuário
            </label>
            <div className="flex gap-2">
              <input
                id="friend-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="raposa"
                className="min-w-0 flex-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--primary)]"
              />
              <button
                type="submit"
                disabled={sending || name.trim() === ""}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" aria-hidden /> {sending ? "Mandando..." : "Mandar pedido"}
              </button>
            </div>
            {message && (
              <p
                role={message.error ? "alert" : "status"}
                className={`text-sm font-bold ${message.error ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}
              >
                {message.text}
              </p>
            )}
          </form>
        </section>

        {link && (
          <section className={CARD}>
            <h2 className={TITLE}>Seu link</h2>
            <p className="text-sm text-[var(--fg-muted)]">Quem abrir o link manda um pedido pra você, mesmo sem conta ainda.</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Seu link pessoal"
                className="min-w-0 flex-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--fg-muted)]"
              />
              <button type="button" onClick={copyLink} className={SMALL_BTN}>
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </section>
        )}

        {offline !== null && (
          <section className={CARD}>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="flex flex-col">
                <span className="text-sm font-bold text-[var(--fg)]">Aparecer offline</span>
                <span className="text-xs text-[var(--fg-muted)]">Seus amigos não veem onde você está.</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={offline}
                onChange={toggleOffline}
                className="h-5 w-5 accent-[var(--primary)]"
              />
            </label>
          </section>
        )}
      </div>
    </div>
  );
}
