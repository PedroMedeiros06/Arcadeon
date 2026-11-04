import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLORS,
  COPIES_PER_NUMBER_COLOR,
  SPECIAL_COUNTS,
  buildDeck,
  chooseColor,
  createGame,
  filledCount,
  flip,
  mulberry32,
  removePlayer,
  type Card,
  type CardColor,
  type GameState,
} from "./engine.ts";

const rng = mulberry32(1);
let nextId = 1000;
const num = (value: number, color: CardColor): Card => ({ id: nextId++, kind: "number", value, color });
const special = (kind: "block" | "plus" | "wild"): Card => ({ id: nextId++, kind });

/** Monte na ordem de saida (primeira carta da lista sai primeiro). */
function stateWith(cards: Card[], players = 2): GameState {
  const g = createGame(players, rng);
  return { ...g, draw: [...cards].reverse() };
}

test("baralho tem 4 copias de cada numero em cada cor e as especiais", () => {
  const deck = buildDeck();
  for (const color of COLORS) {
    for (let v = 0; v <= 9; v++) {
      const n = deck.filter((c) => c.kind === "number" && c.value === v && c.color === color).length;
      assert.equal(n, COPIES_PER_NUMBER_COLOR, `${v} ${color}`);
    }
  }
  assert.equal(deck.filter((c) => c.kind === "block").length, SPECIAL_COUNTS.block);
  assert.equal(deck.filter((c) => c.kind === "plus").length, SPECIAL_COUNTS.plus);
  assert.equal(deck.filter((c) => c.kind === "wild").length, SPECIAL_COUNTS.wild);
  assert.equal(new Set(deck.map((c) => c.id)).size, deck.length);
  assert.equal(createGame(2, mulberry32(3)).draw.length, deck.length);
});

test("numero novo preenche a cartela e passa a vez", () => {
  const { state, event } = flip(stateWith([num(5, "azul")]), rng);
  assert.equal(event.kind, "fill");
  assert.equal(state.players[0].cells[4], "azul");
  assert.equal(state.turn, 1);
  assert.equal(state.discard.length, 0);
});

test("numero repetido so passa a vez", () => {
  let s = stateWith([num(5, "azul"), num(1, "verde"), num(5, "vermelho")]);
  s = flip(s, rng).state;
  s = flip(s, rng).state;
  const { state, event } = flip(s, rng);
  assert.equal(event.kind, "repeat");
  assert.equal(state.players[0].cells[4], "azul");
  assert.equal(state.turn, 1);
});

test("zero nunca conta", () => {
  const { state, event } = flip(stateWith([num(0, "verde")]), rng);
  assert.equal(event.kind, "zero");
  assert.equal(filledCount(state.players[0]), 0);
  assert.equal(state.turn, 1);
});

test("bloqueio passa a vez de quem virou", () => {
  const { state, event } = flip(stateWith([special("block")]), rng);
  assert.equal(event.kind, "block");
  assert.equal(state.turn, 1);
});

test("+1 deixa virar outra carta, em cadeia", () => {
  let s = stateWith([special("plus"), special("plus"), num(3, "amarelo")]);
  let r = flip(s, rng);
  assert.equal(r.event.kind, "plus");
  assert.equal(r.state.turn, 0);
  r = flip(r.state, rng);
  assert.equal(r.state.turn, 0);
  r = flip(r.state, rng);
  assert.equal(r.event.kind, "fill");
  assert.equal(r.state.players[0].cells[2], "amarelo");
  assert.equal(r.state.turn, 1);
  s = r.state;
  assert.equal(s.flips, 3);
});

