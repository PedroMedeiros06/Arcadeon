import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZES,
  CORINGA,
  LOOT_FACES,
  createGame,
  flip,
  mulberry32,
  placements,
  resolveMiss,
  soloScore,
  type BoardSize,
  type CofreOptions,
  type GameState,
} from "./engine.ts";

const opts = (size: BoardSize, extra: Partial<CofreOptions> = {}): CofreOptions => ({ size, movingBoard: false, coringa: false, ...extra });

/** Estado montado na mao, sem embaralhar. */
function stateWith(faces: string[], players = 1, extra: Partial<CofreOptions> = {}): GameState {
  return {
    options: opts("4x4", extra),
    cols: 4,
    rows: Math.ceil(faces.length / 4),
    cells: faces.map((face) => ({ face, state: "hidden" as const })),
    flipped: [],
    pendingMiss: false,
    players: Array.from({ length: players }, () => ({ points: 0, pairs: 0, misses: 0 })),
    turn: 0,
    moves: 0,
    finished: false,
  };
}

test("createGame monta pares embaralhados", () => {
  for (const size of Object.keys(BOARD_SIZES) as BoardSize[]) {
    const { cols, rows } = BOARD_SIZES[size];
    const g = createGame(opts(size), 3, mulberry32(7));
    assert.equal(g.cells.length, cols * rows);
    assert.equal(g.cols, cols);
    assert.equal(g.rows, rows);
    const counts = new Map<string, number>();
    for (const c of g.cells) counts.set(c.face, (counts.get(c.face) ?? 0) + 1);
    for (const n of counts.values()) assert.equal(n, 2);
    assert.equal(counts.size, (cols * rows) / 2);
    assert.ok(g.cells.every((c) => c.state === "hidden"));
    assert.ok(g.cells.every((c) => LOOT_FACES.includes(c.face)));
    assert.deepEqual(g.players, [0, 1, 2].map(() => ({ points: 0, pairs: 0, misses: 0 })));
    assert.equal(g.turn, 0);
    assert.equal(g.moves, 0);
    assert.equal(g.finished, false);
  }
});

test("createGame com coringa troca um par", () => {
  const g = createGame(opts("4x4", { coringa: true }), 2, mulberry32(1));
  assert.equal(g.cells.length, 16);
  assert.equal(g.cells.filter((c) => c.face === CORINGA).length, 2);
  assert.equal(new Set(g.cells.filter((c) => c.face !== CORINGA).map((c) => c.face)).size, 7);
  const sem = createGame(opts("4x4"), 2, mulberry32(1));
  assert.equal(sem.cells.filter((c) => c.face === CORINGA).length, 0);
});

test("createGame e deterministico com a mesma semente", () => {
  const a = createGame(opts("6x4"), 2, mulberry32(42));
  const b = createGame(opts("6x4"), 2, mulberry32(42));
  const c = createGame(opts("6x4"), 2, mulberry32(43));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.cells, c.cells);
});

test("flip acerta par normal", () => {
  let s = stateWith(["diamante", "diamante", "rubi", "rubi"]);
  const r1 = flip(s, 0);
  assert.deepEqual(r1.event, { kind: "first", index: 0 });
  assert.equal(r1.state.cells[0].state, "up");
  s = r1.state;
  const r2 = flip(s, 1);
  assert.deepEqual(r2.event, { kind: "match", a: 0, b: 1, points: 1, finished: false });
  assert.equal(r2.state.cells[0].state, "taken");
  assert.equal(r2.state.cells[1].state, "taken");
  assert.deepEqual(r2.state.players[0], { points: 1, pairs: 1, misses: 0 });
  assert.equal(r2.state.turn, 0);
  assert.equal(r2.state.moves, 1);
  assert.deepEqual(r2.state.flipped, []);
});

test("flip par de coringa vale 3", () => {
  const s = stateWith([CORINGA, "rubi", CORINGA, "rubi"]);
  const r = flip(flip(s, 0).state, 2);
  assert.equal(r.event.kind, "match");
  assert.equal(r.event.kind === "match" && r.event.points, 3);
  assert.equal(r.state.players[0].points, 3);
  assert.equal(r.state.players[0].pairs, 1);
});

test("flip erra e segura as cartas", () => {
  const s = stateWith(["diamante", "rubi", "diamante", "rubi"], 2);
  const r = flip(flip(s, 0).state, 1);
  assert.deepEqual(r.event, { kind: "miss", a: 0, b: 1 });
  assert.equal(r.state.cells[0].state, "up");
  assert.equal(r.state.cells[1].state, "up");
  assert.equal(r.state.pendingMiss, true);
  assert.equal(r.state.players[0].misses, 1);
  assert.equal(r.state.turn, 0);
  assert.equal(r.state.moves, 1);
});

