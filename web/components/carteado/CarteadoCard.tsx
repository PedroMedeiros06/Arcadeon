import { Ban } from "lucide-react";
import type { Card } from "@/lib/carteado/engine";
import { COLOR_HEX } from "@/lib/carteado/cards";

const WILD_RING = `conic-gradient(${COLOR_HEX.verde} 0 25%, ${COLOR_HEX.vermelho} 0 50%, ${COLOR_HEX.azul} 0 75%, ${COLOR_HEX.amarelo} 0)`;

/** Carta da mesa. card = null mostra o verso. width em px; a altura segue 5:7. */
export function CarteadoCard({ card, width = 112, className = "" }: { card: Card | null; width?: number; className?: string }) {
  const style = { width, height: Math.round((width * 7) / 5), fontSize: width / 112 + "rem" };
  const frame = `carteado-card relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-[0.9em] shadow-[0_0.4em_1em_-0.3em_rgba(0,0,0,0.5)] ${className}`;

  if (!card) {
    return (
      <div className={`${frame} carteado-card-back`} style={style} aria-label="Carta virada para baixo">
        <div className="absolute inset-[0.35em] rounded-[0.65em] border-[0.18em] border-white/25" />
        <div className="flex h-[3.4em] w-[3.4em] items-center justify-center rounded-full" style={{ background: WILD_RING }}>
          <span className="flex h-[76%] w-[76%] items-center justify-center rounded-full bg-[#15121f] font-display text-[1.6em] font-black text-white">9</span>
        </div>
      </div>
    );
  }

  if (card.kind === "number") {
    const hex = COLOR_HEX[card.color];
    const mark = card.value === 6 || card.value === 9 ? "underline decoration-[0.08em] underline-offset-[0.12em]" : "";
    return (
      <div className={frame} style={{ ...style, background: hex }} aria-label={`${card.value} ${card.color}`}>
        <div className="absolute inset-[0.35em] rounded-[0.65em] border-[0.18em] border-white/80" />
        <div className="absolute h-[72%] w-[64%] -rotate-[28deg] rounded-[50%] bg-white" />
        <span className={`relative font-display text-[3.6em] font-black leading-none ${mark}`} style={{ color: hex, textShadow: "0.04em 0.04em 0 rgba(0,0,0,0.18)" }}>
          {card.value}
        </span>
        <span className={`absolute left-[0.55em] top-[0.45em] font-display text-[1.05em] font-black text-white ${mark}`}>{card.value}</span>
        <span className={`absolute bottom-[0.45em] right-[0.55em] rotate-180 font-display text-[1.05em] font-black text-white ${mark}`}>{card.value}</span>
      </div>
    );
  }

  if (card.kind === "wild") {
    return (
      <div className={frame} style={{ ...style, background: "#121018" }} aria-label="Carta preta: escolhe a cor">
        <div className="absolute inset-[0.35em] rounded-[0.65em] border-[0.18em] border-white/30" />
        <div className="h-[4.2em] w-[4.2em] rounded-full shadow-[0_0_0_0.25em_#fff]" style={{ background: WILD_RING }} />
        <span className="absolute bottom-[0.6em] text-[0.7em] font-black uppercase tracking-widest text-white/80">Cor</span>
      </div>
    );
  }

  const isBlock = card.kind === "block";
  return (
    <div
      className={frame}
      style={{ ...style, background: isBlock ? "linear-gradient(160deg,#3a3550,#1d1a2a)" : "linear-gradient(160deg,#8b5cf6,#d946ef)" }}
      aria-label={isBlock ? "Bloqueio" : "Mais um"}
    >
      <div className="absolute inset-[0.35em] rounded-[0.65em] border-[0.18em] border-white/60" />
      {isBlock ? (
        <Ban className="h-[3.4em] w-[3.4em] text-white" strokeWidth={2.6} />
      ) : (
        <span className="font-display text-[3.2em] font-black leading-none text-white" style={{ textShadow: "0.05em 0.05em 0 rgba(0,0,0,0.25)" }}>
          +1
        </span>
      )}
      <span className="absolute bottom-[0.6em] text-[0.7em] font-black uppercase tracking-widest text-white/85">{isBlock ? "Bloqueio" : "Mais um"}</span>
    </div>
  );
}
