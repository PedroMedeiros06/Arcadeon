"use client";

import { useState } from "react";
import { Settings, Tv } from "lucide-react";
import { EditRoomModal } from "./EditRoomModal";
import type { RoomConfig } from "@/lib/buggle/types";

interface MobileResultsScreenProps {
  isHost: boolean;
  fast: boolean;
  onChangeFast: (fast: boolean) => void;
  revealDone: boolean;
  onPlayAgain: () => void;
  config: RoomConfig;
  playerCount: number;
  onUpdateConfig: (config: RoomConfig) => void;
}

export function MobileResultsScreen({
  isHost,
  fast,
  onChangeFast,
  revealDone,
  onPlayAgain,
  config,
  playerCount,
  onUpdateConfig,
}: MobileResultsScreenProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-[var(--card)] bg-[var(--primary-tint)] shadow-[0_6px_0_var(--border)]">
        <Tv size={56} className="text-[var(--primary)]" />
      </div>

      <p className="max-w-xs rounded-2xl bg-[var(--bg)] px-6 py-4 text-lg font-extrabold text-[var(--fg-muted)]">
        Confira a tela principal
      </p>

      {isHost && !revealDone && (
        <div className="flex overflow-hidden rounded-2xl border-2 border-[var(--border)] shadow-[0_4px_0_var(--border)]">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChangeFast(false)}
            className={`px-6 py-3 text-sm font-extrabold transition ${
              !fast ? "bg-[var(--primary)] text-white" : "bg-[var(--card)] text-[var(--fg-muted)]"
            }`}
          >
            Normal
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChangeFast(true)}
            className={`px-6 py-3 text-sm font-extrabold transition ${
              fast ? "bg-[#f59e0b] text-white" : "bg-[var(--card)] text-[var(--fg-muted)]"
            }`}
          >
            Rápido
          </button>
        </div>
      )}

      {isHost && revealDone && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPlayAgain}
            className="rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-8 py-3 font-bold text-white shadow-[0_4px_0_var(--primary-dark)]"
          >
            Jogar novamente
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(true)}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-8 py-3 font-bold text-[var(--fg)] shadow-[0_4px_0_var(--border)]"
          >
            <Settings size={16} />
            Editar sala
          </button>
        </div>
      )}

      {editing && (
        <EditRoomModal
          config={config}
          currentPlayerCount={playerCount}
          onSave={onUpdateConfig}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