test("preta: espera a cor, e so a cor escolhida conta pro adversario", () => {
  let r = flip(stateWith([special("wild"), num(4, "azul"), num(1, "verde"), num(4, "verde")]), rng);
  assert.equal(r.event.kind, "wild");
  assert.equal(r.state.pendingWild, true);
  assert.equal(r.state.turn, 0);
  assert.equal(flip(r.state, rng).event.kind, "invalid");
  let s = chooseColor(r.state, "verde");
  assert.equal(s.turn, 1);
  assert.equal(s.players[1].required, "verde");
  // adversario vira azul: nao conta e gasta a exigencia
  r = flip(s, rng);
  assert.equal(r.event.kind, "wrong-color");
  assert.equal(filledCount(r.state.players[1]), 0);
  assert.equal(r.state.players[1].required, null);
  s = flip(r.state, rng).state; // jogador 0 preenche o 1
  r = flip(s, rng);
  assert.equal(r.event.kind, "fill");
  assert.equal(r.state.players[1].cells[3], "verde");
});

test("preta: cor certa preenche normalmente", () => {
  let s = chooseColor(flip(stateWith([special("wild"), num(7, "vermelho")]), rng).state, "vermelho");
  const r = flip(s, rng);
  assert.equal(r.event.kind, "fill");
  assert.equal(r.state.players[1].cells[6], "vermelho");
  s = r.state;
  assert.equal(s.players[1].required, null);
});

test("especial nao gasta a cor exigida", () => {
  let s = chooseColor(flip(stateWith([special("wild"), special("plus"), special("block"), num(9, "azul"), num(2, "azul")]), rng).state, "amarelo");
  s = flip(s, rng).state; // +1, continua o jogador 1
  assert.equal(s.turn, 1);
  assert.equal(s.players[1].required, "amarelo");
  s = flip(s, rng).state; // bloqueio, passa
  assert.equal(s.turn, 0);
  assert.equal(s.players[1].required, "amarelo");
  s = flip(s, rng).state; // jogador 0 preenche o 9
  const r = flip(s, rng); // jogador 1 vira 2 azul com amarelo exigido
  assert.equal(r.event.kind, "wrong-color");
});

test("completar os 9 vence na hora", () => {
  const base = stateWith([num(9, "verde")]);
  const almost: GameState = {
    ...base,
    players: [{ ...base.players[0], cells: ["azul", "azul", "azul", "azul", "azul", "azul", "azul", "azul", null] }, base.players[1]],
  };
  const r = flip(almost, rng);
  assert.equal(r.event.kind, "fill");
  assert.ok(r.event.kind === "fill" && r.event.won);
  assert.equal(r.state.finished, true);
  assert.equal(r.state.winner, 0);
  assert.equal(flip(r.state, rng).event.kind, "invalid");
});

test("monte vazio embaralha o descarte", () => {
  const s: GameState = { ...stateWith([]), discard: [num(0, "azul"), special("block")] };
  const r = flip(s, rng);
  assert.notEqual(r.event.kind, "invalid");
  assert.equal(r.state.draw.length + r.state.discard.length, 2);
});

test("jogador saiu: o outro vence", () => {
  const s = removePlayer(createGame(2, rng), 1);
  assert.equal(s.finished, true);
  assert.equal(s.winner, 0);
});

test("partidas aleatorias sempre terminam", () => {
  const lengths: number[] = [];
  for (let seed = 1; seed <= 300; seed++) {
    const r = mulberry32(seed);
    let s = createGame(2, r);
    while (!s.finished) {
      if (s.pendingWild) s = chooseColor(s, COLORS[Math.floor(r() * 4)]);
      else s = flip(s, r).state;
      assert.ok(s.flips < 2000, `seed ${seed} nao termina`);
    }
    assert.equal(filledCount(s.players[s.winner!]), 9);
    lengths.push(s.flips);
  }
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  console.log(`  media ${avg.toFixed(1)} viradas por partida (min ${Math.min(...lengths)}, max ${Math.max(...lengths)})`);
});

test("copia do servidor e identica", async () => {
  const { readFile } = await import("node:fs/promises");
  const web = await readFile(new URL("./engine.ts", import.meta.url), "utf8");
  const server = await readFile(new URL("../../../server/src/carteadoEngine.ts", import.meta.url), "utf8");
  assert.equal(server, web);
});
