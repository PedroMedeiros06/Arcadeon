import { test } from "node:test";
import assert from "node:assert/strict";
import { createStatusStore } from "./statusStore.ts";

const lobby = { state: "online" as const, place: "lobby" as const, game: "drawit", roomCode: "K7M2Q", players: 3, maxPlayers: 8 };

test("avisa quem escuta quando o status muda", () => {
  const store = createStatusStore();
  const seen: (string | null)[] = [];
  const off = store.subscribe(() => seen.push(store.get()?.place ?? null));
  store.set(lobby);
  store.set({ ...lobby, state: "playing", place: "match" });
  off();
  store.set({ ...lobby, place: "hub" });
  assert.deepEqual(seen, ["lobby", "match"]);
});

test("limpar apaga o status de quem saiu da conta", () => {
  const store = createStatusStore();
  store.set(lobby);
  store.clear();
  assert.equal(store.get(), null);
});
