"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, CircleHelp, Crown, Settings, Smartphone, Users } from "lucide-react";
import { EditRoomModal } from "./EditRoomModal";
import { TransferHostModal } from "./TransferHostModal";
import type { DrawRoomConfig, DrawRoomState } from "@/lib/draw/types";

interface RoomWaitingProps {
  room: DrawRoomState;
  mySocketId: string;
  onStart: () => void;
  onLeaveRoom: () => void;
  onUpdateConfig: (config: DrawRoomConfig) => void;
  onTransferHost: (newHostSocketId: string) => void;
  onHowToPlay: () => void;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

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
  onHowToPlay,
}: RoomWaitingProps) {
  const isHost = room.hostSocketId === mySocketId;
  const me = room.players.find((p) => p.socketId === mySocketId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/games/drawit?join=${room.code}` : "";

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
          <div className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-sm font-bold text-white backdrop-blur">
            <Users size={16} strokeWidth={2.5} />
            {room.players.length}/{room.config.maxPlayers}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-8 pt-2 sm:gap-5 sm:px-6 sm:pb-10">
        <h1
          className="text-4xl font-black italic tracking-tight text-yellow-300 drop-shadow-[3px_3px_0_rgba(44,21,104,0.9)] sm:text-5xl lg:text-6xl"
          style={{ WebkitTextStroke: "2px #2c1568" }}
        >
          DrawIt
        </h1>

        <div className="relative flex flex-col items-center gap-3 rounded-3xl border-2 border-white/20 bg-black/20 px-6 py-5 shadow-2xl backdrop-blur-sm sm:px-8 sm:py-6">
          <p className="text-center text-sm font-bold text-white">
            Escaneie com a camera
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
          <p className="text-xs font-semibold text-white/60">ou digite o codigo</p>
          <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-white drop-shadow">{room.code}</p>
        </div>

        <div className="text-center text-xs text-white/60">
          {room.config.roundsPerPlayer} rodada(s)/jogador · {room.config.turnSeconds}s por turno ·{" "}
          {room.config.visibility === "public" ? "publica" : "privada"}
        </div>

        <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border-2 border-white/20 bg-black/20 p-3 backdrop-blur-sm">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-white/50">Jogadores</p>
          <div className="flex max-h-40 flex-col gap-2 overflow-y-auto sm:max-h-56">
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
                  {p.socketId === room.hostSocketId && <Crown size={13} className="fill-yellow-400 text-yellow-400" />}
                  {p.socketId === mySocketId && <span className="text-white/50">(voce)</span>}
                </span>
              </div>
            </div>
          ))}
          </div>
        </div>

        {isHost ? (
          <div className="flex flex-col items-center gap-3">
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
              disabled={room.players.length < 2}
              onClick={onStart}
              className="w-full max-w-xs rounded-xl border-2 border-yellow-500 bg-yellow-400 py-3.5 text-lg font-extrabold text-[#2c1568] shadow-[0_4px_0_#b8860b] transition active:translate-y-1 active:border-b-2 active:shadow-none disabled:opacity-40"
            >
              Comecar
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
          <p className="font-semibold text-white/80">Aguardando o anfitriao ({me ? "voce entrou" : ""}) iniciar...</p>
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
          room={room}
          mySocketId={mySocketId}
          onTransferHost={onTransferHost}
          onClose={() => setShowTransferModal(false)}
        />
      )}
    </div>
  );
}
