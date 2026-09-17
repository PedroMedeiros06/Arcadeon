export type GameStatus = "available" | "coming-soon";

export interface GameInfo {
  slug: string;
  title: string;
  description: string;
  icon: string;
  status: GameStatus;
  multiplayer: boolean;
}
