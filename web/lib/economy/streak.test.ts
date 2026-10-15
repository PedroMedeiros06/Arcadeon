import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STREAK_REWARDS, parseStreak, streakHint, streakSlots, todayReward } from "./streak.ts";

const base = { streak: 4, best_streak: 9, counted_today: true, cycle_day: 4, claimed_today: false, rewards: [10, 10, 15, 15, 20, 25, 50] };

test("le o formato do servidor", () => {
  assert.deepEqual(parseStreak(base), {
    streak: 4,
    bestStreak: 9,
    countedToday: true,
    cycleDay: 4,
    claimedToday: false,
    rewards: [10, 10, 15, 15, 20, 25, 50],
  });
});

test("retorno em lista (returns table) usa a primeira linha", () => {
  assert.equal(parseStreak([base])?.cycleDay, 4);
  assert.equal(parseStreak([]), null);
});

test("formato inesperado vira null", () => {
  assert.equal(parseStreak(null), null);
  assert.equal(parseStreak("x"), null);
  assert.equal(parseStreak({ ...base, streak: "4" }), null);
  assert.equal(parseStreak({ ...base, cycle_day: 0 }), null);
  assert.equal(parseStreak({ ...base, cycle_day: 8 }), null);
  assert.equal(parseStreak({ ...base, streak: -1 }), null);
});

test("recompensas fora do formato usam as do spec", () => {
  assert.deepEqual(parseStreak({ ...base, rewards: [10, 10] })?.rewards, DEFAULT_STREAK_REWARDS);
  assert.deepEqual(parseStreak({ ...base, rewards: undefined })?.rewards, DEFAULT_STREAK_REWARDS);
  assert.deepEqual(parseStreak({ ...base, rewards: [1, 2, 3, 4, 5, 6, "7"] })?.rewards, DEFAULT_STREAK_REWARDS);
});

test("resgatado implica dia contado e o recorde nunca fica abaixo da sequencia", () => {
  const s = parseStreak({ ...base, counted_today: false, claimed_today: true, best_streak: 2 });
  assert.equal(s?.countedToday, true);
  assert.equal(s?.bestStreak, 4);
});

test("dia contado e nao resgatado fica resgatavel", () => {
  const states = streakSlots(parseStreak(base)!).map((d) => d.state);
  assert.deepEqual(states, ["done", "done", "done", "claimable", "upcoming", "upcoming", "upcoming"]);
});

test("dia ainda nao contado fica esperando", () => {
  const states = streakSlots(parseStreak({ ...base, counted_today: false })!).map((d) => d.state);
  assert.deepEqual(states, ["done", "done", "done", "waiting", "upcoming", "upcoming", "upcoming"]);
});

test("sequencia quebrada nao mostra dia feito", () => {
  const states = streakSlots(parseStreak({ ...base, streak: 0, counted_today: false, cycle_day: 1 })!).map((d) => d.state);
  assert.deepEqual(states, ["waiting", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"]);
});

test("setimo dia contado libera o bau", () => {
  const s = parseStreak({ ...base, streak: 7, cycle_day: 7 })!;
  assert.equal(streakSlots(s)[6].state, "claimable");
  assert.equal(todayReward(s), 50);
});

test("dicas sem culpa", () => {
  assert.equal(streakHint(parseStreak({ ...base, counted_today: false })!), "Termine uma partida hoje pra contar o dia.");
  assert.equal(streakHint(parseStreak(base)!), "Resgate 15 moedas do dia 4.");
  assert.equal(streakHint(parseStreak({ ...base, claimed_today: true })!), "Volte amanhã pro dia 5.");
  assert.equal(
    streakHint(parseStreak({ ...base, streak: 7, cycle_day: 7, claimed_today: true })!),
    "Ciclo completo. Amanhã começa um novo.",
  );
});
