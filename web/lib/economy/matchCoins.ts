/** Texto do selo da tela de resultado. null quando a partida nao paga (menos de 2 logados). */
export function matchCoinsLabel(awarded: number, capped: boolean): string | null {
  const n = Number.isFinite(awarded) ? Math.max(0, Math.floor(awarded)) : 0;
  const coins = n === 1 ? "+1 moeda" : `+${n} moedas`;
  if (n > 0 && capped) return `${coins}, limite de hoje atingido`;
  if (n > 0) return coins;
  return capped ? "Limite de moedas de hoje atingido" : null;
}
