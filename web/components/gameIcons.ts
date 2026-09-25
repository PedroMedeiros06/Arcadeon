import { CaseSensitive, Flag, Grid3x3, Palette, type LucideIcon } from "lucide-react";

// Fica fora de lib/games.ts porque componentes nao podem ir de Server para Client Component como prop.
export const GAME_ICONS: Record<string, LucideIcon> = {
  termo: Grid3x3,
  buggle: CaseSensitive,
  drawit: Palette,
  corrida: Flag,
};
