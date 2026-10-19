import { test } from "node:test";
import assert from "node:assert/strict";
import { onlineCues, type CueSnapshot } from "./soundCues.ts";

const base: CueSnapshot = {
  phase: "playing",
  flippedCount: 0,
  turnSocketId: "me",
  lastEvent: null,
  swapSeq: 0,
  myPlace: 0,
};
const snap = (over: Partial<CueSnapshot>): CueSnapshot => ({ ...base, ...over });

test("virar carta toca flip", () => {
  assert.deepEqual(onlineCues(base, snap({ flippedCount: 1 }), "me"), { now: ["flip"], afterFlipBack: [] });
});

test("par normal, coringa e erro", () => {
  const match = snap({ flippedCount: 0, lastEvent: { seq: 1, kind: "match", points: 1 } });
  assert.deepEqual(onlineCues(snap({ flippedCount: 1 }), match, "me").now, ["flip", "match"]);
  const coringa = snap({ lastEvent: { seq: 1, kind: "match", points: 3 } });
  assert.deepEqual(onlineCues(snap({ flippedCount: 1 }), coringa, "me").now, ["flip", "coringa"]);
  const miss = snap({ flippedCount: 2, lastEvent: { seq: 1, kind: "miss" } });
  assert.deepEqual(onlineCues(snap({ flippedCount: 1 }), miss, "me").now, ["flip", "miss"]);
});

test("evento repetido (mesmo seq) nao toca de novo", () => {
  const s = snap({ lastEvent: { seq: 4, kind: "match", points: 1 } });
  assert.deepEqual(onlineCues(s, s, "me").now, []);
});

test("vez passa pra mim toca yourTurn; troca do tabuleiro espera a virada", () => {
  const prev = snap({ turnSocketId: "other", flippedCount: 2 });
  const next = snap({ turnSocketId: "me", flippedCount: 0, swapSeq: 1 });
  assert.deepEqual(onlineCues(prev, next, "me"), { now: ["yourTurn"], afterFlipBack: ["swap"] });
});

test("tempo esgotado e fases", () => {
  assert.deepEqual(onlineCues(base, snap({ turnSocketId: "other", lastEvent: { seq: 2, kind: "timeout" } }), "me").now, ["timeout"]);
  assert.deepEqual(onlineCues(snap({ phase: "lobby" }), snap({ phase: "countdown", turnSocketId: null }), "me").now, ["dial"]);
  assert.deepEqual(onlineCues(base, snap({ phase: "results", turnSocketId: null, myPlace: 1 }), "me").now, ["open", "win"]);
  assert.deepEqual(onlineCues(base, snap({ phase: "results", turnSocketId: null, myPlace: 2 }), "me").now, ["open", "lose"]);
});

test("primeiro snapshot nao toca nada", () => {
  assert.deepEqual(onlineCues(null, base, "me"), { now: [], afterFlipBack: [] });
});
