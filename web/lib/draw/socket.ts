import { io, Socket } from "socket.io-client";
import type { DrawSession } from "./types";

// remove barra final: env var com "https://host.com/" geraria "//draw"
// (barra dupla) na URL do namespace, e o Engine.IO rejeita isso como
// "Invalid namespace" em vez de conectar em /draw
const SERVER_URL = (process.env.NEXT_PUBLIC_BUGGLE_SERVER_URL ?? "http://localhost:3001").replace(/\/$/, "");

let socket: Socket | null = null;

export function getDrawSocket(): Socket {
  if (!socket) {
    // upgrade automatico pra websocket quebra a sessao atras do proxy do
    // Render/Cloudflare neste namespace ("Session ID unknown" apos o upgrade
    // falhar) - fica so em polling, mais lento mas confiavel
    socket = io(`${SERVER_URL}/draw`, {
      autoConnect: true,
      transports: ["polling"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });
  }
  return socket;
}

// Sessao da sala atual (id + token do jogador). sessionStorage sobrevive ao F5 mas e por aba:
// duas abas no mesmo navegador continuam sendo dois jogadores diferentes.
const SESSION_KEY = "drawSession";

export function loadDrawSession(): DrawSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DrawSession;
    return parsed?.code && parsed.playerId && parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDrawSession(session: DrawSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // modo privado/sem storage: so perde a retomada apos F5
  }
}

export function clearDrawSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // idem
  }
}
