import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldLog, DEDUPE_MS } from "./activityDedupe.ts";

const T0 = 1_760_000_000_000;

test("primeira chamada registra e guarda o horario", () => {
  const r = shouldLog(null, "hub", T0);
  assert.equal(r.log, true);
  assert.deepEqual(JSON.parse(r.next), { hub: T0 });
});

test("dentro de 10 minutos nao registra de novo", () => {
  const first = shouldLog(null, "hub", T0);
  const r = shouldLog(first.next, "hub", T0 + DEDUPE_MS - 1);
  assert.equal(r.log, false);
});

test("depois de 10 minutos registra de novo", () => {
  const first = shouldLog(null, "hub", T0);
  assert.equal(shouldLog(first.next, "hub", T0 + DEDUPE_MS).log, true);
});

test("jogos diferentes nao se bloqueiam", () => {
  const first = shouldLog(null, "hub", T0);
  const r = shouldLog(first.next, "termo", T0 + 1000);
  assert.equal(r.log, true);
  assert.deepEqual(JSON.parse(r.next), { hub: T0, termo: T0 + 1000 });
});

test("valor corrompido no storage e tratado como vazio", () => {
  for (const bad of ["{", "null", "[]", '"x"', '{"hub":"ontem"}']) {
    assert.equal(shouldLog(bad, "hub", T0).log, true, bad);
  }
});

test("relogio que voltou no tempo registra", () => {
  const first = shouldLog(null, "hub", T0);
  assert.equal(shouldLog(first.next, "hub", T0 - 60_000).log, true);
});
