/** Posicao (1 = primeiro) de quem esta logado numa lista ja ordenada. null quando nao aparece. */
export function rankFor(rows: { username: string }[], username: string | null): number | null {
  if (!username) return null;
  const target = username.toLowerCase();
  const idx = rows.findIndex((r) => r.username.toLowerCase() === target);
  return idx === -1 ? null : idx + 1;
}
