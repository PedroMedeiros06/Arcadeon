import type { CardColor } from "@/lib/nove/engine";
import { COLOR_HEX } from "@/lib/nove/cards";

/** Cartela 3x3 de 1 a 9. fresh = indice que acabou de ser preenchido (anima). */
export function Cartela({ cells, fresh, size = "lg" }: { cells: (CardColor | null)[]; fresh: number | null; size?: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <div className={`grid grid-cols-3 ${big ? "w-full max-w-[14rem] gap-2" : "w-[6.6rem] gap-1"}`}>
      {cells.map((color, i) => (
        <div
          key={i}
          className={`flex aspect-square items-center justify-center font-display font-black ${big ? "rounded-xl text-3xl" : "rounded-md text-sm"} ${
            color ? "text-white shadow-[inset_0_-0.2em_0_rgba(0,0,0,0.18)]" : "border-2 border-dashed border-[var(--border)] text-[var(--fg-muted)] opacity-60"
          } ${color && fresh === i ? "nove-pop" : ""}`}
          style={color ? { background: COLOR_HEX[color] } : undefined}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}
