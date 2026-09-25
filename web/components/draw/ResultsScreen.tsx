"use client";

import { useEffect, useState } from "react";
import { Crown, Images, ListOrdered, Medal, Trophy } from "lucide-react";
import { DrawingsSlideshow } from "./DrawingsSlideshow";
import type { GalleryDrawing, GameEndedPayload } from "@/lib/draw/types";

interface ResultsScreenProps {
  result: GameEndedPayload;
  gallery: GalleryDrawing[];
  mySocketId: string;
  isHost: boolean;
  onPlayAgain: () => void;
}

const AVATAR_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#1cb0f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const MEDAL_COLORS = ["#facc15", "#cbd5e1", "#d97706"];

// tempo mostrando o placar antes de passar sozinho pra galeria
const RANKING_MS = 5000;

export function ResultsScreen({ result, gallery, mySocketId, isHost, onPlayAgain }: ResultsScreenProps) {
  const ranking = [...result.players].sort((a, b) => b.score - a.score);
  const myPlace = ranking.findIndex((p) => p.socketId === mySocketId) + 1;
  const [view, setView] = useState<"ranking" | "gallery">("ranking");
  const [autoSwitched, setAutoSwitched] = useState(false);
  const hasGallery = gallery.length > 0;

  useEffect(() => {
    if (!hasGallery || autoSwitched) return;
    const t = setTimeout(() => {
      setView("gallery");
      setAutoSwitched(true);
    }, RANKING_MS);
    return () => clearTimeout(t);
  }, [hasGallery, autoSwitched]);

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-extrabold transition ${
      active ? "bg-[var(--card)] text-[var(--fg)] shadow" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
    }`;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col items-center gap-2">
        <span
          className="animate-pop-in flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)] text-white shadow-[0_6px_0_var(--primary-dark)] sm:h-16 sm:w-16"
        >
          <Trophy className="h-7 w-7 sm:h-8 sm:w-8" style={{ animation: "wiggle 1.4s ease-in-out 0.5s 2" }} />
        </span>
        <h1 className="animate-fade-up text-xl font-extrabold text-[var(--fg)] sm:text-2xl">Fim de jogo!</h1>
        {myPlace > 0 && (
          <p className="animate-fade-up text-sm font-bold text-[var(--fg-muted)]" style={{ animationDelay: "120ms" }}>
            {myPlace === 1 ? "Você venceu! 🎉" : `Você ficou em ${myPlace}º lugar`}
          </p>
        )}
      </div>

      {hasGallery && (
        <div className="flex w-full max-w-sm gap-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-1">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setView("ranking");
              setAutoSwitched(true);
            }}
            className={tabClass(view === "ranking")}
          >
            <ListOrdered size={15} /> Placar
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setView("gallery");
              setAutoSwitched(true);
            }}
            className={`${tabClass(view === "gallery")} relative overflow-hidden`}
          >
            {/* barra enchendo = contagem pra trocar sozinho pra galeria */}
            {!autoSwitched && view === "ranking" && (
              <span
                className="absolute inset-y-0 left-0 bg-[var(--primary-tint)]"
                style={{ animation: `drawSlideProgress ${RANKING_MS}ms linear forwards` }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Images size={15} /> Desenhos ({gallery.length})
            </span>
          </button>
        </div>
      )}

      {view === "gallery" && hasGallery ? (
        <DrawingsSlideshow drawings={gallery} />
      ) : (
      <div className="flex w-full max-w-sm flex-col gap-2">
        {ranking.map((p, i) => (
          <div
            key={p.socketId}
            className={`animate-fade-up flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 sm:px-4 sm:py-3 ${
              i === 0
                ? "border-[var(--primary)] bg-[var(--primary-tint)] shadow-[0_4px_0_var(--primary)]"
                : p.socketId === mySocketId
                  ? "border-[var(--primary)] bg-[var(--card)]"
                  : "border-[var(--border)] bg-[var(--card)]"
            }`}
            style={{ animationDelay: `${250 + (ranking.length - 1 - i) * 120}ms` }}
          >
            <span className="flex w-6 justify-center text-sm font-extrabold text-[var(--fg-muted)]">
              {i < 3 ? <Medal size={18} style={{ color: MEDAL_COLORS[i] }} /> : i + 1}
            </span>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
              style={{ backgroundColor: colorFor(p.socketId) }}
            >
              {p.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className="flex-1 truncate font-bold text-[var(--fg)]">
              {p.name}
              {p.socketId === mySocketId && <span className="ml-1 text-xs text-[var(--fg-muted)]">(você)</span>}
            </span>
            {i === 0 && (
              <Crown
                size={18}
                className="fill-yellow-400 text-yellow-400"
                style={{ animation: "wiggle 1.2s ease-in-out infinite" }}
              />
            )}
            <span className="font-extrabold tabular-nums text-[var(--primary)]">{p.score}</span>
          </div>
        ))}
      </div>
      )}

      {isHost ? (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPlayAgain}
          className="animate-fade-up rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-8 py-3 font-bold text-white shadow-[0_4px_0_var(--primary-dark)] transition active:translate-y-1 active:shadow-none"
          style={{ animationDelay: `${400 + ranking.length * 120}ms` }}
        >
          Jogar novamente
        </button>
      ) : (
        <p className="text-sm font-semibold text-[var(--fg-muted)]">Aguardando o anfitrião...</p>
      )}
    </div>
  );
}
