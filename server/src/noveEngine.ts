// Regras puras do Nove (cartas 0-9 em 4 cores, cartela 3x3 de 1 a 9). Sem imports e sem I/O:
// o servidor tem uma copia identica em server/src/noveEngine.ts (teste compara os dois).
// Toda funcao devolve estado novo e nunca muta a entrada.

export const COLORS = ["verde", "vermelho", "azul", "amarelo"] as const;
export type CardColor = (typeof COLORS)[number];

/** copias de cada numero em cada cor (4 => 4 cartas "2 amarelo") */
export const COPIES_PER_NUMBER_COLOR = 4;

/** quantas cartas especiais vao no monte */
export const SPECIAL_COUNTS = { block: 12, plus: 12, wild: 8 } as const;

/**
 * Bloqueio: "self" = quem vira perde o resto da vez (regra pedida).
 * "next" = o proximo jogador perde a vez (estilo UNO; no 1x1 quem virou joga de novo).
 */
export const BLOCK_MODE: "self" | "next" = "self";

export type Card =
  | { id: number; kind: "number"; value: number; color: CardColor }
  | { id: number; kind: "block" }
  | { id: number; kind: "plus" }
  | { id: number; kind: "wild" };

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

export interface PlayerBoard {
  /** indice 0..8 = numero 1..9; guarda a cor da carta que preencheu */
  cells: (CardColor | null)[];
  /** cor exigida pela carta preta do adversario: so a proxima carta de numero dessa cor conta */
  required: CardColor | null;
  /** perde a proxima vez (bloqueio no modo "next") */
  skip: boolean;
  /** saiu da partida */
  left?: boolean;
}

export interface GameState {
  /** monte virado pra baixo; a proxima carta e' a ultima do array */
  draw: Card[];
  /** cartas ja viradas que nao foram pra cartela (topo = ultima) */
  discard: Card[];
  players: PlayerBoard[];
  turn: number;
  /** quem virou a preta precisa escolher a cor antes de passar a vez */
  pendingWild: boolean;
  /** ultima carta virada (pra mesa mostrar) */
  lastCard: Card | null;
  flips: number;
  winner: number | null;
  finished: boolean;
}

export type FlipEvent =
  | { kind: "invalid" }
  | { kind: "fill"; card: Card; value: number; color: CardColor; won: boolean }
  | { kind: "repeat"; card: Card }
  | { kind: "zero"; card: Card }
  | { kind: "wrong-color"; card: Card; required: CardColor }
  | { kind: "block"; card: Card }
  | { kind: "plus"; card: Card }
  | { kind: "wild"; card: Card };

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    for (let value = 0; value <= 9; value++) {
      for (let c = 0; c < COPIES_PER_NUMBER_COLOR; c++) deck.push({ id: id++, kind: "number", value, color });
    }
  }
  for (let i = 0; i < SPECIAL_COUNTS.block; i++) deck.push({ id: id++, kind: "block" });
  for (let i = 0; i < SPECIAL_COUNTS.plus; i++) deck.push({ id: id++, kind: "plus" });
  for (let i = 0; i < SPECIAL_COUNTS.wild; i++) deck.push({ id: id++, kind: "wild" });
  return deck;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function emptyBoard(): PlayerBoard {
  return { cells: Array.from({ length: 9 }, () => null), required: null, skip: false };
}

export function createGame(playerCount: number, rng: Rng): GameState {
  return {
    draw: shuffle(buildDeck(), rng),
    discard: [],
    players: Array.from({ length: playerCount }, emptyBoard),
    turn: 0,
    pendingWild: false,
    lastCard: null,
    flips: 0,
    winner: null,
    finished: false,
  };
}

export function filledCount(board: PlayerBoard): number {
  return board.cells.filter((c) => c !== null).length;
}

export function activePlayers(state: GameState): number[] {
  return state.players.flatMap((p, i) => (p.left ? [] : [i]));
}

function nextActive(state: GameState, from: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (!state.players[i].left) return i;
  }
  return from;
}

