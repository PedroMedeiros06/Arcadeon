import type { Card, CardColor } from "./engine";

export const COLOR_HEX: Record<CardColor, string> = {
  verde: "#1fa45a",
  vermelho: "#e2424b",
  azul: "#2d6be0",
  amarelo: "#f0b400",
};

export const COLOR_LABEL: Record<CardColor, string> = {
  verde: "verde",
  vermelho: "vermelho",
  azul: "azul",
  amarelo: "amarelo",
};

export type EventTone = "good" | "bad" | "neutral" | "wild";

/** Texto curto do que aconteceu na mesa, do ponto de vista de quem esta vendo. */
export function describeEvent(
  ev:
    | { kind: "fill" | "repeat" | "zero" | "wrong-color" | "block" | "plus" | "wild"; required?: CardColor | null }
    | { kind: "color"; color: CardColor }
    | { kind: "left" },
  card: Card | null,
  isMe: boolean,
  name: string
): { text: string; tone: EventTone } | null {
  const value = card?.kind === "number" ? card.value : null;
  switch (ev.kind) {
    case "fill":
      return { text: isMe ? `${value} na cartela!` : `${name} marcou o ${value}`, tone: isMe ? "good" : "neutral" };
    case "repeat":
      return { text: isMe ? `Já tinha o ${value}` : `${name} já tinha o ${value}`, tone: "neutral" };
    case "zero":
      return { text: "Zero não conta", tone: "neutral" };
    case "wrong-color":
      return {
        text: isMe ? `Não era ${ev.required ? COLOR_LABEL[ev.required] : "a cor"}... não contou` : `${name} errou a cor`,
        tone: isMe ? "bad" : "good",
      };
    case "block":
      return { text: isMe ? "Bloqueio! Perdeu a vez" : `${name} levou bloqueio`, tone: isMe ? "bad" : "good" };
    case "plus":
      return { text: isMe ? "+1! Vire outra carta" : `${name} vira outra`, tone: isMe ? "good" : "neutral" };
    case "wild":
      return { text: isMe ? "Carta preta! Escolha a cor" : `${name} vai escolher sua cor`, tone: "wild" };
    case "color":
      return {
        text: isMe ? `Você escolheu ${COLOR_LABEL[ev.color]}` : `Sua próxima carta precisa ser ${COLOR_LABEL[ev.color]}`,
        tone: isMe ? "wild" : "bad",
      };
    case "left":
      return { text: `${name} saiu da partida`, tone: "neutral" };
  }
}
