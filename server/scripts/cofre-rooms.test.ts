// npx tsx --test scripts/cofre-rooms.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAvatar } from "../src/cofreRooms";

test("aceita foto de perfil em /avatars (webp e png) e o formato antigo /icons", () => {
  assert.deepEqual(sanitizeAvatar({ emoji: "🐱", bgColor: "#A78BFA", imageUrl: "/avatars/gato-ninja.webp" }), {
    emoji: "🐱",
    bgColor: "#A78BFA",
    imageUrl: "/avatars/gato-ninja.webp",
  });
  assert.equal(sanitizeAvatar({ imageUrl: "/avatars/panda-mestre.png" })?.imageUrl, "/avatars/panda-mestre.png");
  assert.equal(sanitizeAvatar({ imageUrl: "/icons/robo.png" })?.imageUrl, "/icons/robo.png");
});

test("recusa caminho fora das pastas de avatar", () => {
  for (const imageUrl of ["https://evil.com/a.png", "/avatars/../secret.png", "//evil.com/a.png", "/avatars/a b.png", "/uploads/a.png"]) {
    assert.equal(sanitizeAvatar({ emoji: "🐱", imageUrl })?.imageUrl, null, imageUrl);
  }
  assert.equal(sanitizeAvatar({ imageUrl: "javascript:alert(1)" }), null);
});
