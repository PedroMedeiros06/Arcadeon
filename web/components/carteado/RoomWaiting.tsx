"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Crown, Pencil, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AvatarEditModal } from "@/components/buggle/AvatarEditModal";
import type { CarteadoRoomConfig, CarteadoRoomState, PlayerAvatar } from "@/lib/carteado/types";
import { TurnTimeField } from "./TurnTimeField";

export function RoomWaiting({
  room,
  mySocketId,
  onStart,
  onLeaveRoom,
  onUpdateConfig,
  onRename,
  onUpdateAvatar,
}: {
  room: CarteadoRoomState;
  mySocketId: string;
  onStart: () => void;
  onLeaveRoom: () => void;
  onUpdateConfig: (config: CarteadoRoomConfig) => void;
  onRename: (name: string) => void;
  onUpdateAvatar: (avatar: PlayerAvatar) => void;
}) {
  const isHost = room.hostSocketId === mySocketId;
  const me = room.lobby.find((p) => p.socketId === mySocketId);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/games/carteado?join=${room.code}` : "";
  const full = room.lobby.length >= room.maxPlayers;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onLeaveRoom}
          className="flex items-center gap-1 text-sm font-bold text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Sair
        </button>
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--card)] px-3 py-1.5 text-sm font-bold text-[var(--fg)]">
          <Users className="h-4 w-4" /> {room.lobby.length}/{room.maxPlayers}
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm font-bold text-[var(--fg-muted)]">Chame seu adversário pelo QR ou pelo código</p>
            <div className="rounded-xl bg-white p-3">{joinUrl && <QRCodeSVG value={joinUrl} size={150} fgColor="#0e1215" />}</div>
            <p className="select-all font-mono text-3xl font-black tracking-[0.3em] text-[var(--fg)]">{room.code}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-3">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">Jogadores</p>
            {room.lobby.map((p) => {
              const isMe = p.socketId === mySocketId;
              return (
                <div key={p.socketId} className="animate-fade-up flex items-center gap-3 rounded-xl bg-[var(--bg)] py-2 pl-2 pr-3">
                  <Avatar emoji={p.avatar?.emoji} bgColor={p.avatar?.bgColor} imageUrl={p.avatar?.imageUrl} fallbackLetter={p.name.charAt(0).toUpperCase()} />
                  <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm font-bold text-[var(--fg)]">
                    {p.name}
                    {p.socketId === room.hostSocketId && <Crown className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" />}
                    {isMe && <span className="text-[var(--fg-muted)]">(você)</span>}
                  </span>
                  {isMe && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowAvatarModal(true)}
                      aria-label="Editar nome e avatar"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--card)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {!full && <p className="py-2 text-center text-sm font-semibold text-[var(--fg-muted)]">Esperando o adversário entrar...</p>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">{isHost ? "Regras da sala" : "Regras da sala (o anfitrião escolhe)"}</p>
            <TurnTimeField config={room.config} onChange={onUpdateConfig} readOnly={!isHost} />
          </div>
          {isHost ? (
            <button
              type="button"
              disabled={!full}
              onClick={onStart}
              className="rounded-2xl bg-[var(--game-accent)] py-3.5 text-lg font-black text-white shadow-md transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              Começar duelo
            </button>
          ) : (
            <p className="text-center font-semibold text-[var(--fg-muted)]">Esperando o anfitrião começar...</p>
          )}
        </div>
      </div>

      {showAvatarModal && <AvatarEditModal name={me?.name ?? ""} onNameChange={onRename} onEquip={onUpdateAvatar} onClose={() => setShowAvatarModal(false)} />}
    </div>
  );
}