test("flip ignora clique com erro pendente", () => {
  const s = stateWith(["diamante", "rubi", "diamante", "rubi"]);
  const miss = flip(flip(s, 0).state, 1).state;
  const r = flip(miss, 2);
  assert.deepEqual(r.event, { kind: "invalid" });
  assert.equal(r.state, miss);
});

test("flip ignora carta ja virada ou recolhida", () => {
  const s = stateWith(["diamante", "diamante", "rubi", "rubi"]);
  const first = flip(s, 0).state;
  const again = flip(first, 0);
  assert.deepEqual(again.event, { kind: "invalid" });
  assert.equal(again.state, first);
  const matched = flip(first, 1).state;
  assert.deepEqual(flip(matched, 0).event, { kind: "invalid" });
  assert.deepEqual(flip(matched, 99).event, { kind: "invalid" });
  assert.deepEqual(flip(matched, -1).event, { kind: "invalid" });
  assert.equal(flip(matched, 0).state.moves, 1);
});

test("ultimo par termina o jogo", () => {
  const s = stateWith(["diamante", "diamante", "rubi", "rubi"]);
  s.cells[0].state = "taken";
  s.cells[1].state = "taken";
  const r = flip(flip(s, 2).state, 3);
  assert.deepEqual(r.event, { kind: "match", a: 2, b: 3, points: 1, finished: true });
  assert.equal(r.state.finished, true);
  assert.deepEqual(flip(r.state, 0).event, { kind: "invalid" });
});

test("flip nao muta o estado de entrada", () => {
  const s = stateWith(["diamante", "diamante", "rubi", "rubi"]);
  const snap = JSON.stringify(s);
  flip(flip(s, 0).state, 1);
  assert.equal(JSON.stringify(s), snap);
});

function missed(faces: string[], players = 2, extra: Partial<CofreOptions> = {}) {
  const s = stateWith(faces, players, extra);
  return flip(flip(s, 0).state, 1).state;
}

test("resolveMiss esconde e passa a vez", () => {
  const faces = ["diamante", "rubi", "diamante", "rubi"];
  const r = resolveMiss(missed(faces), mulberry32(3));
  assert.equal(r.swap, null);
  assert.ok(r.state.cells.every((c) => c.state === "hidden"));
  assert.deepEqual(r.state.flipped, []);
  assert.equal(r.state.pendingMiss, false);
  assert.equal(r.state.turn, 1);
  assert.deepEqual(r.state.cells.map((c) => c.face), faces);
  // turno 1 erra e volta pro 0
  const back = resolveMiss(flip(flip(r.state, 0).state, 1).state, mulberry32(3));
  assert.equal(back.state.turn, 0);
});

test("resolveMiss com tabuleiro movel troca duas escondidas", () => {
  const faces = ["diamante", "rubi", "diamante", "rubi", "coroa", "coroa", "anel", "anel"];
  const before = missed(faces, 2, { movingBoard: true });
  before.cells[4].state = "taken";
  before.cells[5].state = "taken";
  const r = resolveMiss(before, mulberry32(9));
  assert.ok(r.swap);
  const [a, b] = r.swap!;
  assert.notEqual(a, b);
  assert.ok(![4, 5].includes(a) && ![4, 5].includes(b));
  assert.equal(r.state.cells[a].face, faces[b]);
  assert.equal(r.state.cells[b].face, faces[a]);
  r.state.cells.forEach((c, i) => {
    if (i !== a && i !== b) assert.equal(c.face, faces[i]);
  });
  assert.equal(r.state.cells[4].state, "taken");
});

test("resolveMiss no fim do jogo troca as duas que erraram", () => {
  const before = missed(["diamante", "rubi", "diamante", "rubi"], 1, { movingBoard: true });
  before.cells[2].state = "taken";
  before.cells[3].state = "taken";
  const r = resolveMiss(before, mulberry32(5));
  assert.deepEqual([...r.swap!].sort(), [0, 1]);
});

test("resolveMiss sem erro pendente nao faz nada", () => {
  const s = stateWith(["diamante", "diamante", "rubi", "rubi"], 1, { movingBoard: true });
  const r = resolveMiss(s, mulberry32(1));
  assert.equal(r.state, s);
  assert.equal(r.swap, null);
});

test("placements desempata por pares e erros", () => {
  const p = (points: number, pairs: number, misses: number) => ({ points, pairs, misses });
  assert.deepEqual(placements([p(3, 1, 0), p(3, 3, 5)]), [2, 1]);
  assert.deepEqual(placements([p(3, 3, 2), p(3, 3, 1)]), [2, 1]);
  assert.deepEqual(placements([p(3, 3, 1), p(3, 3, 1), p(1, 1, 0)]), [1, 1, 3]);
  assert.deepEqual(placements([p(5, 3, 9), p(4, 4, 0)]), [1, 2]);
});

test("soloScore soma jogadas x10 e segundos", () => {
  assert.equal(soloScore(14, 63), 203);
});
