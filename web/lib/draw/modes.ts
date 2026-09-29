import type { GameMode, Modifier, Team } from "./types";

export const MODE_INFO: Record<GameMode, { label: string; short: string; minPlayers: number }> = {
  classic: { label: "Clássico", short: "Um desenha, todo mundo chuta.", minPlayers: 2 },
  teams: {
    label: "Duelo de times",
    short: "Só o seu time chuta. Nos últimos 10s o outro time pode roubar.",
    minPlayers: 4,
  },
  impostor: {
    label: "Artista Impostor",
    short: "Todos desenham um traço por vez. Um não sabe a palavra: descubra quem.",
    minPlayers: 3,
  },
};

export const MODIFIER_INFO: Record<Modifier, { label: string; short: string; emoji: string }> = {
  blind: { label: "Às cegas", short: "Quem desenha não vê o próprio desenho", emoji: "🙈" },
  mono: { label: "Uma cor só", short: "Só preto (e borracha)", emoji: "⚫" },
  noUndo: { label: "Sem volta", short: "Sem borracha, desfazer ou limpar", emoji: "🚫" },
  fading: { label: "Some aos poucos", short: "Os traços somem depois de 10s", emoji: "👻" },
  lightning: { label: "Relâmpago", short: "Turno de 30s valendo 1,5×", emoji: "⚡" },
};

export const MODIFIERS: Modifier[] = ["blind", "mono", "noUndo", "fading", "lightning"];

export const TEAM_INFO: Record<Team, { label: string; color: string; bg: string }> = {
  a: { label: "Time Rosa", color: "#e0457b", bg: "rgba(224,69,123,0.14)" },
  b: { label: "Time Azul", color: "#2f7de1", bg: "rgba(47,125,225,0.14)" },
};

/** Tempo de vida de um traco no modificador "some aos poucos" (ms); os ultimos 3s desbotam. */
export const FADE_LIFE_MS = 10_000;
export const FADE_OUT_MS = 3_000;

export const STEAL_WINDOW_MS = 10_000;
