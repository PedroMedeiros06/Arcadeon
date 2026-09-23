import { io, Socket } from "socket.io-client";

// remove barra final: env var com "https://host.com/" geraria "//race"
// (barra dupla) na URL do namespace, e o Engine.IO rejeita isso como
// "Invalid namespace" em vez de conectar em /race
const SERVER_URL = (process.env.NEXT_PUBLIC_BUGGLE_SERVER_URL ?? "http://localhost:3001").replace(/\/$/, "");

let socket: Socket | null = null;

export function getRaceSocket(): Socket {
  if (!socket) {
    // no SSR so cria o objeto, sem abrir conexao do servidor Next pro backend
    socket = io(`${SERVER_URL}/race`, { autoConnect: typeof window !== "undefined" });
  }
  return socket;
}
