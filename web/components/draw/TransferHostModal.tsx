"use client";

import { X, ChevronRight } from "lucide-react";
import type { DrawRoomState } from "@/lib/draw/types";

interface TransferHostModalProps {
  room: DrawRoomState;
  mySocketId: string;
  onTransferHost: (newHostSocketId: string) => void;
  onClose: () => void;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function TransferHostModal({ room, mySocketId, onTransferHost, onClose }: TransferHostModalProps) {
  const others = room.players.filter((p) => p.socketId !== mySocketId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-[var(--border)] px-5 py-4">
          <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
            Mudar anfitrião
          </p>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {others.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] p-4 text-center text-sm font-medium text-[var(--fg-muted)]">
              Nenhum outro jogador na sala ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
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
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                    style={{ backgroundColor: colorFor(p.socketId) }}
                  >
                    {p.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="flex-1 truncate text-sm font-bold text-[var(--fg)]">{p.name}</span>
                  <ChevronRight size={16} className="shrink-0 text-[var(--fg-muted)]" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
