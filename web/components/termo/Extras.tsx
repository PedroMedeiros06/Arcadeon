"use client";

import { useEffect, useState } from "react";

// ---------- Confete da vitoria (mesma animacao .draw-confetti do DrawIt) ----------

const CONFETTI_COLORS = ["var(--termo-correct)", "var(--termo-present)", "#8b5cf6", "#ef4444", "#3b82f6", "#f59e0b"];

function jitter(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const PIECES = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2 + jitter(i) * 0.5;
  const dist = 140 + jitter(i + 50) * 200;
  return {
    dx: `${Math.cos(angle) * dist}px`,
    dy: `${Math.sin(angle) * dist - 80}px`,
    rot: `${jitter(i + 100) * 720 - 360}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 3 === 0,
    delay: `${Math.round(jitter(i + 7) * 150)}ms`,
  };
});

export function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`draw-confetti absolute h-3 w-3 ${p.round ? "rounded-full" : "rounded-[2px]"}`}
          style={{
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: "1.4s",
            ["--dx" as string]: p.dx,
            ["--dy" as string]: p.dy,
            ["--rot" as string]: p.rot,
          }}
        />
      ))}
    </div>
  );
}

// ---------- Contagem regressiva ate a proxima palavra do Diario ----------

// O Diario vira a meia-noite de Brasilia (servidor: termo_today()). O Brasil nao tem horario
// de verao desde 2019, entao o fuso e fixo em UTC-3.
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

function msUntilNextDay(now: number) {
  const brt = now + BRT_OFFSET_MS;
  const day = 24 * 60 * 60 * 1000;
  return day - (((brt % day) + day) % day);
}

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function NextWordCountdown({ className = "" }: { className?: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(msUntilNextDay(Date.now()));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (left === null) return null;
  return (
    <p className={`text-center text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)] ${className}`}>
      Próxima palavra em <span className="tabular-nums text-[var(--fg)]">{format(left)}</span>
    </p>
  );
}
