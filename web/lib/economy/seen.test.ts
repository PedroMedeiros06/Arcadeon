import { test } from "node:test";
import assert from "node:assert/strict";
import { markSeen, wasSeen } from "./seen.ts";

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}
const broken = {
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("bloqueado");
  },
};

test("so mostra esqueleto depois de ver os cartoes uma vez", () => {
  const s = memory();
  assert.equal(wasSeen(s), false);
  markSeen(s);
  assert.equal(wasSeen(s), true);
});

test("storage ausente ou bloqueado nunca lanca", () => {
  assert.equal(wasSeen(null), false);
  assert.equal(wasSeen(broken), false);
  assert.doesNotThrow(() => markSeen(broken));
  assert.doesNotThrow(() => markSeen(null));
});
