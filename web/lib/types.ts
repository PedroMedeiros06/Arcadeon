export type GameStatus = "available" | "coming-soon";

export interface GameInfo {
  slug: string;
  title: string;
  description: string;
  icon: string;
  status: GameStatus;
  multiplayer: boolean;
}

export interface Avatar {
  id: string;
  name: string;
  emoji: string;
  bg_color: string;
  image_url: string | null;
  price_coins: number | null;
  unlock_achievement_id: string | null;
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