/** Passa a vez pulando quem saiu; quem tem "skip" perde essa vez (e o skip e' gasto). */
export function passTurn(state: GameState): GameState {
  let players = state.players;
  let turn = nextActive(state, state.turn);
  if (players[turn].skip) {
    players = players.map((p, i) => (i === turn ? { ...p, skip: false } : p));
    turn = nextActive({ ...state, players }, turn);
  }
  return { ...state, players, turn, pendingWild: false };
}

/** Monte vazio: embaralha o descarte e continua. */
function ensureDraw(state: GameState, rng: Rng): GameState {
  if (state.draw.length > 0 || state.discard.length === 0) return state;
  return { ...state, draw: shuffle(state.discard, rng), discard: [] };
}

/** O jogador da vez vira a carta do topo do monte. */
export function flip(state: GameState, rng: Rng): { state: GameState; event: FlipEvent } {
  if (state.finished || state.pendingWild) return { state, event: { kind: "invalid" } };
  const ready = ensureDraw(state, rng);
  if (ready.draw.length === 0) return { state, event: { kind: "invalid" } };

  const card = ready.draw[ready.draw.length - 1];
  const base: GameState = { ...ready, draw: ready.draw.slice(0, -1), lastCard: card, flips: ready.flips + 1 };
  const me = base.players[base.turn];
  const toDiscard = { ...base, discard: [...base.discard, card] };

  if (card.kind === "plus") return { state: toDiscard, event: { kind: "plus", card } };
  if (card.kind === "wild") return { state: { ...toDiscard, pendingWild: true }, event: { kind: "wild", card } };
  if (card.kind === "block") {
    if (BLOCK_MODE === "next") {
      const target = nextActive(toDiscard, toDiscard.turn);
      const players = toDiscard.players.map((p, i) => (i === target && target !== toDiscard.turn ? { ...p, skip: true } : p));
      return { state: passTurn({ ...toDiscard, players }), event: { kind: "block", card } };
    }
    return { state: passTurn(toDiscard), event: { kind: "block", card } };
  }

  // carta de numero: gasta a cor exigida, se houver
  const required = me.required;
  const cleared = required ? replacePlayer(toDiscard, toDiscard.turn, { ...me, required: null }) : toDiscard;
  if (required && card.color !== required) {
    return { state: passTurn(cleared), event: { kind: "wrong-color", card, required } };
  }
  if (card.value === 0) return { state: passTurn(cleared), event: { kind: "zero", card } };
  const slot = card.value - 1;
  const current = cleared.players[cleared.turn];
  if (current.cells[slot] !== null) return { state: passTurn(cleared), event: { kind: "repeat", card } };

  // vai pra cartela, nao pro descarte
  const cells = current.cells.map((c, i) => (i === slot ? card.color : c));
  const filled = replacePlayer({ ...cleared, discard: base.discard }, cleared.turn, { ...current, cells });
  const won = cells.every((c) => c !== null);
  if (won) return { state: { ...filled, winner: filled.turn, finished: true }, event: { kind: "fill", card, value: card.value, color: card.color, won } };
  return { state: passTurn(filled), event: { kind: "fill", card, value: card.value, color: card.color, won } };
}

function replacePlayer(state: GameState, index: number, player: PlayerBoard): GameState {
  return { ...state, players: state.players.map((p, i) => (i === index ? player : p)) };
}

/** Depois da preta: quem virou escolhe a cor que o proximo jogador vai precisar. */
export function chooseColor(state: GameState, color: CardColor): GameState {
  if (!state.pendingWild || state.finished || !COLORS.includes(color)) return state;
  const target = nextActive(state, state.turn);
  const withRule = target === state.turn ? state : replacePlayer(state, target, { ...state.players[target], required: color });
  return passTurn(withRule);
}

/** Quem saiu perde a vez; sobrando um so, ele vence. */
export function removePlayer(state: GameState, index: number): GameState {
  if (state.players[index]?.left) return state;
  const players = state.players.map((p, i) => (i === index ? { ...p, left: true } : p));
  let next: GameState = { ...state, players };
  const active = activePlayers(next);
  if (active.length <= 1 && !next.finished) {
    return { ...next, finished: true, winner: active[0] ?? null, pendingWild: false };
  }
  if (next.turn === index && !next.finished) next = passTurn(next);
  return next;
}
