import { io, Socket } from "socket.io-client";

const SERVER_URL = process.env.NEXT_PUBLIC_BUGGLE_SERVER_URL ?? "http://localhost:3001";

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

    // logs temporarios de diagnostico, ajudam a ver o estado da conexao no
    // console do navegador em producao
    socket.on("connect", () => console.log("[drawit-socket] connected", socket!.id));
    socket.on("disconnect", (reason) => console.log("[drawit-socket] disconnected", reason));
    socket.on("connect_error", (err) => console.log("[drawit-socket] connect_error", err.message));
    socket.io.on("reconnect_attempt", (attempt) => console.log("[drawit-socket] reconnect_attempt", attempt));
    socket.io.on("reconnect_failed", () => console.log("[drawit-socket] reconnect_failed"));
    socket.io.on("error", (err) => console.log("[drawit-socket] manager error", err.message));
  }
  return socket;
}
