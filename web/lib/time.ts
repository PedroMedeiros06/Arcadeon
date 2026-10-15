const DAY_MS = 86_400_000;
// Brasilia e UTC-3 o ano todo desde 2019 (sem horario de verao)
const BRASILIA_OFFSET_MS = 3 * 3_600_000;

/** Quanto falta pra virar o dia do Arcadeon (meia-noite de Brasilia). Entre 1 ms e 24 h. */
export function msUntilBrasiliaMidnight(now: number): number {
  const sinceMidnight = (((now - BRASILIA_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - sinceMidnight;
}

/** "5 h 12 min", "5 h", "12 min" ou "menos de 1 min". */
export function formatCountdown(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMin < 1) return "menos de 1 min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
