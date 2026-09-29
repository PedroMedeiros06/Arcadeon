export type GameMode = "classic" | "teams" | "impostor";
export type Modifier = "blind" | "mono" | "noUndo" | "fading" | "lightning";
export type Team = "a" | "b";

export interface DrawRoomConfig {
  roundsPerPlayer: number;
  turnSeconds: number;
  visibility: "public" | "private";
  maxPlayers: number;
  mode: GameMode;
  modifiers: Modifier[];
}

export interface PlayerAvatar {
  emoji: string | null;
  bgColor: string | null;
  imageUrl: string | null;
}

/** `id` e estavel entre reconexoes (F5, queda de rede); nao e o socket.id. */
export interface DrawPlayerPublic {
  id: string;
  name: string;
  score: number;
  avatar: PlayerAvatar | null;
  team: Team;
  hasGuessedThisTurn: boolean;
  /** false = caiu e esta dentro da janela de reconexao */
  connected: boolean;
}

export type DrawRoomPhase =
  | "lobby"
  | "picking-word"
  | "drawing"
  | "turn-results"
  | "impostor-drawing"
  | "impostor-voting"
  | "impostor-guess"
  | "impostor-reveal"
  | "results";

export type Difficulty = 1 | 2 | 3;

export interface WordEntry {
  word: string;
  category: string;
  difficulty: Difficulty;
  /** maximo por acerto com essa palavra (calculado no servidor) */
  maxPoints: number;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Fácil", 2: "Média", 3: "Difícil" };

export interface Point {
  x: number;
  y: number;
}

export interface StrokeEvent {
  type: "stroke";
  id: string;
  points: Point[];
  color: string;
  width: number;
  /** horario do servidor (modificador "some aos poucos"); eventos locais recebem o do client */
  at?: number;
}

export interface FillEvent {
  type: "fill";
  id: string;
  x: number;
  y: number;
  color: string;
  at?: number;
}

export type ShapeKind = "line" | "rect" | "ellipse";

export interface ShapeEvent {
  type: "shape";
  id: string;
  shape: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  at?: number;
}

export interface ClearEvent {
  type: "clear";
  id: string;
  at?: number;
}

export type DrawEvent = StrokeEvent | FillEvent | ShapeEvent | ClearEvent;

/** O que o DrawGame consegue fazer no canvas montado. */
export interface CanvasHandlers {
  applyEvent: (event: DrawEvent) => void;
  applyUndo: (id: string) => void;
  /** substitui tudo (reconexao); clockOffset converte o `at` do servidor pro relogio local */
  load: (events: DrawEvent[], clockOffset: number) => void;
  /** JPEG do desenho atual com fundo branco, ou null se o canvas estiver vazio */
  snapshot: () => string | null;
}

export interface DrawRoomState {
  code: string;
  /** id do proprio jogador nesta sala */
  myId: string;
  hostId: string;
  config: DrawRoomConfig;
  phase: DrawRoomPhase;
  turnOrder: string[];
  round: number;
  drawerId: string | null;
  currentWord: string | null;
  currentWordLength: number | null;
  currentWordMask: string | null;
  currentDifficulty: Difficulty | null;
  wordOptions: WordEntry[] | null;
  pickEndsAt: number | null;
  turnEndsAt: number | null;
  turnModifier: Modifier | null;
  /** times: quem roubou o turno */
  stolenBy: string | null;
  /** impostor: fim do traco da vez / votacao / chute */
  phaseEndsAt: number | null;
  impostor: ImpostorPublic | null;
  /** relogio do servidor no envio: o client calcula a diferenca pro proprio relogio */
  serverNow: number;
  players: DrawPlayerPublic[];
}

/** Rodada do Artista Impostor vista por um jogador. Campos de revelacao chegam null antes do fim. */
export interface ImpostorPublic {
  category: string;
  /** null pro impostor (ate a revelacao) */
  word: string | null;
  amImpostor: boolean;
  impostorId: string | null;
  strokerId: string | null;
  strokeIndex: number;
  totalStrokes: number;
  /** ordem de uma volta */
  strokeOrder: string[];
  colors: Record<string, string>;
  votedIds: string[];
  myVote: string | null;
  votes: { voter: string; target: string }[] | null;
  caught: boolean | null;
  impostorGuess: string | null;
  impostorGuessedRight: boolean | null;
  gained: Record<string, number> | null;
  aborted: boolean;
}

export interface DrawSession {
  code: string;
  playerId: string;
  token: string;
}

export interface GuessResult {
  correct: boolean;
  close: boolean;
  points: number;
  rank: number | null;
  alreadyGuessed: boolean;
  tooFast: boolean;
  notYourTurn: boolean;
  stole: boolean;
  guess: string;
}

export interface TurnEndedPayload {
  word: string | null;
  difficulty: Difficulty | null;
  drawerId: string | null;
  reason: "timeout" | "all-guessed" | "drawer-left" | "stolen";
  stolenBy: string | null;
  players: { id: string; name: string; score: number; team: Team; gained: number }[];
}

export interface FeedItem {
  id: string;
  /** own-* = acoes do proprio jogador; correct = outro acertou (sem revelar a palavra) */
  kind: "wrong" | "own-wrong" | "close" | "correct" | "own-correct" | "system" | "chat" | "steal";
  name?: string;
  text: string;
}

export interface RankedPlayer {
  id: string;
  name: string;
  score: number;
  team: Team;
}

/** Desenho de um turno guardado no client pra galeria do fim de jogo. */
export interface GalleryDrawing {
  id: string;
  imageUrl: string;
  word: string;
  drawerName: string;
  difficulty: Difficulty | null;
  round: number;
}
