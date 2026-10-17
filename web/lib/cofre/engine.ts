// Regras puras do Cofre (jogo da memoria). Sem imports e sem I/O: o servidor
// copia este arquivo na fase 2 (server/src/cofreEngine.ts). Toda funcao devolve
// estado novo e nunca muta a entrada.

export type BoardSize = "4x4" | "6x4" | "6x5" | "6x6";

export const BOARD_SIZES: Record<BoardSize, { cols: number; rows: number }> = {
  "4x4": { cols: 4, rows: 4 },
  "6x4": { cols: 6, rows: 4 },
  "6x5": { cols: 6, rows: 5 },
  "6x6": { cols: 6, rows: 6 },
};

export const LOOT_FACES: readonly string[] = [
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
  "ovo-imperial",
  "maleta",
  "quadro",
  "ficha",
  "bussola",
  "safira",
  "mascara",
];

export const CORINGA = "coringa";

/** Gera numeros em [0,1). */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CofreOptions {
  size: BoardSize;
  movingBoard: boolean;
  coringa: boolean;
}

export type CellState = "hidden" | "up" | "taken";

export interface Cell {
  face: string;
  state: CellState;
}

export interface PlayerScore {
  points: number;
  pairs: number;
  misses: number;
}

export interface GameState {
  options: CofreOptions;
  cols: number;
  rows: number;
  /** o indice nunca muda; o tabuleiro movel troca o conteudo */
  cells: Cell[];
  /** 0, 1 ou 2 indices virados na jogada atual */
  flipped: number[];
  /** true depois de um erro ate o resolveMiss */
  pendingMiss: boolean;
  players: PlayerScore[];
  turn: number;
  moves: number;
  finished: boolean;
}

export type FlipEvent =
  | { kind: "invalid" }
  | { kind: "first"; index: number }
  | { kind: "match"; a: number; b: number; points: 1 | 3; finished: boolean }
  | { kind: "miss"; a: number; b: number };

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createGame(options: CofreOptions, playerCount: number, rng: Rng): GameState {
  const { cols, rows } = BOARD_SIZES[options.size];
  const faces = shuffle(LOOT_FACES, rng).slice(0, (cols * rows) / 2);
  if (options.coringa) faces[faces.length - 1] = CORINGA;
  const cells = shuffle([...faces, ...faces], rng).map((face): Cell => ({ face, state: "hidden" }));
  return {
    options: { ...options },
    cols,
    rows,
    cells,
    flipped: [],
    pendingMiss: false,
    players: Array.from({ length: playerCount }, () => ({ points: 0, pairs: 0, misses: 0 })),
    turn: 0,
    moves: 0,
    finished: false,
  };
}

export function pairPoints(face: string): 1 | 3 {
  return face === CORINGA ? 3 : 1;
}

export function flip(state: GameState, index: number): { state: GameState; event: FlipEvent } {
  const invalid = { state, event: { kind: "invalid" } as const };
  if (state.finished || state.pendingMiss || !Number.isInteger(index)) return invalid;
  const cell = state.cells[index];
  if (!cell || cell.state !== "hidden") return invalid;

  const cells = state.cells.map((c, i) => (i === index ? { ...c, state: "up" as const } : c));
  if (state.flipped.length === 0) {
    return { state: { ...state, cells, flipped: [index] }, event: { kind: "first", index } };
  }

  const a = state.flipped[0];
  const moves = state.moves + 1;
  const players = state.players.map((p) => ({ ...p }));
  const me = players[state.turn];

  if (cells[a].face === cell.face) {
    const points = pairPoints(cell.face);
    cells[a] = { ...cells[a], state: "taken" };
    cells[index] = { ...cells[index], state: "taken" };
    me.points += points;
    me.pairs += 1;
    const finished = cells.every((c) => c.state === "taken");
    return {
      state: { ...state, cells, flipped: [], players, moves, finished },
      event: { kind: "match", a, b: index, points, finished },
    };
  }

  me.misses += 1;
  return {
    state: { ...state, cells, flipped: [a, index], pendingMiss: true, players, moves },
    event: { kind: "miss", a, b: index },
  };
}
