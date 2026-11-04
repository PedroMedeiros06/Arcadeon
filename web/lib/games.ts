import type { GameInfo } from "./types";

export const games: GameInfo[] = [
  {
    slug: "termo",
    title: "Letrado",
    description: "Adivinhe a palavra de 5 letras em 6 tentativas.",
    icon: "🟩",
    status: "available",
    multiplayer: false,
    accent: "var(--game-termo)",
    players: "Solo",
    tags: ["Diário", "Ranking"],
  },
  {
    slug: "buggle",
    title: "Buggle",
    description: "Encontre o máximo de palavras no tabuleiro de letras.",
    icon: "🔤",
    status: "available",
    multiplayer: true,
    accent: "var(--game-buggle)",
    players: "Até 24",
    tags: ["Online"],
  },
  {
    slug: "drawit",
    title: "Rabiscado",
    description: "Desenhe e adivinhe com seus amigos em tempo real.",
    icon: "🎨",
    status: "available",
    multiplayer: true,
    accent: "var(--game-drawit)",
    players: "Até 16",
    tags: ["Online"],
  },
  {
    slug: "corrida",
    title: "Corrida do Conhecimento",
    description: "Responda rápido e acelere até a linha de chegada.",
    icon: "🏁",
    status: "available",
    multiplayer: true,
    accent: "var(--game-corrida)",
    players: "Até 16",
    tags: ["Online", "Ranking"],
  },
  {
    slug: "cofre",
    title: "Cofre",
    description: "Jogo da memória de assalto: decore, combine e leve o espólio.",
    icon: "🔐",
    status: "available",
    multiplayer: true,
    accent: "var(--game-cofre)",
    players: "Até 8",
    tags: ["Online", "Treino"],
  },
  {
    slug: "carteado",
    title: "Carteado",
    description: "Vire cartas e complete sua cartela de 1 a 9 antes do adversário.",
    icon: "🃏",
    status: "available",
    multiplayer: true,
    accent: "var(--game-carteado)",
    players: "1x1",
    tags: ["Online", "Treino"],
  },
];

// O id interno do Letrado continua "termo" (banco, presenca, missoes); so o endereco mudou.
const ROUTE_SEGMENT: Record<string, string> = { termo: "letrado" };

/** Endereco da pagina do jogo. */
export function gamePath(slug: string): string {
  return `/games/${ROUTE_SEGMENT[slug] ?? slug}`;
}

/** Id do jogo a partir do trecho da URL (/games/<trecho>). */
export function gameSlugFromRoute(segment: string): string {
  return Object.keys(ROUTE_SEGMENT).find((slug) => ROUTE_SEGMENT[slug] === segment) ?? segment;
}

export function getGame(slug: string): GameInfo {
  const game = games.find((g) => g.slug === slug);
  if (!game) throw new Error(`Jogo desconhecido: ${slug}`);
  return game;
}
