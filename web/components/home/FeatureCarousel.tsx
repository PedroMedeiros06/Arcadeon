"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const AUTOPLAY_MS = 7000;

/**
 * Carrossel de destaques da home. Os slides ficam num trilho com scroll-snap, entao o
 * arrastar no celular e nativo; setas e pontos so rolam o trilho. Troca sozinho a cada 7s,
 * pausando com mouse em cima, foco dentro, toque, aba escondida ou "menos movimento".
 */
export function FeatureCarousel({ slides, label }: { slides: { id: string; content: React.ReactNode }[]; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const next = (index + count) % count;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    },
    [count],
  );

  // slide ativo = o mais perto da borda esquerda do trilho
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        setActive(Math.round(track.scrollLeft / width));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") goTo(active + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, active, count, goTo]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label={label}
      className="group/carousel relative min-w-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onTouchStart={() => setPaused(true)}
    >
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-3xl"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${count}`}
            aria-hidden={i !== active}
            inert={i !== active}
            className="w-full shrink-0 snap-start snap-always"
          >
            {slide.content}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label="Destaque anterior"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] text-[var(--fg)] opacity-0 shadow-md transition group-hover/carousel:opacity-100 focus-visible:opacity-100 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Próximo destaque"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] text-[var(--fg)] opacity-0 shadow-md transition group-hover/carousel:opacity-100 focus-visible:opacity-100 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="mt-3 flex justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para o destaque ${i + 1}`}
                aria-current={i === active}
                className="flex h-6 items-center px-0.5"
              >
                <span
                  className={`block h-2 rounded-full transition-all duration-300 ${
                    i === active ? "w-6 bg-[var(--primary)]" : "w-2 bg-[var(--border-hover)]"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
