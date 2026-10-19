import { CORINGA } from "./engine.ts";

export interface CardArt {
  id: string;
  label: string;
  emoji: string;
  /** null enquanto a arte nao existe: a carta mostra emoji + nome */
  src: string | null;
}

// nome pro jogador e emoji de reserva enquanto a arte nao existe
const ART: Record<string, { label: string; emoji: string }> = {
  diamante: { label: "Diamante", emoji: "💎" },
  "barra-ouro": { label: "Barra de ouro", emoji: "🪙" },
  relogio: { label: "Relógio de bolso", emoji: "⌚" },
  coroa: { label: "Coroa", emoji: "👑" },
  perolas: { label: "Colar de pérolas", emoji: "📿" },
  chave: { label: "Chave antiga", emoji: "🗝️" },
  rubi: { label: "Rubi", emoji: "❤️" },
  dobrao: { label: "Dobrão", emoji: "🟡" },
  calice: { label: "Cálice", emoji: "🏆" },
  anel: { label: "Anel de esmeralda", emoji: "💍" },
  "dragao-jade": { label: "Dragão de jade", emoji: "🐉" },
  "ovo-imperial": { label: "Ovo imperial", emoji: "🥚" },
  maleta: { label: "Maleta de dinheiro", emoji: "💼" },
  quadro: { label: "Quadro", emoji: "🖼️" },
  ficha: { label: "Fichas de cassino", emoji: "🎰" },
  bussola: { label: "Bússola", emoji: "🧭" },
  safira: { label: "Safira", emoji: "🔷" },
  mascara: { label: "Máscara", emoji: "🎭" },
  [CORINGA]: { label: "Coringa", emoji: "🃏" },
};

/** faces com arquivo em public/games/cofre/cards/<id>.webp (o teste confere com o disco) */
const WITH_ART = new Set([
  "diamante",
  "barra-ouro",
  "relogio",
  "coroa",
  "perolas",
  "chave",
  "rubi",
  "dobrao",
  "calice",
  "anel",
  "dragao-jade",
  CORINGA,
]);

export const CARD_BACK_SRC = "/games/cofre/cards/back.webp";

/** verso + todas as artes, pra baixar antes da partida (carta virando nunca espera download) */
export const CARD_PRELOAD_SRCS: readonly string[] = [CARD_BACK_SRC, ...Array.from(WITH_ART, (face) => `/games/cofre/cards/${face}.webp`)];

export function cardArt(face: string): CardArt {
  const art = ART[face] ?? { label: face, emoji: "❔" };
  return { id: face, ...art, src: WITH_ART.has(face) ? `/games/cofre/cards/${face}.webp` : null };
}
