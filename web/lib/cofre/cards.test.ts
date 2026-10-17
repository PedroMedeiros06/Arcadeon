import { existsSync } from "node:fs";
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
  }
  assert.equal(new Set([...LOOT_FACES].map((id) => cardArt(id).emoji)).size, LOOT_FACES.length);
  assert.equal(CARD_BACK_SRC, "/games/cofre/cards/back.webp");
});

// src so aponta pra arquivo que existe; carta sem arte cai no emoji sem gerar 404
test("cardArt so tem src quando a arte existe em public/", () => {
  for (const id of [...LOOT_FACES, CORINGA]) {
    const file = new URL(`../../public/games/cofre/cards/${id}.webp`, import.meta.url);
    assert.equal(cardArt(id).src, existsSync(file) ? `/games/cofre/cards/${id}.webp` : null, id);
  }
  assert.ok(existsSync(new URL("../../public" + CARD_BACK_SRC, import.meta.url)));
});
