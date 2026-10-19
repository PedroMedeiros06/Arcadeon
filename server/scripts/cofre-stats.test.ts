// npx tsx --test scripts/cofre-stats.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCofreRoom, joinCofreRoom, leaveCofreRoom, setCofrePlayerUser, startCofreGame } from "../src/cofreRooms";
import { cofreAccountResults } from "../src/cofreStats";

function roomWith(n: number) {
  const room = createCofreRoom("s0", { size: "4x4", maxPlayers: 8, turnSeconds: 0, movingBoard: false, coringa: false, peek: false }, "P0", null);
  for (let i = 1; i < n; i++) joinCofreRoom(room.code, `s${i}`, `P${i}`, null);
  startCofreGame(room);
  return room;
}

function setScores(room: ReturnType<typeof roomWith>, scores: { points: number; pairs: number; misses?: number }[]) {
  room.game = {
    ...room.game!,
    players: room.game!.players.map((p, i) => ({ ...p, points: scores[i].points, pairs: scores[i].pairs, misses: scores[i].misses ?? 0 })),
  };
}

test("anonimos ficam de fora; colocacao por pontos", () => {
  const room = roomWith(3);
  setCofrePlayerUser("s0", "u0");
  setCofrePlayerUser("s2", "u2");
  setScores(room, [{ points: 2, pairs: 2 }, { points: 5, pairs: 5 }, { points: 1, pairs: 1 }]);
  const res = cofreAccountResults(room).sort((a, b) => a.userId.localeCompare(b.userId));
  assert.deepEqual(res.map((r) => [r.userId, r.place, r.pairs, r.points]), [["u0", 2, 2, 2], ["u2", 3, 1, 1]]);
  for (const s of ["s0", "s1", "s2"]) leaveCofreRoom(s);
});

test("mesma conta em duas abas conta uma vez, com a melhor colocacao", () => {
  const room = roomWith(3);
  setCofrePlayerUser("s0", "u0");
  setCofrePlayerUser("s1", "u0");
  setCofrePlayerUser("s2", "u2");
  setScores(room, [{ points: 1, pairs: 1 }, { points: 4, pairs: 4 }, { points: 3, pairs: 3 }]);
  const res = cofreAccountResults(room);
  const u0 = res.find((r) => r.userId === "u0")!;
  assert.equal(res.length, 2);
  assert.equal(u0.place, 1);
  assert.equal(u0.points, 4);
  assert.deepEqual(u0.socketIds.sort(), ["s0", "s1"]);
  for (const s of ["s0", "s1", "s2"]) leaveCofreRoom(s);
});

test("quem saiu no meio nao entra", () => {
  const room = roomWith(3);
  setCofrePlayerUser("s0", "u0");
  setCofrePlayerUser("s1", "u1");
  setCofrePlayerUser("s2", "u2");
  leaveCofreRoom("s1");
  const res = cofreAccountResults(room);
  assert.deepEqual(res.map((r) => r.userId).sort(), ["u0", "u2"]);
  for (const s of ["s0", "s2"]) leaveCofreRoom(s);
});
