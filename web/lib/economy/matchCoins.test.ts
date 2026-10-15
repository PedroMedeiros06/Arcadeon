import { test } from "node:test";
import assert from "node:assert/strict";
import { matchCoinsLabel } from "./matchCoins.ts";

test("moedas ganhas", () => {
  assert.equal(matchCoinsLabel(15, false), "+15 moedas");
  assert.equal(matchCoinsLabel(1, false), "+1 moeda");
});

test("limite cortou parte do pagamento", () => {
  assert.equal(matchCoinsLabel(5, true), "+5 moedas, limite de hoje atingido");
});

test("limite cortou tudo", () => {
  assert.equal(matchCoinsLabel(0, true), "Limite de moedas de hoje atingido");
});

test("partida sem pagamento nao mostra nada", () => {
  assert.equal(matchCoinsLabel(0, false), null);
  assert.equal(matchCoinsLabel(-3, false), null);
  assert.equal(matchCoinsLabel(Number.NaN, false), null);
});
