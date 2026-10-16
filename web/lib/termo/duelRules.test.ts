import { test } from "node:test";
import assert from "node:assert/strict";
import { boardScores, normalizeDuelCode, opponentAway, parseDuelState, solvedCount } from "./duelRules.ts";

const NOW = Date.parse("2026-10-15T21:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const player = (over: Record<string, unknown> = {}) => ({
  user_id: "u1",
  username: "raposa",
  avatar: { emoji: "🦊", bg_color: "#fff", image_url: null },
  guesses: ["zzzzz"],
  patterns: [["AAAAA", "CPAAA"]],
  finished_at: null,
  score: null,
  last_seen_at: iso(NOW),
  ...over,
});

const raw = (over: Record<string, unknown> = {}) => ({
  id: "d1",
  code: "K7M2Q",
  board_count: 2,
  max_attempts: 7,
  status: "playing",
  host_id: "u1",
  guest_id: "u2",
  started_at: iso(NOW - 10_000),
  finished_at: null,
  winner_id: null,
  end_reason: null,
  now: iso(NOW + 2_000),
  me: player(),
  opponent: player({ user_id: "u2", username: "coruja", guesses: null }),
  words: null,
  ...over,
});

test("le o estado do duelo", () => {
  const s = parseDuelState(raw(), NOW)!;
  assert.equal(s.boardCount, 2);
  assert.equal(s.status, "playing");
  assert.equal(s.serverOffset, 2_000);
  assert.deepEqual(s.me.guesses, ["zzzzz"]);
  assert.deepEqual(s.me.patterns, [["AAAAA", "CPAAA"]]);
  assert.equal(s.opponent!.guesses, null);
  assert.equal(s.opponent!.username, "coruja");
  assert.equal(s.me.avatar.emoji, "🦊");
});

test("sala de espera sem rival", () => {
  const s = parseDuelState(raw({ status: "waiting", guest_id: null, opponent: null, started_at: null }), NOW)!;
  assert.equal(s.opponent, null);
  assert.equal(s.startedAt, null);
});

test("recusa estado quebrado", () => {
  assert.equal(parseDuelState(null, NOW), null);
  assert.equal(parseDuelState(raw({ board_count: 3 }), NOW), null);
  assert.equal(parseDuelState(raw({ code: "OOOOO" }), NOW), null);
  assert.equal(parseDuelState(raw({ status: "x" }), NOW), null);
  // cores com a quantidade errada de tabuleiros
  assert.equal(parseDuelState(raw({ me: player({ patterns: [["AAAAA"]] }) }), NOW), null);
  // palpites e cores com tamanhos diferentes
  assert.equal(parseDuelState(raw({ me: player({ guesses: [] }) }), NOW), null);
  // eu sempre recebo as minhas letras
  assert.equal(parseDuelState(raw({ me: player({ guesses: null }) }), NOW), null);
});

test("pontuacao: resolvido vale 10, senao a melhor linha", () => {
  const rows = [
    ["CPAAA", "AAAAA"],
    ["CCCCC", "PPAAA"],
    ["AAAAA", "CAAAA"],
  ];
  assert.deepEqual(boardScores(rows, 2), [10, 2]);
  assert.deepEqual(boardScores([], 2), [0, 0]);
  assert.equal(solvedCount(rows, 2), 1);
});

test("rival ausente usa a hora do banco", () => {
  const s = parseDuelState(raw({ opponent: player({ user_id: "u2", guesses: null, last_seen_at: iso(NOW - 59_000) }) }), NOW)!;
  // banco esta 2 s adiantado: 59 s + 2 s = 61 s sem sinal
  assert.equal(opponentAway(s, NOW), true);
  const t = parseDuelState(raw({ now: iso(NOW), opponent: player({ user_id: "u2", guesses: null, last_seen_at: iso(NOW - 59_000) }) }), NOW)!;
  assert.equal(opponentAway(t, NOW), false);
});

test("codigo digitado ou link colado", () => {
  assert.equal(normalizeDuelCode(" k7m2q "), "K7M2Q");
  assert.equal(normalizeDuelCode("https://arcadeon.app/games/termo?join=K7M2Q"), "K7M2Q");
  assert.equal(normalizeDuelCode("K7M2"), null);
  assert.equal(normalizeDuelCode("OOOOO"), null);
});
