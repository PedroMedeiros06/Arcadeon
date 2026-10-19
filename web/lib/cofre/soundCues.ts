import type { Sfx } from "./sound";

/** Recorte do snapshot da sala que decide os sons. */
export interface CueSnapshot {
  phase: "lobby" | "countdown" | "peek" | "playing" | "results";
  flippedCount: number;
  turnSocketId: string | null;
  lastEvent: { seq: number; kind: "match"; points: number } | { seq: number; kind: "miss" | "timeout" | "left" } | null;
  swapSeq: number;
  /** minha colocacao (0 = fora da partida) */
  myPlace: number;
}

/**
 * Sons a tocar na chegada de um snapshot novo, comparando com o anterior. Puro, pra testar sem audio.
 * `afterFlipBack`: sons que esperam a carta virar de volta (troca do tabuleiro movel).
 */
export function onlineCues(prev: CueSnapshot | null, next: CueSnapshot, mySocketId: string): { now: Sfx[]; afterFlipBack: Sfx[] } {
  const now: Sfx[] = [];
  const afterFlipBack: Sfx[] = [];
  if (!prev) return { now, afterFlipBack };

  if (next.phase !== prev.phase) {
    if (next.phase === "countdown") now.push("dial");
    if (next.phase === "results") now.push("open", next.myPlace === 1 ? "win" : "lose");
    return { now, afterFlipBack };
  }
  if (next.phase !== "playing") return { now, afterFlipBack };

  const ev = next.lastEvent && next.lastEvent.seq !== prev.lastEvent?.seq ? next.lastEvent : null;
  // par: as duas cartas saem de "flipped" no mesmo snapshot em que a segunda vira
  if (next.flippedCount > prev.flippedCount || ev?.kind === "match") now.push("flip");
  if (ev?.kind === "match") now.push(ev.points === 3 ? "coringa" : "match");
  else if (ev?.kind === "miss") now.push("miss");
  else if (ev?.kind === "timeout") now.push("timeout");

  if (next.turnSocketId === mySocketId && prev.turnSocketId !== mySocketId) now.push("yourTurn");
  if (next.swapSeq > prev.swapSeq) afterFlipBack.push("swap");
  return { now, afterFlipBack };
}
