import { io, Socket } from "socket.io-client";

const SERVER_URL = process.env.NEXT_PUBLIC_BUGGLE_SERVER_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getDrawSocket(): Socket {
  if (!socket) {
    // upgrade automatico pra websocket quebra a sessao atras do proxy do
    // Render/Cloudflare neste namespace ("Session ID unknown" apos o upgrade
    // falhar) - fica so em polling, mais lento mas confiavel
    socket = io(`${SERVER_URL}/draw`, { autoConnect: true, transports: ["polling"], upgrade: false });
  }
  return socket;
}
