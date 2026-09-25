"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";

interface Slide {
  title: string;
  text: string;
  demo: ReactNode;
}

type TileState = "correct" | "present" | "absent" | "empty";

const TILE_BG: Record<TileState, string> = {
  correct: "bg-[var(--termo-correct)] border-[var(--termo-correct-dark)]",
  present: "bg-[var(--termo-present)] border-[var(--termo-present-dark)]",
  absent: "bg-white/25 border-white/10",
  empty: "bg-white/5 border-white/25",
};

/** Contador que avanca em loop: base das mini animacoes dos slides. */
function useLoopStep(steps: number, ms: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % steps), ms);
    return () => clearInterval(id);
  }, [steps, ms]);
  return step;
}

function Tile({ letter, state, small }: { letter: string; state: TileState; small?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border-2 font-extrabold uppercase text-white transition-colors duration-300 ${
        small ? "h-6 w-6 text-[10px]" : "h-10 w-10 text-lg"
      } ${TILE_BG[state]}`}
    >
      {letter}
    </div>
  );
}

// palavra sendo digitada letra a letra e depois revelada com as cores
function TypingDemo() {
  const step = useLoopStep(9, 550);
  const guess = "CAMPO";
  const states: TileState[] = ["absent", "correct", "present", "absent", "correct"];
  const revealed = step >= 6;
  return (
    <div className="flex gap-1.5">
      {guess.split("").map((letter, i) => (
        <Tile key={i} letter={i < step ? letter : ""} state={revealed ? states[i] : "empty"} />
      ))}
    </div>
  );
}

function ColorsDemo() {
  const step = useLoopStep(3, 1300);
  const rows: { state: TileState; letter: string; label: string }[] = [
    { state: "correct", letter: "A", label: "Letra certa no lugar certo" },
    { state: "present", letter: "M", label: "Está na palavra, em outro lugar" },
    { state: "absent", letter: "C", label: "Não está na palavra" },
  ];
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      {rows.map((r, i) => (
        <div
          key={r.state}
          className={`flex items-center gap-3 rounded-xl border-2 px-2.5 py-1 transition-all duration-300 ${
            step === i ? "scale-105 border-yellow-300 bg-white/20" : "border-white/15 bg-white/5"
          }`}
        >
          <Tile letter={r.letter} state={r.state} small />
          <span className="text-left text-xs font-bold">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// clicar num quadrado move o cursor pra ele, sem precisar apagar tudo
function CursorDemo() {
  const step = useLoopStep(4, 900);
  const cursor = [4, 1, 1, 1][step];
  const letters = ["P", step >= 2 ? "R" : "", "A", "I", "A"];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1.5">
        {letters.map((l, i) => (
          <div
            key={i}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-lg font-extrabold uppercase transition-all duration-200 ${
              cursor === i ? "scale-105 border-yellow-300 bg-white/15 ring-2 ring-yellow-300/40" : "border-white/25 bg-white/5"
            }`}
          >
            {l}
          </div>
        ))}
      </div>
      <span className="text-xs font-bold uppercase text-white/50">
        {step === 0 ? "faltou uma letra?" : step === 1 ? "toque no quadrado" : "digite e pronto"}
      </span>
    </div>
  );
}

// o mesmo palpite vale pra todos os tabuleiros; a tecla fica dividida por tabuleiro
function MultiDemo() {
  const step = useLoopStep(2, 1500);
  const boards: TileState[][] = [
    ["correct", "absent", "present", "absent", "absent"],
    ["absent", "present", "absent", "correct", "absent"],
  ];
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col gap-1.5">
        {boards.map((states, b) => (
          <div key={b} className="flex gap-1">
            {"LIVRO".split("").map((l, i) => (
              <Tile key={i} letter={l} state={step === 1 ? states[i] : "empty"} small />
            ))}
          </div>
        ))}
      </div>
      <div className="relative h-11 w-10 overflow-hidden rounded-lg">
        <div className="absolute inset-0 grid grid-cols-2">
          <div className={step === 1 ? "bg-[var(--termo-correct)]" : "bg-white/15"} />
          <div className={step === 1 ? "bg-black/50" : "bg-white/15"} />
        </div>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">T</span>
      </div>
    </div>
  );
}

