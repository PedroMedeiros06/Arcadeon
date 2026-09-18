"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Crown, Settings, Smartphone, Tv, Users } from "lucide-react";
import { EditRoomModal } from "./EditRoomModal";
import type { RoomConfig, RoomState } from "@/lib/buggle/types";

interface RoomWaitingProps {
  room: RoomState;
  mySocketId: string;
  onStart: () => void;
  onToggleSpectator: (isSpectator: boolean) => void;
  onLeaveRoom: () => void;
  onUpdateConfig: (config: RoomConfig) => void;
  onTransferHost: (newHostSocketId: string) => void;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const STARS = Array.from({ length: 40 }, (_, i) => {
  let seed = i * 9973 + 17;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return {
    left: rand() * 100,
    top: rand() * 100,
    size: rand() < 0.7 ? 1 : 1.4,
    duration: 2 + rand() * 3,
    delay: rand() * 4,
  };
});

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function RoomWaiting({
  room,
  mySocketId,
  onStart,
  onToggleSpectator,
  onLeaveRoom,
  onUpdateConfig,
  onTransferHost,
}: RoomWaitingProps) {
  const isHost = room.hostSocketId === mySocketId;
  const me = room.players.find((p) => p.socketId === mySocketId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/games/buggle?join=${room.code}` : "";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-linear-to-br from-[#7c3fe0] via-[#5a2fc2] to-[#26124f]">
      {/* estrelinhas decorativas */}
      <div className="pointer-events-none absolute inset-0">
        {STARS.map((star, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className="absolute fill-white"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size * 3,
              height: star.size * 3,
              animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
            }}
          >
            <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
          </svg>
        ))}
      </div>

      {/* header borda-a-borda */}
      <div className="relative z-10 flex items-start justify-between p-4">
        <div className="flex flex-col gap-2">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLeaveRoom}
            className="mb-1 flex w-fit items-center gap-1 text-xs font-bold text-white/70 transition hover:text-white"
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            Sair
          </button>
          {room.players.map((p) => {
            const canTransfer = isHost && p.socketId !== mySocketId;
            return (
              <div key={p.socketId} className="relative">
                <div
                  onMouseDown={(e) => canTransfer && e.preventDefault()}
                  onClick={() => canTransfer && setTransferTargetId(p.socketId)}
                  className={`flex items-center gap-3 rounded-full bg-black/25 py-1.5 pl-1.5 pr-4 backdrop-blur ${
                    canTransfer ? "cursor-pointer transition hover:bg-black/40" : ""
                  }`}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-white"
                    style={{ backgroundColor: colorFor(p.socketId) }}
                  >
                    {p.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="flex items-center gap-1 text-sm font-bold text-white">
                      {p.name}
                      {p.socketId === room.hostSocketId && (
                        <Crown size={13} className="fill-yellow-400 text-yellow-400" />
                      )}
                    </span>
                    {p.socketId === room.hostSocketId && (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-yellow-300">
                        Host
                      </span>
                    )}
                  </div>
                  {p.isSpectator && (
                    <span className="flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-[#2c1568]">
                      <Tv size={10} strokeWidth={3} />
                      TV
                    </span>
                  )}
                </div>

                {transferTargetId === p.socketId && (
                  <div className="absolute left-0 top-full z-20 mt-1 flex flex-col gap-1 rounded-xl bg-white p-2 shadow-xl">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onTransferHost(p.socketId);
                        setTransferTargetId(null);
                      }}
                      className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold text-[#2c1568] transition hover:bg-[#f4f1ff]"
                    >
                      <Crown size={14} />
                      Tornar anfitriao
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setTransferTargetId(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-400 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-sm font-bold text-white backdrop-blur">
          <Users size={16} strokeWidth={2.5} />
          {room.players.length}/{room.config.maxPlayers}
        </div>
      </div>

      {/* corpo central */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10">
        <h1
          className="text-5xl font-black italic tracking-tight text-yellow-300 drop-shadow-[3px_3px_0_rgba(44,21,104,0.9)] sm:text-6xl"
          style={{ WebkitTextStroke: "2px #2c1568" }}
        >
          Buggle
        </h1>

        <div className="relative flex flex-col items-center gap-3 rounded-3xl border-2 border-white/20 bg-black/20 px-8 py-6 shadow-2xl backdrop-blur-sm">
          <p className="text-center text-sm font-bold text-white">
            Escaneie com a camera
            <br />
            do celular
          </p>

          <div className="relative rounded-xl bg-white p-3">
            {joinUrl && <QRCodeSVG value={joinUrl} size={180} fgColor="#2c1568" />}
          </div>

          <div
            className="absolute -right-5 top-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-[#3ec6ff] via-[#1cb0f6] to-[#0f7fd8] shadow-[0_10px_25px_-5px_rgba(28,176,246,0.7)] ring-4 ring-white/25"
            style={{ animation: "floatBadge 3s ease-in-out infinite" }}
          >
            <Smartphone size={24} className="text-white drop-shadow" strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-semibold text-white/60">ou digite o codigo</p>
          <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-white drop-shadow">
            {room.code}
          </p>
        </div>

        <div className="text-center text-xs text-white/60">
          Tabuleiro {room.config.boardSize}x{room.config.boardSize} · {room.config.roundSeconds}s ·
          min. {room.config.minWordLength} letras · {room.config.visibility === "public" ? "publica" : "privada"}
        </div>

        {isHost && (
          <label className="flex items-center gap-2 text-sm font-semibold text-white">
            <input
              type="checkbox"
              checked={me?.isSpectator ?? false}
              onChange={(e) => onToggleSpectator(e.target.checked)}
            />
            Usar esta tela como TV (so exibir, nao jogar)
          </label>
        )}

        {isHost ? (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onStart}
            className="rounded-xl border-2 border-yellow-500 bg-yellow-400 px-8 py-3 font-extrabold text-[#2c1568] shadow-[0_4px_0_#b8860b] transition active:translate-y-1 active:border-b-2 active:shadow-none"
          >
            Iniciar partida
          </button>
        ) : (
          <p className="font-semibold text-white/80">Aguardando o anfitriao iniciar...</p>
        )}

        {isHost && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-white"
          >
            <Settings size={16} />
            Editar partida
          </button>
        )}
      </div>

      {showEditModal && (
        <EditRoomModal
          config={room.config}
          currentPlayerCount={room.players.length}
          onSave={onUpdateConfig}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
