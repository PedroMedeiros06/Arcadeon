import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_BACK_SRC, cardArt } from "./cards.ts";
import { CORINGA, LOOT_FACES } from "./engine.ts";

test("cardArt cobre todas as faces", () => {
  for (const id of [...LOOT_FACES, CORINGA]) {
    const art = cardArt(id);
    assert.equal(art.id, id);
    assert.ok(art.label.length > 0, id);
    assert.ok(art.emoji.length > 0, id);
    assert.ok(art.src.endsWith(`/${id}.png`), id);
  }
  assert.equal(new Set([...LOOT_FACES].map((id) => cardArt(id).emoji)).size, LOOT_FACES.length);
  assert.equal(CARD_BACK_SRC, "/games/cofre/cards/back.png");
});