function ModesDemo() {
  const step = useLoopStep(2, 1400);
  const modes = [
    { label: "Diário", hint: "1 por dia · vale ranking" },
    { label: "Infinito", hint: "jogue quantas quiser" },
  ];
  return (
    <div className="flex w-full max-w-xs gap-2">
      {modes.map((m, i) => (
        <div
          key={m.label}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 transition-all duration-300 ${
            step === i ? "scale-105 border-yellow-300 bg-white/20" : "border-white/15 bg-white/5"
          }`}
        >
          <span className="text-sm font-black uppercase">{m.label}</span>
          <span className="text-xs font-bold text-white/60">{m.hint}</span>
        </div>
      ))}
    </div>
  );
}

function ExtrasDemo() {
  const step = useLoopStep(4, 1100);
  const items = [
    { icon: "💀", label: "Modo difícil" },
    { icon: "💡", label: "Dica" },
    { icon: "⏱", label: "Contra o Tempo" },
    { icon: "😈", label: "Vilão" },
  ];
  return (
    <div className="grid w-full max-w-xs grid-cols-2 gap-2">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 transition-all duration-300 ${
            step === i ? "scale-105 border-yellow-300 bg-white/20" : "border-white/15 bg-white/5"
          }`}
        >
          <span className="text-xl">{it.icon}</span>
          <span className="text-xs font-bold">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function StreakDemo() {
  const step = useLoopStep(4, 1000);
  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center">
        <span key={step} className="text-4xl font-black text-yellow-300" style={{ animation: "popIn 0.35s ease-out" }}>
          🔥 {step + 1}
        </span>
        <span className="text-xs font-bold uppercase text-white/50">sequência</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-4xl">🏆</span>
        <span className="text-xs font-bold uppercase text-white/50">ranking</span>
      </div>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: "🟩 Descubra a palavra",
    text: "Adivinhe a palavra secreta de 5 letras. Digite um palpite e aperte Enter. Você tem 6 tentativas.",
    demo: <TypingDemo />,
  },
  {
    title: "🎨 Leia as cores",
    text: "Depois de cada palpite as letras mudam de cor e mostram o quão perto você está da resposta.",
    demo: <ColorsDemo />,
  },
  {
    title: "👆 Edite onde quiser",
    text: "Toque em qualquer quadrado da linha atual para escrever nele. Não precisa digitar acento.",
    demo: <CursorDemo />,
  },
  {
    title: "🧩 Duplo e Quádruplo",
    text: "Resolva 2 ou 4 palavras ao mesmo tempo. Cada palpite vale para todas, você ganha tentativas extras e as teclas se dividem por tabuleiro.",
    demo: <MultiDemo />,
  },
  {
    title: "📅 Diário ou Infinito",
    text: "No Diário a palavra é a mesma para todo mundo e dá para jogar uma vez por dia. No Infinito, é só treinar.",
    demo: <ModesDemo />,
  },
  {
    title: "🎲 Mais jeitos de jogar",
    text: "Nas configurações tem modo difícil e cores para daltônicos. Travou? Troque 5 moedas por uma dica. E teste o Contra o Tempo e o Vilão, que foge dos seus palpites.",
    demo: <ExtrasDemo />,
  },
  {
    title: "🏆 Suba no ranking",
    text: "Entre na sua conta e vença o Diário para manter sua sequência, ganhar moedas e aparecer no ranking de hoje e no geral. Um escudo protege a sequência se você faltar um dia.",
    demo: <StreakDemo />,
  },
];

/** Tutorial curto em cards, no mesmo formato do DrawIt e da Corrida. Swipe, setas do teclado, Pular e Jogar. */
export function TermoTutorial({ onClose }: { onClose: () => void }) {
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
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-linear-to-b from-[#7c3fe0] to-[#26124f] text-white shadow-2xl"
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
              last ? "bg-yellow-400 text-[#2c1568] shadow-[0_4px_0_#b8860b]" : "bg-white text-[#3a1a7a]"
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
