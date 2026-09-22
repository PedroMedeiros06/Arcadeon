import { io, Socket } from "socket.io-client";

const SERVER_URL = process.env.NEXT_PUBLIC_BUGGLE_SERVER_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getDrawSocket(): Socket {
  if (!socket) {
    socket = io(`${SERVER_URL}/draw`, { autoConnect: true });
  }
  return socket;
}
