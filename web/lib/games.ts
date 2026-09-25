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
    title: "DrawIt",
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
];

export function getGame(slug: string): GameInfo {
  const game = games.find((g) => g.slug === slug);
  if (!game) throw new Error(`Jogo desconhecido: ${slug}`);
  return game;
}
