"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Crown, Pencil, Settings, Smartphone, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { EditRoomModal } from "./EditRoomModal";
import { AvatarEditModal } from "./AvatarEditModal";
import { TransferHostModal } from "./TransferHostModal";
import type { RoomConfig, RoomState } from "@/lib/buggle/types";

interface RoomWaitingProps {
  room: RoomState;
  mySocketId: string;
  onStart: () => void;
  onLeaveRoom: () => void;
  onUpdateConfig: (config: RoomConfig) => void;
  onTransferHost: (newHostSocketId: string) => void;
  onRenamePlayer: (name: string) => void;
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
  onLeaveRoom,
  onUpdateConfig,
  onTransferHost,
  onRenamePlayer,
}: RoomWaitingProps) {
  const { equippedAvatar } = useAuth();
  const isOwner = room.ownerSocketId === mySocketId;
  const isHost = room.hostSocketId === mySocketId;
  const me = room.players.find((p) => p.socketId === mySocketId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
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

      {/* header */}
      <div className="relative z-10 flex items-center justify-between p-4">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onLeaveRoom}
          className="flex items-center gap-1 text-xs font-bold text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Sair
        </button>

        <div className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-sm font-bold text-white backdrop-blur">
          <Users size={16} strokeWidth={2.5} />
          {room.players.length}/{room.config.maxPlayers}
        </div>
      </div>

      {/* corpo central */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-10">
        <h1
          className="text-5xl font-black italic tracking-tight text-yellow-300 drop-shadow-[3px_3px_0_rgba(44,21,104,0.9)] sm:text-6xl"
          style={{ WebkitTextStroke: "2px #2c1568" }}
        >
          Buggle
        </h1>

        {isOwner ? (
          <>
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

            {/* card de opcoes: lista de jogadores (so leitura, TV nao transfere host) */}
            <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border-2 border-white/20 bg-black/20 p-3 backdrop-blur-sm">
              <p className="px-1 text-xs font-bold uppercase tracking-wide text-white/50">Jogadores</p>
              {room.players.length === 0 && (
                <p className="px-1 py-2 text-center text-sm font-semibold text-white/50">
                  Aguardando jogadores entrarem...
                </p>
              )}
              {room.players.map((p) => (
                <div key={p.socketId} className="flex items-center gap-3 rounded-xl bg-black/20 py-2 pl-2 pr-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                    style={{ backgroundColor: colorFor(p.socketId) }}
                  >
                    {p.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="flex items-center gap-1 truncate text-sm font-bold text-white">
                      {p.name}
                      {p.socketId === room.hostSocketId && (
                        <Crown size={13} className="fill-yellow-400 text-yellow-400" />
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs font-semibold text-white/60">
              O anfitriao ({room.players.find((p) => p.socketId === room.hostSocketId)?.name ?? "..."}) inicia a
              partida pelo proprio celular.
            </p>
          </>
        ) : (
          /* jogador: proprio avatar + status, host tem controles de iniciar/editar/transferir */
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <span className="block overflow-hidden rounded-2xl ring-4 ring-white/25">
                <Avatar
                  emoji={equippedAvatar?.emoji}
                  bgColor={equippedAvatar?.bg_color}
                  imageUrl={equippedAvatar?.image_url}
                  fallbackLetter={(me?.name ?? "?").trim().charAt(0).toUpperCase()}
                  size="xl"
                  shape="square"
                />
              </span>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowAvatarModal(true)}
                className="absolute -left-2 -top-2 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-white/40 bg-white text-[#2c1568] shadow transition hover:scale-105"
                title="Trocar avatar"
              >
                <Pencil size={14} strokeWidth={2.5} />
              </button>
              {isHost && (
                <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2c1568] shadow">
                  <Crown size={10} className="fill-[#2c1568]" />
                  Anfitriao
                </span>
              )}
            </div>
            <p className="text-xl font-extrabold text-white">{me?.name}</p>

            {isHost ? (
              <>
                <p className="text-xs font-semibold text-white/60">
                  Codigo: <span className="font-mono tracking-widest text-white">{room.code}</span>
                </p>

                {room.players.length > 1 && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowTransferModal(true)}
                    className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-black/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black/40"
                  >
                    <Crown size={15} />
                    Mudar anfitriao
                  </button>
                )}

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onStart}
                  className="w-full max-w-xs rounded-xl border-2 border-yellow-500 bg-yellow-400 py-3.5 text-lg font-extrabold text-[#2c1568] shadow-[0_4px_0_#b8860b] transition active:translate-y-1 active:border-b-2 active:shadow-none"
                >
                  Comecar
                </button>

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-white"
                >
                  <Settings size={16} />
                  Editar partida
                </button>
              </>
            ) : (
              <p className="font-semibold text-white/80">Aguardando o anfitriao iniciar...</p>
            )}
          </div>
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

      {showAvatarModal && (
        <AvatarEditModal
          name={me?.name ?? ""}
          onNameChange={onRenamePlayer}
          onClose={() => setShowAvatarModal(false)}
        />
      )}

      {showTransferModal && (
        <TransferHostModal
          room={room}
          mySocketId={mySocketId}
          onTransferHost={onTransferHost}
          onClose={() => setShowTransferModal(false)}
        />
      )}
    </div>
  );
}
