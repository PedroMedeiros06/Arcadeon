import type { GameInfo } from "./types";

export const games: GameInfo[] = [
  {
    slug: "termo",
    title: "Termo",
    description: "Adivinhe a palavra de 5 letras em 6 tentativas.",
    icon: "🟩",
    status: "available",
    multiplayer: false,
  },
  {
    slug: "buggle",
    title: "Buggle",
    description: "Encontre o maximo de palavras no tabuleiro de letras.",
    icon: "🔤",
    status: "available",
    multiplayer: true,
  },
];
