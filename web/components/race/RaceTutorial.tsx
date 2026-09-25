"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";

interface Slide {
  title: string;
  text: string;
  demo: ReactNode;
}

function Lane({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative h-11 w-full overflow-hidden rounded-xl bg-white/10 ${className}`}>
      <div className="absolute inset-x-3 top-1/2 border-t-2 border-dashed border-white/20" />
      <div
        className="absolute inset-y-0 right-1.5 w-2 opacity-80"
        style={{ backgroundImage: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)", backgroundSize: "4px 4px" }}
      />
      {children}
    </div>
  );
}

function Car({ style, extra }: { style?: CSSProperties; extra?: ReactNode }) {
  return (
    <span className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center" style={style}>
      <span className="-scale-x-100 text-2xl leading-none">🏎️</span>
      {extra}
    </span>
  );
}

const drive = (to: string, dur = 2.4, delay = 0): CSSProperties =>
  ({ "--to": to, animation: `race-drive ${dur}s cubic-bezier(0.2,0.8,0.2,1) ${delay}s infinite` }) as CSSProperties;

// loop de 4s: 🔥4 -> ✕ -> 🧊 -> estilhaca
function RiskDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 4), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center gap-2 text-4xl">
        <span className={`-scale-x-100 ${step === 2 ? "grayscale" : ""}`}>🏎️</span>
        {step === 0 && (
          <span key="f" className="text-2xl font-black text-orange-400" style={{ animation: "race-flame-pop 0.5s" }}>
            🔥4
          </span>
        )}
        {step === 1 && (
          <span key="x" className="text-3xl font-black text-red-400" style={{ animation: "shake 0.4s" }}>
            ✕
          </span>
        )}
        {step === 2 && (
          <span key="i" className="text-2xl" style={{ animation: "race-ice-form 0.5s ease-out" }}>
            🧊 <span className="text-base font-black text-white/70">🔥0</span>
          </span>
        )}
        {step === 3 && (
          <span key="b" className="text-2xl" style={{ animation: "popIn 0.4s" }}>
            💥
          </span>
        )}
        {step === 2 && (
          <span
            className="pointer-events-none absolute -inset-2 rounded-2xl border-2 border-sky-200/80 bg-sky-200/30"
            style={{ animation: "race-ice-form 0.5s ease-out" }}
          />
        )}
      </div>
      <p className="h-4 text-xs font-bold text-white/70">
        {["Sequência 🔥4", "Errou!", "Congelado 1 rodada", "Gelo quebra, volta a correr"][step]}
      </p>
    </div>
  );
}

function StreakDemo() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v % 4) + 1), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-3">
      <span className="-scale-x-100 text-4xl">🏎️</span>
      <span
        key={n}
        className="font-black text-orange-400"
        style={{
          fontSize: `${1.4 + n * 0.25}rem`,
          filter: `drop-shadow(0 0 ${n * 3}px rgba(255,140,0,0.8))`,
          animation: "race-flame-pop 0.5s ease-out",
        }}
      >
        🔥{n}
      </span>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: "🏁 Chegue primeiro!",
    text: "Responda às perguntas para fazer seu carro avançar. Quem cruzar a linha de chegada primeiro vence.",
    demo: (
      <Lane>
        <Car style={drive("calc(min(60vw, 300px))")} />
      </Lane>
    ),
  },
  {
    title: "⚡ Responda rápido!",
    text: "Quanto mais rápido você acerta, mais seu carro avança.",
    demo: (
      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 text-lg">⚡</span>
          <Lane className="flex-1">
            <Car style={drive("calc(min(52vw, 250px))", 2.4)} />
          </Lane>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 text-lg">🐢</span>
          <Lane className="flex-1">
            <Car style={drive("calc(min(26vw, 120px))", 2.4)} />
          </Lane>
        </div>
      </div>
    ),
  },
  {
    title: "🔥 Mantenha sua sequência!",
    text: "Cada acerto seguido aumenta sua sequência e dá um empurrão extra.",
    demo: <StreakDemo />,
  },
  {
    title: "🧊 Cuidado para não errar!",
    text: "Errou (ou deixou o tempo acabar) com sequência? Ela zera e você fica congelado por 1 rodada.",
    demo: <RiskDemo />,
  },
  {
    title: "🏎️ Só termina na chegada!",
    text: "Continue respondendo até alguém cruzar a linha de chegada.",
    demo: (
      <div className="flex w-full flex-col gap-1.5">
        {[0.9, 0.7, 0.8].map((f, i) => (
          <Lane key={i} className="h-9">
            <Car style={drive(`calc(min(${Math.round(f * 62)}vw, ${Math.round(f * 300)}px))`, 2.6, i * 0.15)} />
          </Lane>
        ))}
      </div>
    ),
  },
  {
    title: "🔥 Tudo pode mudar!",
    text: "Uma sequência perdida vira a corrida. Nunca desista!",
    demo: (
      <div className="flex w-full flex-col gap-1.5">
        <Lane className="h-9">
          <Car style={drive("calc(min(34vw, 160px))", 2.6)} extra={<span className="ml-1 text-sm">🧊</span>} />
        </Lane>
        <Lane className="h-9">
          <Car style={drive("calc(min(58vw, 280px))", 2.6)} extra={<span className="ml-1 text-sm font-black text-orange-400">🔥3</span>} />
        </Lane>
      </div>
    ),
  },
];

/** Tutorial curto em cards (~4s por slide). Swipe, setas do teclado, Pular e Jogar. */
export function RaceTutorial({ onClose }: { onClose: () => void }) {
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
      data-testid="race-tutorial"
      className="race-motion fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
