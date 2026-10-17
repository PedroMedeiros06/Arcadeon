"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Swords } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LoginModal } from "@/components/LoginModal";
import { logActivity } from "@/lib/activity";
import { createDuel, fetchDuel, forfeitDuel, joinDuel, pingDuel, rematchDuel, startDuel, subscribeDuel } from "@/lib/termo/duel";
import type { DuelState } from "@/lib/termo/duelRules";
import type { BoardCount } from "@/lib/termo/logic";
import { DuelPick } from "./DuelPick";
import { DuelLobby } from "./DuelLobby";
import { DuelGame } from "./DuelGame";
import { DuelResult } from "./DuelResult";

const STORAGE_KEY = "termoDuelCode";
const SAFETY_POLL_MS = 10_000;
const PING_MS = 15_000;

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(code: string | null) {
  try {
    if (code) window.sessionStorage.setItem(STORAGE_KEY, code);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // armazenamento bloqueado: F5 volta pra escolha do modo
  }
}

/** Saida pelo aviso "Sair da partida?" (trocar de modo, voltar ao hub): conta como desistencia. */
export function forfeitCurrentDuel() {
  const code = readStored();
  writeStored(null);
  if (code) void forfeitDuel(code).catch(() => null);
}

interface DuelScreenProps {
  /** codigo vindo do link (?join=) */
  initialCode: string | null;
  acceptedWords: Set<string>;
  accents: Record<string, string>;
  message: string | null;
  setMessage: (m: string | null) => void;
  /** duelo em andamento: o pai confirma antes de sair */
  onActiveChange: (active: boolean) => void;
  /** volta pro Letrado normal */
  onExit: () => void;
}

/**
 * Duelo ao vivo: escolhe o modo, cria ou entra na sala, joga e mostra o resultado. O banco decide tudo
 * (termo_duel_*); aqui so segue o estado pelo Realtime, com uma busca a cada 10 s caso um evento se perca.
 */
