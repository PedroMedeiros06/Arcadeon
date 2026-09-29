"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowLeftRight, CircleHelp, Crown, Settings, Shuffle, Smartphone, Users, WifiOff } from "lucide-react";
import { EditRoomModal } from "./EditRoomModal";
import { TransferHostModal } from "./TransferHostModal";
import { MODE_INFO, MODIFIER_INFO, TEAM_INFO } from "@/lib/draw/modes";
import type { DrawPlayerPublic, DrawRoomConfig, DrawRoomState, Team } from "@/lib/draw/types";

interface RoomWaitingProps {
  room: DrawRoomState;
  myId: string;
  onStart: () => void;
  onLeaveRoom: () => void;
  onUpdateConfig: (config: DrawRoomConfig) => void;
  onTransferHost: (newHostId: string) => void;
  onHowToPlay: () => void;
  onSetTeam: (playerId: string, team: Team) => void;
  onShuffleTeams: () => void;
  /** recusa do servidor ao tentar comecar (ex.: time com 1 jogador) */
  startError: string | null;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Por que ainda nao da pra comecar (mesmas regras do servidor), ou null. */
function startBlocker(room: DrawRoomState): string | null {
  const connected = room.players.filter((p) => p.connected);
  const min = MODE_INFO[room.config.mode].minPlayers;
  if (room.config.mode === "teams") {
    const a = connected.filter((p) => p.team === "a").length;
    const b = connected.filter((p) => p.team === "b").length;
    if (a < 2 || b < 2) return "Cada time precisa de pelo menos 2 jogadores.";
    return null;
  }
  if (connected.length < min) return `${MODE_INFO[room.config.mode].label} precisa de pelo menos ${min} jogadores.`;
  return null;
}

export function RoomWaiting({
  room,
  myId,
  onStart,
  onLeaveRoom,
  onUpdateConfig,
  onTransferHost,
  onHowToPlay,
  onSetTeam,
  onShuffleTeams,
  startError,
}: RoomWaitingProps) {
  const isHost = room.hostId === myId;
  const me = room.players.find((p) => p.id === myId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/games/drawit?join=${room.code}` : "";
  const { mode, modifiers } = room.config;
  const isTeams = mode === "teams";
  const blocker = startBlocker(room);

  function playerRow(p: DrawPlayerPublic) {
    return (
      <div
        key={p.id}
        className={`flex items-center gap-3 rounded-xl bg-black/20 py-2 pl-2 pr-3 transition ${p.connected ? "" : "opacity-50"}`}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
          style={{ backgroundColor: isTeams ? TEAM_INFO[p.team].color : colorFor(p.id) }}
        >
          {p.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="flex items-center gap-1 truncate text-sm font-bold text-white">
            {p.name}
            {p.id === room.hostId && <Crown size={13} className="fill-yellow-400 text-yellow-400" />}
            {p.id === myId && <span className="text-white/50">(você)</span>}
            {!p.connected && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-white/60">
                <WifiOff size={12} /> reconectando
              </span>
            )}
          </span>
        </div>
        {/* times: cada um troca o proprio; o anfitriao troca qualquer um */}
        {isTeams && (p.id === myId || isHost) && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSetTeam(p.id, p.team === "a" ? "b" : "a")}
            aria-label={`Mudar ${p.id === myId ? "de" : p.name + " de"} time`}
            title="Trocar de time"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <ArrowLeftRight size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-linear-to-br from-[var(--stage-1)] via-[var(--stage-2)] to-[var(--stage-3)]">
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
          style={{ WebkitTextStroke: "2px var(--stage-3)" }}
        >
          Rabiscado
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
          <p className="text-xs font-semibold text-white/75">ou digite o código</p>
          <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-white drop-shadow">{room.code}</p>
        </div>

        <div className="flex max-w-sm flex-col items-center gap-1.5 text-center">
          <span className="rounded-full bg-yellow-400 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-[var(--stage-3)]">
            {MODE_INFO[mode].label}
          </span>
          <p className="text-xs font-semibold text-white/80">{MODE_INFO[mode].short}</p>
          {modifiers.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {modifiers.map((m) => (
                <span key={m} className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white/85">
                  {MODIFIER_INFO[m].emoji} {MODIFIER_INFO[m].label}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-white/65">
            {mode === "impostor"
              ? `${room.config.roundsPerPlayer} rodada(s)`
              : `${room.config.roundsPerPlayer} rodada(s)/jogador · ${room.config.turnSeconds}s por turno`}{" "}
            · {room.config.visibility === "public" ? "pública" : "privada"}
          </p>
        </div>

        {isTeams ? (
          <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
            {(["a", "b"] as const).map((team) => {
              const members = room.players.filter((p) => p.team === team);
              return (
                <div
                  key={team}
                  className="flex flex-col gap-2 rounded-2xl border-2 bg-black/20 p-3 backdrop-blur-sm"
                  style={{ borderColor: TEAM_INFO[team].color }}
                >
                  <p className="flex items-center justify-between px-1 text-xs font-extrabold uppercase tracking-wide text-white">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: TEAM_INFO[team].color }} />
                      {TEAM_INFO[team].label}
                    </span>
                    <span className="text-white/60">{members.length}</span>
                  </p>
                  <div className="flex max-h-44 flex-col gap-2 overflow-y-auto">
                    {members.length === 0 ? (
                      <p className="py-2 text-center text-xs font-semibold text-white/50">Ninguém ainda</p>
                    ) : (
                      members.map(playerRow)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border-2 border-white/20 bg-black/20 p-3 backdrop-blur-sm">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-white/50">Jogadores</p>
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto sm:max-h-56">{room.players.map(playerRow)}</div>
          </div>
        )}

        {isHost ? (
          <div className="flex flex-col items-center gap-3">
            {isTeams && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onShuffleTeams}
                className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-black/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black/40"
              >
                <Shuffle size={15} />
                Embaralhar times
              </button>
            )}
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
              disabled={!!blocker}
              onClick={onStart}
              className="w-full max-w-xs rounded-xl border-2 border-yellow-500 bg-yellow-400 py-3.5 text-lg font-extrabold text-[var(--stage-3)] shadow-[0_4px_0_#b8860b] transition active:translate-y-1 active:border-b-2 active:shadow-none disabled:opacity-40"
            >
              Começar
            </button>
            {(blocker || startError) && (
              <p className="max-w-xs text-center text-xs font-semibold text-white/80">{blocker ?? startError}</p>
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
          <p className="font-semibold text-white/80">Aguardando o anfitrião ({me ? "você entrou" : ""}) iniciar...</p>
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
          myId={myId}
          onTransferHost={onTransferHost}
          onClose={() => setShowTransferModal(false)}
        />
      )}
    </div>
  );
}
