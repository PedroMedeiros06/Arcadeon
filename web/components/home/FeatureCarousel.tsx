"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface FeatureSlide {
  id: string;
  /** nome curto na aba */
  label: string;
  /** jogo do slide, pra amostra do padrao na aba */
  slug: string;
  content: React.ReactNode;
}

/**
 * Carrossel de destaques da home. Os slides ficam num trilho com scroll-snap, entao o
 * arrastar no celular e nativo. Nao troca sozinho: a pessoa escolhe pelas abas ou pelas setas.
 */
export function FeatureCarousel({ slides, label }: { slides: FeatureSlide[]; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = slides.length;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const next = (index + count) % count;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      track.scrollTo({ left: next * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
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

  return (
    <section aria-roledescription="carrossel" aria-label={label} className="group/carousel relative min-w-0">
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-3xl"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${slide.label}, ${i + 1} de ${count}`}
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
            className="absolute left-3 top-[calc(50%-1.5rem)] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] text-[var(--fg)] opacity-0 shadow-md transition group-hover/carousel:opacity-100 focus-visible:opacity-100 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Próximo destaque"
            className="absolute right-3 top-[calc(50%-1.5rem)] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] text-[var(--fg)] opacity-0 shadow-md transition group-hover/carousel:opacity-100 focus-visible:opacity-100 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto p-1" aria-label="Escolher destaque">
            {slides.map((slide, i) => {
              const isActive = i === active;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isActive}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3 py-1.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                    isActive
                      ? "border-[var(--fg)] bg-[var(--card)] text-[var(--fg)]"
                      : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:border-[var(--border-hover)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span className={`pattern-${slide.slug} h-4 w-4 shrink-0 rounded-md`} aria-hidden />
                  {slide.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
