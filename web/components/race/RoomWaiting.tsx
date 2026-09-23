"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, CircleHelp, Crown, Pencil, Settings, Smartphone, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AvatarEditModal } from "@/components/buggle/AvatarEditModal";
import { EditRoomModal, TransferHostModal } from "./RoomModals";
import { SoundToggle } from "./SoundToggle";
import type { PlayerAvatar, RaceRoomConfig, RaceRoomState } from "@/lib/race/types";

interface RoomWaitingProps {
  room: RaceRoomState;
  mySocketId: string;
  onStart: () => void;
  onLeaveRoom: () => void;
  onUpdateConfig: (config: RaceRoomConfig) => void;
  onTransferHost: (newHostSocketId: string) => void;
  onRename: (name: string) => void;
  onUpdateAvatar: (avatar: PlayerAvatar) => void;
  onHowToPlay: () => void;
}

export function RoomWaiting({
  room,
  mySocketId,
  onStart,
  onLeaveRoom,
  onUpdateConfig,
  onTransferHost,
  onRename,
  onUpdateAvatar,
  onHowToPlay,
}: RoomWaitingProps) {
  const isHost = room.hostSocketId === mySocketId;
  const me = room.players.find((p) => p.socketId === mySocketId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/games/corrida?join=${room.code}` : "";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-linear-to-br from-[#7c3fe0] via-[#5a2fc2] to-[#26124f]">
      <div className="relative z-10 flex shrink-0 items-center justify-between p-3 sm:p-4">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onLeaveRoom}
          className="flex items-center gap-1 text-xs font-bold text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Sair
        </button>
        <div className="flex items-center gap-2">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onHowToPlay}
            aria-label="Como jogar"
            className="flex h-9 items-center gap-1 rounded-xl bg-black/25 px-2.5 text-xs font-bold text-white/80 transition hover:text-white"
          >
            <CircleHelp size={16} /> <span className="hidden sm:inline">Como jogar</span>
          </button>
          <SoundToggle variant="dark" />
          <div className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-sm font-bold text-white backdrop-blur">
            <Users size={16} strokeWidth={2.5} />
            {room.players.length}/{room.config.maxPlayers}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-8 pt-2 sm:gap-5 sm:px-6 sm:pb-10">
        <h1
          className="text-center text-3xl font-black italic leading-tight tracking-tight text-yellow-300 drop-shadow-[3px_3px_0_rgba(44,21,104,0.9)] sm:text-5xl"
          style={{ WebkitTextStroke: "2px #2c1568" }}
        >
          Corrida do
          <br />
          Conhecimento
        </h1>

        <div className="relative flex flex-col items-center gap-3 rounded-3xl border-2 border-white/20 bg-black/20 px-6 py-5 shadow-2xl backdrop-blur-sm sm:px-8 sm:py-6">
          <p className="text-center text-sm font-bold text-white">
            Escaneie com a câmera
            <br />
            do celular
          </p>
          <div className="relative rounded-xl bg-white p-3">
            {joinUrl && <QRCodeSVG value={joinUrl} size={140} fgColor="#2c1568" className="sm:hidden" />}
            {joinUrl && <QRCodeSVG value={joinUrl} size={160} fgColor="#2c1568" className="hidden sm:block" />}
          </div>
          <div
            className="absolute -right-4 top-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#3ec6ff] via-[#1cb0f6] to-[#0f7fd8] shadow-[0_10px_25px_-5px_rgba(28,176,246,0.7)] ring-4 ring-white/25 sm:-right-5 sm:h-14 sm:w-14"
            style={{ animation: "floatBadge 3s ease-in-out infinite" }}
          >
            <Smartphone size={20} className="text-white drop-shadow sm:h-6 sm:w-6" strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-semibold text-white/60">ou digite o código</p>
          <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-white drop-shadow">{room.code}</p>
        </div>

        <div className="text-center text-xs text-white/60">
          Até a linha de chegada · {room.config.questionSeconds}s por pergunta ·{" "}
          {room.config.visibility === "public" ? "pública" : "privada"}
        </div>

        <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border-2 border-white/20 bg-black/20 p-3 backdrop-blur-sm">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-white/50">Pilotos</p>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto sm:max-h-60">
            {room.players.map((p, i) => {
              const isMe = p.socketId === mySocketId;
              return (
                <div
                  key={p.socketId}
                  className="animate-fade-up flex items-center gap-3 rounded-xl bg-black/20 py-2 pl-2 pr-3"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <Avatar
                    emoji={p.avatar?.emoji}
                    bgColor={p.avatar?.bgColor}
                    imageUrl={p.avatar?.imageUrl}
                    fallbackLetter={p.name.charAt(0).toUpperCase()}
                  />
                  <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm font-bold text-white">
                    {p.name}
                    {p.socketId === room.hostSocketId && <Crown size={13} className="fill-yellow-400 text-yellow-400" />}
                    {isMe && <span className="text-white/50">(você)</span>}
                  </span>
                  {isMe && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowAvatarModal(true)}
                      aria-label="Editar nome e avatar"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isHost ? (
          <div className="flex w-full flex-col items-center gap-3">
            {room.players.length > 1 && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowTransferModal(true)}
                className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-black/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black/40"
              >
                <Crown size={15} />
                Mudar anfitrião
              </button>
            )}
            <button
              onMouseDown={(e) => e.preventDefault()}
              disabled={room.players.length < 2}
              onClick={onStart}
              className="w-full max-w-xs rounded-xl border-2 border-yellow-500 bg-yellow-400 py-3.5 text-lg font-extrabold text-[#2c1568] shadow-[0_4px_0_#b8860b] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
            >
              Largar!
            </button>
            {room.players.length < 2 && (
              <p className="text-xs font-semibold text-white/60">Precisa de pelo menos 2 jogadores.</p>
            )}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-white"
            >
              <Settings size={16} />
              Editar partida
            </button>
          </div>
        ) : (
          <p className="font-semibold text-white/80">Aguardando o anfitrião dar a largada...</p>
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
      {showTransferModal && (
        <TransferHostModal
          players={room.players}
          mySocketId={mySocketId}
          onTransferHost={onTransferHost}
          onClose={() => setShowTransferModal(false)}
        />
      )}
      {showAvatarModal && (
        <AvatarEditModal
          name={me?.name ?? ""}
          onNameChange={onRename}
          onEquip={onUpdateAvatar}
          onClose={() => setShowAvatarModal(false)}
        />
      )}
    </div>
  );
}
