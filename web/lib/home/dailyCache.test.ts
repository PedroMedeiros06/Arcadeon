import { test } from "node:test";
import assert from "node:assert/strict";
import { createOnce } from "./dailyCache.ts";

test("chamadas simultaneas dividem uma requisicao", async () => {
  let calls = 0;
  const get = createOnce(async () => ++calls);
  const [a, b] = await Promise.all([get("u1"), get("u1")]);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(calls, 1);
});

test("depois de resolver, a proxima chamada busca de novo", async () => {
  let calls = 0;
  const get = createOnce(async () => ++calls);
  await get("u1");
  assert.equal(await get("u1"), 2);
});

test("chave nova (login ou logout) nao reaproveita a busca em andamento", async () => {
  let calls = 0;
  const get = createOnce(async () => ++calls);
  const [a, b] = await Promise.all([get("anon"), get("u1")]);
  assert.equal(a, 1);
  assert.equal(b, 2);
});

test("falha nao fica presa", async () => {
  let calls = 0;
  const get = createOnce(async () => {
    calls++;
    if (calls === 1) throw new Error("rede");
    return calls;
  });
  await assert.rejects(get("u1"));
  assert.equal(await get("u1"), 2);
});
