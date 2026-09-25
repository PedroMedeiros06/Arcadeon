export type GameStatus = "available" | "coming-soon";

export interface GameInfo {
  slug: string;
  title: string;
  description: string;
  icon: string;
  status: GameStatus;
  multiplayer: boolean;
  /** cor de identidade do jogo (token CSS), usada no card, header e lobby */
  accent: string;
  /** texto curto de quantos jogam, ex.: "Solo", "Até 16" */
  players: string;
  tags: string[];
}

export interface Avatar {
  id: string;
  name: string;
  emoji: string;
  bg_color: string;
  image_url: string | null;
  price_coins: number | null;
  unlock_achievement_id: string | null;
  /** conquista que libera o avatar (so vem no catalogo da loja) */
  achievement?: { name: string; description: string } | null;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface UserAvatar {
  avatar_id: string;
  acquired_via: "purchase" | "achievement";
}
