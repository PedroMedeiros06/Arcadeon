import { test } from "node:test";
import assert from "node:assert/strict";
import { missionDone, missionPercent, missionsDoneCount, parseMissions } from "./missions.ts";

const mission = {
  id: "m1",
  game: "drawit",
  kind: "draw_correct_guess",
  text: "Acerte 5 desenhos no Rabiscado",
  target: 5,
  progress: 2,
  reward: 15,
  completed_at: null,
};
const raw = { day: "2026-10-14", missions: [mission], chest: { reward: 30, claimed: false } };

test("le o formato do servidor", () => {
  assert.deepEqual(parseMissions(raw), {
    day: "2026-10-14",
    missions: [
      { id: "m1", game: "drawit", text: "Acerte 5 desenhos no Rabiscado", target: 5, progress: 2, reward: 15, completedAt: null },
    ],
    chest: { reward: 30, claimed: false },
  });
});

test("sem lista ou sem missao valida vira null", () => {
  assert.equal(parseMissions(null), null);
  assert.equal(parseMissions({ day: "2026-10-14" }), null);
  assert.equal(parseMissions({ ...raw, missions: [] }), null);
  assert.equal(parseMissions({ ...raw, missions: [{ ...mission, target: 0 }] }), null);
});

test("missao invalida e descartada, as outras ficam", () => {
  const d = parseMissions({ ...raw, missions: [{ ...mission, text: 3 }, { ...mission, id: "m2" }] });
  assert.deepEqual(d?.missions.map((m) => m.id), ["m2"]);
});

test("jogo desconhecido ou nulo vira null", () => {
  assert.equal(parseMissions({ ...raw, missions: [{ ...mission, game: null }] })?.missions[0].game, null);
  assert.equal(parseMissions({ ...raw, missions: [{ ...mission, game: "xadrez" }] })?.missions[0].game, null);
});

test("sem bau no retorno vira bau zerado e fechado", () => {
  assert.deepEqual(parseMissions({ ...raw, chest: undefined })?.chest, { reward: 0, claimed: false });
});

test("barra nunca passa de 100", () => {
  const d = parseMissions({ ...raw, missions: [{ ...mission, progress: 9 }] })!;
  assert.equal(missionPercent(d.missions[0]), 100);
  assert.equal(missionDone(d.missions[0]), true);
});

test("porcentagem arredondada e progresso negativo vira zero", () => {
  const d = parseMissions({ ...raw, missions: [{ ...mission, target: 3, progress: 1 }, { ...mission, id: "m2", progress: -4 }] })!;
  assert.equal(missionPercent(d.missions[0]), 33);
  assert.equal(missionPercent(d.missions[1]), 0);
});

test("completed_at conta como feita mesmo com progresso baixo", () => {
  const d = parseMissions({
    ...raw,
    missions: [{ ...mission, completed_at: "2026-10-14T20:00:00Z" }, { ...mission, id: "m2" }],
  })!;
  assert.equal(missionsDoneCount(d), 1);
  assert.equal(missionPercent(d.missions[0]), 100);
});
