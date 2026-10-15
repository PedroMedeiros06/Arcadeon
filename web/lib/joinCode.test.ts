import { test } from "node:test";
import assert from "node:assert/strict";
import { joinTarget, normalizeCode } from "./joinCode.ts";

test("normaliza caixa, espacos e hifen", () => {
  assert.equal(normalizeCode(" ab c-de "), "ABCDE");
});

test("letras ambiguas nao existem no alfabeto das salas", () => {
  // o alfabeto nao tem O, 0, I nem 1
  assert.equal(normalizeCode("o0ib1"), null);
  assert.equal(normalizeCode("abcd2"), "ABCD2");
});

test("tamanho diferente de 5 e invalido", () => {
  assert.equal(normalizeCode("ABCD"), null);
  assert.equal(normalizeCode("ABCDEF"), null);
  assert.equal(normalizeCode(""), null);
});

test("um jogo leva direto", () => {
  assert.deepEqual(joinTarget("ABCDE", ["drawit"]), { kind: "go", href: "/games/drawit?join=ABCDE" });
});

test("mais de um jogo pede escolha", () => {
  const r = joinTarget("ABCDE", ["buggle", "corrida"]);
  assert.equal(r.kind, "choose");
  assert.deepEqual(r.kind === "choose" && r.options.map((o) => o.href), [
    "/games/buggle?join=ABCDE",
    "/games/corrida?join=ABCDE",
  ]);
});

test("nenhum jogo vira nao encontrada", () => {
  assert.deepEqual(joinTarget("ABCDE", []), { kind: "missing" });
});
