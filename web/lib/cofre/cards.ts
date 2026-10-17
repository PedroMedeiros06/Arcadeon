import { CORINGA } from "./engine.ts";

export interface CardArt {
  id: string;
  label: string;
  emoji: string;
  src: string;
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

export const CARD_BACK_SRC = "/games/cofre/cards/back.png";

export function cardArt(face: string): CardArt {
  const art = ART[face] ?? { label: face, emoji: "❔" };
  return { id: face, ...art, src: `/games/cofre/cards/${face}.png` };
}
