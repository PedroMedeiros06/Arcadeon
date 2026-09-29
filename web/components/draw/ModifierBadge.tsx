import { MODIFIER_INFO } from "@/lib/draw/modes";
import type { Modifier } from "@/lib/draw/types";
import type { CanvasRules } from "./Canvas";

/** Selo do modificador sorteado no turno. */
export function ModifierBadge({ modifier, size = "sm" }: { modifier: Modifier; size?: "sm" | "lg" }) {
  const info = MODIFIER_INFO[modifier];
  return (
    <span
      title={info.short}
      className={`inline-flex items-center gap-1 rounded-full bg-[var(--draw-close-bg)] font-extrabold text-[var(--draw-close)] ${
        size === "lg" ? "flex-wrap justify-center px-3 py-1 text-center text-sm" : "px-2 py-0.5 text-[10px] uppercase tracking-wide sm:text-xs"
      }`}
    >
      <span aria-hidden>{info.emoji}</span>
      {info.label}
      {size === "lg" && <span className="font-semibold opacity-80">· {info.short}</span>}
    </span>
  );
}

/** Regras do canvas pro modificador do turno. */
export function rulesFor(modifier: Modifier | null): CanvasRules {
  return {
    mono: modifier === "mono",
    noUndo: modifier === "noUndo",
    fading: modifier === "fading",
    blind: modifier === "blind",
  };
}
