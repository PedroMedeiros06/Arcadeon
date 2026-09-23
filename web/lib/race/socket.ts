import { io, Socket } from "socket.io-client";

const SERVER_URL = process.env.NEXT_PUBLIC_BUGGLE_SERVER_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getRaceSocket(): Socket {
  if (!socket) {
    // no SSR so cria o objeto, sem abrir conexao do servidor Next pro backend
    socket = io(`${SERVER_URL}/race`, { autoConnect: typeof window !== "undefined" });
  }
  return socket;
}
