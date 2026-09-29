"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { RoomSettingsFields, closestTurn } from "./RoomSettingsFields";
import type { DrawRoomConfig } from "@/lib/draw/types";

interface EditRoomModalProps {
  config: DrawRoomConfig;
  currentPlayerCount: number;
  onSave: (config: DrawRoomConfig) => void;
  onClose: () => void;
}

export function EditRoomModal({ config, currentPlayerCount, onSave, onClose }: EditRoomModalProps) {
  const [draft, setDraft] = useState<DrawRoomConfig>({ ...config, turnSeconds: closestTurn(config.turnSeconds) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-linear-to-b from-[var(--stage-1)] to-[var(--stage-2)] p-5 shadow-2xl">
        <div className="relative mb-4 flex items-center justify-center">
          <h2 className="text-lg font-extrabold text-white">Editar partida</h2>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--stage-3)]/50 p-5 backdrop-blur">
          <RoomSettingsFields value={draft} onChange={setDraft} currentPlayerCount={currentPlayerCount} />
        </div>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onSave(draft);
            onClose();
          }}
          className="mt-5 w-full rounded-2xl border-2 border-emerald-600 bg-emerald-400 py-3.5 text-base font-extrabold text-emerald-950 shadow-[0_4px_0_var(--color-emerald-600)] transition active:translate-y-1 active:border-b-2 active:shadow-none"
        >
          Salvar alterações
        </button>
      </div>
    </div>
  );
}
