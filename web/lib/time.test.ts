import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCountdown, msUntilBrasiliaMidnight } from "./time.ts";

const H = 3_600_000;
const M = 60_000;

test("meia-noite de Brasilia e 03:00 UTC", () => {
  // 2026-10-14 02:00 UTC = 23:00 em Brasilia: falta 1 h
  assert.equal(msUntilBrasiliaMidnight(Date.UTC(2026, 9, 14, 2, 0)), H);
});

test("logo depois da virada falta quase um dia", () => {
  assert.equal(msUntilBrasiliaMidnight(Date.UTC(2026, 9, 14, 3, 0, 1)), 24 * H - 1000);
});

test("exatamente na virada conta o dia inteiro, nunca zero", () => {
  assert.equal(msUntilBrasiliaMidnight(Date.UTC(2026, 9, 14, 3, 0)), 24 * H);
});

test("nao depende do fuso do aparelho", () => {
  // o calculo usa so o timestamp; mesmo instante, mesma resposta em qualquer pais
  const t = Date.UTC(2026, 0, 1, 15, 30);
  assert.equal(msUntilBrasiliaMidnight(t), 11 * H + 30 * M);
});

test("formato curto", () => {
  assert.equal(formatCountdown(5 * H + 12 * M + 40_000), "5 h 12 min");
  assert.equal(formatCountdown(5 * H), "5 h");
  assert.equal(formatCountdown(12 * M + 59_000), "12 min");
  assert.equal(formatCountdown(30_000), "menos de 1 min");
  assert.equal(formatCountdown(-5), "menos de 1 min");
});
