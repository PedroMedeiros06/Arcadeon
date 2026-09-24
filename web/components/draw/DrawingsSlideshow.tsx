"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Pause, Play } from "lucide-react";
import { DifficultyStars } from "./WordPicker";
import type { GalleryDrawing } from "@/lib/draw/types";

const SLIDE_MS = 3500;

/** Slide automatico com todos os desenhos da sessao. Swipe, setas do teclado, pausa e download. */
export function DrawingsSlideshow({ drawings }: { drawings: GalleryDrawing[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const touchX = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const count = drawings.length;
  const current = drawings[Math.min(index, count - 1)];
  const multipleGames = new Set(drawings.map((d) => d.game)).size > 1;

  function go(delta: number) {
    setIndex((i) => (i + delta + count) % count);
  }

  useEffect(() => {
    if (!playing || count < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(t);
  }, [playing, index, count]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  // miniatura atual sempre visivel na faixa
  useEffect(() => {
    const thumb = stripRef.current?.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [index]);

  if (!current) return null;

  const fileName = `drawit-${current.word.replace(/\s+/g, "-")}.jpg`;

  return (
    <div className="flex w-full max-w-lg flex-col gap-2">
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-white shadow-lg"
        onPointerDown={(e) => (touchX.current = e.clientX)}
        onPointerUp={(e) => {
          if (touchX.current === null) return;
          const dx = e.clientX - touchX.current;
          touchX.current = null;
          if (dx < -40) go(1);
          if (dx > 40) go(-1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no client */}
        <img
          key={current.id}
          src={current.imageUrl}
          alt={`Desenho de ${current.drawerName}: ${current.word}`}
          draggable={false}
          className="animate-pop-in aspect-[4/3] w-full select-none object-contain"
        />

        {/* barra de progresso do slide */}
        {playing && count > 1 && (
          <div className="absolute inset-x-0 top-0 h-1 bg-black/10">
            <div
              key={`${current.id}-bar`}
              className="h-full bg-[var(--primary)]"
              style={{ animation: `drawSlideProgress ${SLIDE_MS}ms linear forwards` }}
            />
          </div>
        )}

        <span className="absolute left-2 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
          {index + 1}/{count}
        </span>

        {count > 1 && (
          <>
            <button
              aria-label="Desenho anterior"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65 active:scale-90"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              aria-label="Proximo desenho"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65 active:scale-90"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      <div key={`${current.id}-caption`} className="animate-fade-up flex items-center gap-2 px-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 truncate text-lg font-extrabold capitalize text-[var(--fg)]">
            {current.word}
            {current.difficulty && <DifficultyStars difficulty={current.difficulty} size={11} />}
          </span>
          <span className="truncate text-xs font-semibold text-[var(--fg-muted)]">
            por <b className="text-[var(--fg)]">{current.drawerName}</b> · {multipleGames ? `Partida ${current.game} · ` : ""}
            Rodada {current.round}
          </span>
        </div>
        {count > 1 && (
          <button
            aria-label={playing ? "Pausar" : "Continuar"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPlaying((p) => !p)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border)] text-[var(--fg-muted)] transition hover:text-[var(--fg)] active:scale-90"
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
        )}
        <a
          href={current.imageUrl}
          download={fileName}
          aria-label="Baixar desenho"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border)] text-[var(--fg-muted)] transition hover:text-[var(--fg)] active:scale-90"
        >
          <Download size={15} />
        </a>
      </div>

      {count > 1 && (
        <div ref={stripRef} className="no-scrollbar flex gap-1.5 overflow-x-auto px-0.5 py-1">
          {drawings.map((d, i) => (
            <button
              key={d.id}
              aria-label={`Ver desenho ${i + 1}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setIndex(i);
                setPlaying(false);
              }}
              className={`shrink-0 overflow-hidden rounded-lg border-2 bg-white transition ${
                i === index ? "scale-105 border-[var(--primary)]" : "border-[var(--border)] opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no client */}
              <img src={d.imageUrl} alt="" draggable={false} className="h-12 w-16 object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
