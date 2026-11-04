"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import { COLORS, type CardColor } from "@/lib/carteado/engine";
import { COLOR_HEX } from "@/lib/carteado/cards";
import { CarteadoCard } from "./CarteadoCard";
import { Cartela } from "./Cartela";

interface Slide {
  title: string;
  text: string;
  demo: ReactNode;
}

const FULL: CardColor[] = ["azul", "vermelho", "verde", "amarelo", "azul", "verde", "vermelho", "amarelo", "verde"];

// loop: a carta vira e o numero entra na cartela
function FillDemo() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 1300);
    return () => clearInterval(id);
  }, []);
  const cells: (CardColor | null)[] = [null, "vermelho", null, null, on ? "azul" : null, null, "verde", null, null];
  return (
    <div className="flex items-center gap-5">
      <CarteadoCard key={String(on)} card={on ? { id: 1, kind: "number", value: 5, color: "azul" } : null} width={64} className={on ? "carteado-flip-in" : ""} />
      <Cartela cells={cells} fresh={on ? 4 : null} size="sm" />
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: "🃏 Complete sua cartela!",
    text: "Cada jogador tem uma cartela de 1 a 9. Na sua vez, vire a carta do monte.",
    demo: (
      <div className="flex items-center gap-4">
        <CarteadoCard card={null} width={64} />
        <Cartela cells={Array.from({ length: 9 }, () => null)} fresh={null} size="sm" />
      </div>
    ),
  },
  {
    title: "✅ Número novo entra",
    text: "Se o número ainda não está na sua cartela, ele entra e a vez passa.",
    demo: <FillDemo />,
  },
  {
    title: "↩️ Repetido ou zero? Passa",
    text: "Número que você já tem, ou o 0, não conta: só passa a vez.",
    demo: (
      <div className="flex items-center gap-3">
        <CarteadoCard card={{ id: 2, kind: "number", value: 0, color: "verde" }} width={64} className="-rotate-6" />
        <CarteadoCard card={{ id: 3, kind: "number", value: 7, color: "amarelo" }} width={64} className="rotate-6" />
      </div>
    ),
  },
  {
    title: "⛔ Bloqueio e +1",
    text: "Bloqueio faz você perder a vez. O +1 deixa virar mais uma carta.",
    demo: (
      <div className="flex items-center gap-3">
        <CarteadoCard card={{ id: 4, kind: "block" }} width={64} className="-rotate-6" />
        <CarteadoCard card={{ id: 5, kind: "plus" }} width={64} className="rotate-6" />
      </div>
    ),
  },
  {
    title: "🎨 Carta preta",
    text: "Você escolhe uma cor. A próxima carta de número do adversário só conta se for dessa cor.",
    demo: (
      <div className="flex items-center gap-4">
        <CarteadoCard card={{ id: 6, kind: "wild" }} width={64} />
        <div className="grid grid-cols-2 gap-1.5">
          {COLORS.map((c) => (
            <span key={c} className="h-7 w-10 rounded-lg" style={{ background: COLOR_HEX[c] }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "🏆 Completou, venceu!",
    text: "Quem preencher os 9 números primeiro ganha o duelo.",
    demo: <Cartela cells={FULL} fresh={8} size="sm" />,
  },
];

/** Tutorial curto em cards, no mesmo formato da Corrida. Swipe, setas do teclado, Pular e Jogar. */
export function CarteadoTutorial({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="carteado-motion fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Como jogar"
    >
      <div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-linear-to-b from-[var(--stage-1)] to-[var(--stage-3)] text-white shadow-2xl"
        style={{ animation: "scaleIn 0.25s ease-out" }}
        onPointerDown={(e) => (touchX.current = e.clientX)}
        onPointerUp={(e) => {
          if (touchX.current === null) return;
          const dx = e.clientX - touchX.current;
          touchX.current = null;
          if (dx < -50) setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
          if (dx > 50) setIndex((i) => Math.max(0, i - 1));
        }}
      >
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/25"
        >
          Pular <X size={12} />
        </button>

        <div key={index} className="flex min-h-[330px] flex-col items-center gap-5 px-6 pb-4 pt-12 text-center" style={{ animation: "fadeUp 0.35s ease-out" }}>
          <div className="flex h-28 w-full items-center justify-center">{slide.demo}</div>
          <h2 className="text-2xl font-black tracking-tight">{slide.title}</h2>
          <p className="text-sm font-semibold leading-relaxed text-white/80">{slide.text}</p>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pb-6">
          <div className="flex gap-1.5" aria-label={`Passo ${index + 1} de ${SLIDES.length}`}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIndex(i)}
                aria-label={`Ir para o passo ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-yellow-300" : "w-2 bg-white/30"}`}
              />
            ))}
          </div>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (last ? onClose() : setIndex(index + 1))}
            className={`flex items-center gap-1 rounded-xl px-5 py-2.5 text-sm font-extrabold transition active:scale-95 ${
              last ? "bg-yellow-400 text-[var(--stage-3)] shadow-[0_4px_0_#b8860b]" : "bg-white text-[var(--stage-2)]"
            }`}
          >
            {last ? "Jogar" : "Próximo"}
            {!last && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
