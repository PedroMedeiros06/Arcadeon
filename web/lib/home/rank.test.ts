import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFor } from "./rank.ts";

const rows = [{ username: "Bia" }, { username: "caio" }, { username: "Duda" }];

test("posicao comeca em 1", () => {
  assert.equal(rankFor(rows, "Bia"), 1);
  assert.equal(rankFor(rows, "Duda"), 3);
});

test("fora da lista ou deslogado vira null", () => {
  assert.equal(rankFor(rows, "zeca"), null);
  assert.equal(rankFor(rows, null), null);
  assert.equal(rankFor([], "Bia"), null);
});

test("compara sem diferenciar maiusculas", () => {
  assert.equal(rankFor(rows, "CAIO"), 2);
});
