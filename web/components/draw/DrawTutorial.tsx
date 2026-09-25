"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";

interface Slide {
  title: string;
  text: string;
  demo: ReactNode;
}

/** Contador que avanca em loop: base das mini animacoes dos slides. */
function useLoopStep(steps: number, ms: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % steps), ms);
    return () => clearInterval(id);
  }, [steps, ms]);
  return step;
}

// casinha com sol sendo desenhada traco a traco (stroke-dashoffset)
function DrawingDemo() {
  const paths = [
    "M20 70 L20 40 L45 20 L70 40 L70 70 Z",
    "M38 70 L38 52 L52 52 L52 70",
    "M92 30 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0",
    "M5 72 L115 72",
  ];
  const colors = ["#7c5cff", "#ef4444", "#f59e0b", "#22c55e"];
  return (
    <div className="rounded-2xl bg-white p-2 shadow-lg">
      <svg viewBox="0 0 120 80" className="h-24 w-36">
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            pathLength={1}
            fill="none"
            stroke={colors[i]}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1,
              animation: `drawTutorialStroke 3.6s ease-in-out ${i * 0.45}s infinite`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}

function PickDemo() {
  const step = useLoopStep(3, 1100);
  const options = [
    { label: "Facil", word: "gato", pts: 190, color: "#4ade80" },
    { label: "Media", word: "coruja", pts: 240, color: "#fbbf24" },
    { label: "Dificil", word: "fênix", pts: 285, color: "#f87171" },
  ];
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      {options.map((o, i) => (
        <div
          key={o.word}
          className={`flex items-center justify-between rounded-xl border-2 px-3 py-1.5 transition-all duration-300 ${
            step === i ? "scale-105 border-yellow-300 bg-white/20" : "border-white/15 bg-white/5"
          }`}
        >
          <span className="text-sm font-extrabold capitalize">{o.word}</span>
          <span className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase" style={{ color: o.color }}>
              {o.label}
            </span>
            <span className="text-sm font-black" style={{ color: o.color }}>
              {o.pts}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function GuessDemo() {
  const step = useLoopStep(5, 900);
  const lines = [
    <p key="a" className="text-left text-xs font-semibold text-white/70">
      <b className="text-white">Ana:</b> casa
    </p>,
    <p key="b" className="text-left text-xs font-semibold text-white/70">
      <b className="text-white">Leo:</b> prédio
    </p>,
    <p key="c" className="rounded-md bg-amber-400/20 px-1.5 text-left text-xs font-bold text-amber-300">
      <b>Você:</b> castelu — quase lá!
    </p>,
    <p key="d" className="rounded-md bg-green-400/20 px-1.5 text-left text-xs font-extrabold text-green-300">
      ✨ Você acertou &quot;castelo&quot;! +190
    </p>,
  ];
  return (
    <div className="flex h-24 w-full max-w-xs flex-col justify-end gap-1 rounded-xl bg-black/20 p-2">
      {lines.slice(0, Math.min(step, lines.length)).map((line, i) => (
        <div key={i} style={{ animation: "fadeUp 0.3s ease-out" }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function SpeedDemo() {
  const step = useLoopStep(4, 1000);
  const points = [190, 150, 110, 70];
  const width = [100, 70, 40, 12][step];
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${width}%`, backgroundColor: step >= 3 ? "#f87171" : step >= 2 ? "#fbbf24" : "var(--stage-soft)" }}
        />
      </div>
      <span key={step} className="text-4xl font-black text-yellow-300" style={{ animation: "popIn 0.35s ease-out" }}>
        +{points[step]}
      </span>
    </div>
  );
}

function SecretDemo() {
  return (
    <div className="flex w-full max-w-xs gap-2 text-xs">
      <div className="flex flex-1 flex-col gap-1 rounded-xl bg-black/20 p-2">
        <span className="text-xs font-bold uppercase text-white/50">Ana acertou e vê</span>
        <span className="rounded-md bg-green-400/20 px-1.5 py-0.5 font-bold text-green-300">✨ &quot;pizza&quot; +190</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 rounded-xl bg-black/20 p-2">
        <span className="text-xs font-bold uppercase text-white/50">Os outros veem</span>
        <span className="rounded-md bg-green-400/20 px-1.5 py-0.5 font-bold text-green-300">✓ Ana acertou!</span>
      </div>
    </div>
  );
}

function GalleryDemo() {
  const step = useLoopStep(3, 1200);
  const emojis = ["🏠", "🐱", "🚀"];
  return (
    <div className="flex items-center gap-2">
      {emojis.map((e, i) => (
        <div
          key={e}
          className={`flex h-16 w-20 items-center justify-center rounded-xl bg-white text-3xl shadow-lg transition-all duration-500 ${
            step === i ? "scale-110 ring-4 ring-yellow-300" : "scale-90 opacity-50"
          }`}
        >
          {e}
        </div>
      ))}
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: "🎨 Desenhe e adivinhe!",
    text: "A cada turno um jogador desenha uma palavra secreta e os outros tentam adivinhar o que é.",
    demo: <DrawingDemo />,
  },
  {
    title: "✏️ Escolha sua palavra",
    text: "Na sua vez, escolha entre uma palavra fácil, uma média e uma difícil. Quanto mais difícil, mais pontos.",
    demo: <PickDemo />,
  },
  {
    title: "💬 Chute à vontade",
    text: "Digite quantos palpites quiser. Chutes errados aparecem pra todo mundo. Se errar por uma letra, avisamos que está quase!",
    demo: <GuessDemo />,
  },
  {
    title: "🤫 Acerto é segredo",
    text: "Quando você acerta, só você vê a palavra. Os outros ficam sabendo apenas que você acertou.",
    demo: <SecretDemo />,
  },
  {
    title: "⚡ Rápido vale mais",
    text: "Quanto antes você acerta, mais pontos ganha. O desenhista ganha pontos quando os outros acertam o desenho dele.",
    demo: <SpeedDemo />,
  },
  {
    title: "🖼️ Relembre os desenhos",
    text: "No fim da partida, depois do placar, todos os desenhos da sessão aparecem num slide. Dá até pra baixar!",
    demo: <GalleryDemo />,
  },
];

/** Tutorial curto em cards, no mesmo formato do da Corrida. Swipe, setas do teclado, Pular e Jogar. */
export function DrawTutorial({ onClose }: { onClose: () => void }) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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

        <div
          key={index}
          className="flex min-h-[330px] flex-col items-center gap-5 px-6 pb-4 pt-12 text-center"
          style={{ animation: "fadeUp 0.35s ease-out" }}
        >
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
