export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;
export type RoomGame = "buggle" | "drawit" | "corrida" | "cofre";

export type JoinTarget =
  | { kind: "go"; href: string }
  | { kind: "choose"; options: { game: RoomGame; href: string }[] }
  | { kind: "missing" };

/** Limpa o que a pessoa digitou. null quando nao pode ser um codigo de sala. */
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Para onde ir, sabendo em quais jogos o codigo existe (cada jogo gera os seus, entao podem coincidir). */
export function joinTarget(code: string, games: RoomGame[]): JoinTarget {
  const options = games.map((game) => ({ game, href: `/games/${game}?join=${code}` }));
  if (options.length === 0) return { kind: "missing" };
  if (options.length === 1) return { kind: "go", href: options[0].href };
  return { kind: "choose", options };
}
