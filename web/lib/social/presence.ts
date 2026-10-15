import { pushStatus } from "./api";
import type { StatusInput } from "./rules";

export type { StatusInput };

const HEARTBEAT_MS = 30_000;
let current: StatusInput | null = null;
let enabled = false;

function visible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/**
 * Marca o status do proprio usuario. Os jogos chamam na sala de espera e na partida.
 * Nunca lanca, nao precisa de await e nao faz nada sem login.
 */
export function setStatus(s: Pick<StatusInput, "state" | "place"> & Partial<StatusInput>): void {
  current = { game: null, roomCode: null, players: null, maxPlayers: null, ...s };
  if (enabled && visible()) void pushStatus(current);
}

export function getStatus(): StatusInput | null {
  return current;
}

/** Liga o envio do status pro usuario logado: agora, a cada 30 s com a aba visivel e ao voltar pra aba. */
export function startPresence(): () => void {
  enabled = true;
  const beat = () => {
    if (current && visible()) void pushStatus(current);
  };
  beat();
  const timer = setInterval(beat, HEARTBEAT_MS);
  const onVisibility = () => {
    if (visible()) beat();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    enabled = false;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
