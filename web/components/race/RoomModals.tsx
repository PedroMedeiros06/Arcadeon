"use client";

import { useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RaceConfigFields } from "./RaceConfigFields";
import type { RaceRoomConfig, RacePlayerPublic } from "@/lib/race/types";

export function EditRoomModal({
  config,
  currentPlayerCount,
  onSave,
  onClose,
}: {
  config: RaceRoomConfig;
  currentPlayerCount: number;
  onSave: (config: RaceRoomConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-linear-to-b from-[#7c3fe0] to-[#3a1a7a] p-4 shadow-2xl sm:p-5"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        <div className="relative mb-4 flex items-center justify-center">
          <h2 className="text-lg font-extrabold text-white">Editar partida</h2>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X size={16} />
          </button>
        </div>
        <div className="rounded-2xl bg-[#26124f]/50 p-5">
          <RaceConfigFields config={draft} onChange={setDraft} minPlayers={currentPlayerCount} />
        </div>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onSave(draft);
            onClose();
          }}
          className="mt-5 w-full rounded-2xl border-2 border-emerald-600 bg-emerald-400 py-3 text-base font-extrabold text-emerald-950 shadow-[0_4px_0_var(--color-emerald-600)] transition active:translate-y-1 active:shadow-none"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

export function TransferHostModal({
  players,
  mySocketId,
  onTransferHost,
  onClose,
}: {
  players: RacePlayerPublic[];
  mySocketId: string;
  onTransferHost: (newHostSocketId: string) => void;
  onClose: () => void;
}) {
  const others = players.filter((p) => p.socketId !== mySocketId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-[var(--border)] px-5 py-4">
          <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">Mudar anfitrião</p>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {others.map((p) => (
            <button
              key={p.socketId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onTransferHost(p.socketId);
                onClose();
              }}
              className="flex items-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-left transition hover:border-[var(--primary)]"
            >
              <Avatar
                emoji={p.avatar?.emoji}
                bgColor={p.avatar?.bgColor}
                imageUrl={p.avatar?.imageUrl}
                fallbackLetter={p.name.charAt(0).toUpperCase()}
              />
              <span className="flex-1 truncate text-sm font-bold text-[var(--fg)]">{p.name}</span>
              <ChevronRight size={16} className="shrink-0 text-[var(--fg-muted)]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