export function DuelScreen({ initialCode, acceptedWords, accents, message, setMessage, onActiveChange, onExit }: DuelScreenProps) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [busy, setBusy] = useState(false);
  // so carrega se tem codigo (link ou F5); monta so no cliente, depois de escolher o modo
  const [booting, setBooting] = useState(() => !!(initialCode ?? readStored()));
  const [loginOpen, setLoginOpen] = useState(false);
  // duelo cujo resultado ja pode aparecer (depois da ultima linha virar, ou aberto ja terminado)
  const [resultFor, setResultFor] = useState<string | null>(null);
  // pedi revanche: a sala de espera nova mostra quem falta aceitar
  const [rematchWith, setRematchWith] = useState<string | null>(null);
  // respostas fora de ordem: so vale a da busca mais recente
  const seqRef = useRef(0);

  const apply = useCallback((next: DuelState | null) => {
    seqRef.current++;
    setDuel(next);
  }, []);

  const refresh = useCallback(async (code: string) => {
    const seq = ++seqRef.current;
    try {
      const next = await fetchDuel(code);
      if (seq === seqRef.current) setDuel(next);
    } catch {
      // sem rede agora: a proxima busca tenta de novo
    }
  }, []);

  // entrada: link com codigo, ou duelo guardado nesta aba (F5)
  const bootedRef = useRef(false);
  useEffect(() => {
    if (authLoading || bootedRef.current) return;
    const code = initialCode ?? readStored();
    // sem conta: espera o login (o link continua valendo)
    if (!userId || !code) return;
    bootedRef.current = true;
    (initialCode ? joinDuel(code) : fetchDuel(code))
      .then((s) => {
        // duelo velho guardado na aba: so retoma se ainda estiver valendo
        if (!initialCode && (s.status === "expired" || s.status === "finished")) {
          writeStored(null);
          return;
        }
        if (s.status === "finished") setResultFor(s.id);
        apply(s);
      })
      .catch((err: Error) => {
        writeStored(null);
        if (initialCode) setMessage(err.message);
      })
      .finally(() => setBooting(false));
    void logActivity("termo");
  }, [authLoading, userId, initialCode, apply, setMessage]);

  const duelId = duel?.id ?? null;
  const code = duel?.code ?? null;
  const live = duel?.status === "waiting" || duel?.status === "playing";
  // terminado continua ouvindo: e' por ai que chega o pedido de revanche do rival
  const watching = live || duel?.status === "finished";

  useEffect(() => {
    writeStored(live && code ? code : null);
    onActiveChange(duel?.status === "playing" && !duel.me.finishedAt);
  }, [live, code, duel?.status, duel?.me.finishedAt, onActiveChange]);

  // Realtime + busca de seguranca enquanto a sala esta valendo ou na tela final; sinal de vida so valendo
  useEffect(() => {
    if (!duelId || !code || !watching) return;
    const unsubscribe = subscribeDuel(duelId, () => void refresh(code));
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(code);
    }, SAFETY_POLL_MS);
    if (live) void pingDuel(code);
    const ping = live ? setInterval(() => void pingDuel(code), PING_MS) : undefined;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (live) void pingDuel(code);
      void refresh(code);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      clearInterval(poll);
      clearInterval(ping);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [duelId, code, live, watching, refresh]);

  async function run(action: () => Promise<DuelState | null>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await action();
      if (next) apply(next);
      return next;
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const finishedId = duel?.status === "finished" ? duel.id : null;
  const showResult = useCallback(() => setResultFor(finishedId), [finishedId]);

  const create = (count: BoardCount) => run(() => createDuel(count));
  const join = (c: string) => run(() => joinDuel(c));

  async function leave() {
    if (code && live) await forfeitDuel(code).catch(() => null);
    apply(null);
    setRematchWith(null);
    writeStored(null);
    onExit();
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-0 w-full max-w-md flex-1 flex-col items-center gap-4 overflow-y-auto pb-4 pt-2">
      {children}
      {message && (
        <p role="status" className="rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-center text-sm font-bold text-[var(--fg)]">
          {message}
        </p>
      )}
    </div>
  );

  if (authLoading) {
    return shell(<div className="mt-10 h-40 w-full animate-pulse rounded-3xl bg-[var(--border)]/40" />);
  }

  if (!userId) {
    return shell(
      <div className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
          <Swords className="h-6 w-6" />
        </span>
        <h2 className="font-display text-xl font-extrabold text-[var(--fg)]">Duelo</h2>
        <p className="text-sm font-medium text-[var(--fg-muted)]">Entre na sua conta para desafiar um amigo ao vivo.</p>
        <button
          onClick={() => setLoginOpen(true)}
          className="rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
        >
          Entrar
        </button>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>,
    );
  }

  if (booting) {
    return shell(<div className="mt-10 h-40 w-full animate-pulse rounded-3xl bg-[var(--border)]/40" />);
  }

  if (!duel || duel.status === "expired") {
    return shell(<DuelPick busy={busy} expired={duel?.status === "expired"} onCreate={create} onJoin={join} />);
  }

  if (duel.status === "waiting") {
    return shell(<DuelLobby duel={duel} busy={busy} waitingFor={rematchWith} onStart={() => run(() => startDuel(duel.code))} onLeave={leave} />);
  }

  if (duel.status === "finished" && resultFor === duel.id) {
    return shell(
      <DuelResult
        duel={duel}
        accents={accents}
        busy={busy}
        onRematch={() => {
          setRematchWith(duel.opponent?.username ?? null);
          void run(() => rematchDuel(duel.code));
        }}
        onExit={() => {
          apply(null);
          setRematchWith(null);
          onExit();
        }}
      />,
    );
  }

  return (
    <DuelGame
      duel={duel}
      acceptedWords={acceptedWords}
      accents={accents}
      message={message}
      setMessage={setMessage}
      onState={apply}
      onLeave={leave}
      onShowResult={showResult}
    />
  );
}
