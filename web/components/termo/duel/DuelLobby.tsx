"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { InviteFriendsButton } from "@/components/social/InviteFriendsButton";
import { MODES } from "@/lib/termo/logic";
import type { DuelPlayer, DuelState } from "@/lib/termo/duelRules";

// send_game_invite ainda recusa "termo"; ate o Servidor liberar, so o link/codigo
const INVITES_READY = false;

function Seat({ player, label }: { player: DuelPlayer | null; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-3">
      {player ? (
        <Avatar
          emoji={player.avatar.emoji}
          bgColor={player.avatar.bgColor}
          imageUrl={player.avatar.imageUrl}
          fallbackLetter={player.username.charAt(0).toUpperCase()}
          size="md"
        />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-muted)]" />
        </span>
      )}
      <span className="max-w-full truncate text-sm font-extrabold text-[var(--fg)]">{player ? player.username : "Esperando…"}</span>
      <span className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">{label}</span>
    </div>
  );
}

interface DuelLobbyProps {
  duel: DuelState;
  busy: boolean;
  onStart: () => void;
  onLeave: () => void;
}

/** Sala de espera: codigo e link pra mandar, convite pela lista de amigos e o botao Comecar do dono. */
export function DuelLobby({ duel, busy, onStart, onLeave }: DuelLobbyProps) {
  const [copied, setCopied] = useState(false);
  const isHost = duel.me.userId === duel.hostId;
  const host = isHost ? duel.me : duel.opponent;
  const guest = isHost ? duel.opponent : duel.me;
  const mode = MODES.find((m) => m.count === duel.boardCount)?.label ?? "Letrado";

  async function copyLink() {
    const url = `${window.location.origin}/games/termo?join=${duel.code}`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text: `Duelo no Letrado ${mode}! Entra aí: ${url}` });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // compartilhamento cancelado
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5 text-center">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">Duelo · {mode}</p>
        <p className="mt-1 font-display text-4xl font-extrabold tracking-[0.25em] text-[var(--fg)]">{duel.code}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-bold text-[var(--fg)] transition hover:bg-[var(--bg)]"
        >
          {copied ? <Check className="h-4 w-4 text-[var(--termo-correct)]" /> : <Copy className="h-4 w-4" />}
          {copied ? "Link copiado" : "Copiar link"}
        </button>
        {/* convite pela lista de amigos: liga quando o banco aceitar game = "termo" (pedido no vault) */}
        {INVITES_READY && isHost && !duel.opponent && <InviteFriendsButton game="termo" roomCode={duel.code} />}
      </div>

      <div className="flex w-full items-center gap-2">
        <Seat player={host} label="Dono" />
        <span className="font-display text-lg font-extrabold text-[var(--fg-muted)]">x</span>
        <Seat player={guest} label="Rival" />
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={busy || !duel.opponent}
          className="w-full rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-3 text-base font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2 disabled:opacity-50"
        >
          {duel.opponent ? "Começar" : "Esperando o rival entrar"}
        </button>
      ) : (
        <p className="text-sm font-bold text-[var(--fg-muted)]">Esperando {host?.username ?? "o dono"} começar…</p>
      )}

      <button onClick={onLeave} className="text-sm font-bold text-[var(--fg-muted)] underline-offset-2 hover:underline">
        {isHost ? "Cancelar sala" : "Sair da sala"}
      </button>
    </div>
  );
}
