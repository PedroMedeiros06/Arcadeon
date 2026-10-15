export type ActivityGame = "hub" | "termo" | "buggle" | "drawit" | "corrida";

/** No maximo um registro por jogo a cada 10 minutos por aba. */
export const DEDUPE_MS = 10 * 60 * 1000;

function parseLast(raw: string | null): Record<string, number> {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(value)) if (typeof v === "number") out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** Decide se registra agora e devolve o novo conteudo do storage. Pura, pra testar sem navegador. */
export function shouldLog(raw: string | null, game: ActivityGame, now: number): { log: boolean; next: string } {
  const last = parseLast(raw);
  const prev = last[game];
  // relogio voltou (fuso trocado, ajuste manual): registra de novo em vez de calar por horas
  const log = prev === undefined || now - prev >= DEDUPE_MS || now < prev;
  if (log) last[game] = now;
  return { log, next: JSON.stringify(last) };
}
