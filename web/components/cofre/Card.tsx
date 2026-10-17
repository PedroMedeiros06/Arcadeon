"use client";

import { useState } from "react";
import { CARD_BACK_SRC, cardArt } from "@/lib/cofre/cards";
import { CORINGA, type CellState } from "@/lib/cofre/engine";

// face null = carta escondida: o cliente nunca sabe a face de uma carta virada pra baixo
export function Card({
  face,
  state,
  disabled,
  highlight = null,
  onFlip,
}: {
  face: string | null;
  state: CellState;
  disabled: boolean;
  highlight?: "swap" | null;
  onFlip: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [backFailed, setBackFailed] = useState(false);
  // guarda a ultima face vista: a carta errada ainda mostra a arte enquanto vira de volta (300 ms)
  const [lastFace, setLastFace] = useState(face);
  if (face !== null && face !== lastFace) setLastFace(face);
  const shownFace = face ?? lastFace;
  const up = state !== "hidden";
  const art = shownFace ? cardArt(shownFace) : null;
  const coringa = shownFace === CORINGA;
  // sem `disabled` nativo: botao desabilitado perde o foco e quem joga no teclado volta pro topo
  const blocked = disabled || state !== "hidden";
  const artFailed = art !== null && (art.src === null || failedSrc === art.src);

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (!blocked) onFlip();
      }}
      aria-disabled={blocked}
      aria-label={up && art ? art.label : "Carta escondida"}
      className={`cofre-card relative block aspect-[3/4] w-full rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-[var(--game-accent)] ${
        !blocked ? "cursor-pointer transition-transform hover:-translate-y-0.5" : "cursor-default"
      } ${state === "taken" ? "cofre-taken" : ""} ${highlight === "swap" ? "cofre-swap-glow" : ""}`}
    >
      <span data-up={up} className="cofre-card-inner absolute inset-0 block">
        {/* verso */}
        <span className="cofre-card-face absolute inset-0 overflow-hidden rounded-xl border-2 border-black/40 bg-gradient-to-br from-[#1d2329] to-[#0e1215] shadow-md">
          {!backFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={CARD_BACK_SRC} alt="" draggable={false} onError={() => setBackFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex aspect-square w-1/2 items-center justify-center rounded-full border-2 border-[var(--game-accent)]/70 shadow-[0_0_14px_rgb(0_0_0/0.5)_inset]">
                <span className="aspect-square w-1/3 rounded-full border-2 border-[#f2c14e]/70" />
              </span>
            </span>
          )}
        </span>
        {/* frente */}
        <span
          className={`cofre-card-face cofre-card-front absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border-2 bg-[#141a20] shadow-md ${
            coringa ? "border-[#e0409b] shadow-[0_0_18px_#e0409b80,inset_0_0_18px_#f2c14e40]" : "border-[var(--game-accent)]/60"
          }`}
        >
          {art &&
            (!artFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art.src ?? undefined} alt="" draggable={false} onError={() => setFailedSrc(art.src)} className="h-full w-full object-contain p-[7%]" />
            ) : (
              <>
                <span className="text-[min(9vw,2.6rem)] leading-none">{art.emoji}</span>
                <span className="mt-1 line-clamp-2 px-1 text-center text-[10px] font-bold leading-tight text-white/75 sm:text-xs">{art.label}</span>
              </>
            ))}
        </span>
      </span>
    </button>
  );
}
