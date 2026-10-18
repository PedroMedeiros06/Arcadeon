import { io, Socket } from "socket.io-client";

// remove barra final: "https://host.com/" geraria "//cofre" e o Engine.IO recusa como "Invalid namespace"
const SERVER_URL = (process.env.NEXT_PUBLIC_BUGGLE_SERVER_URL ?? "http://localhost:3001").replace(/\/$/, "");

let socket: Socket | null = null;

export function getCofreSocket(): Socket {
  if (!socket) {
    // no SSR so cria o objeto, sem abrir conexao do servidor Next pro backend
    socket = io(`${SERVER_URL}/cofre`, { autoConnect: typeof window !== "undefined" });
  }
  return socket;
}
