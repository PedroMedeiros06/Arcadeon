import { test } from "node:test";
import assert from "node:assert/strict";
import { rpcErrorMessage } from "./errors.ts";

const FALLBACK = "Não deu pra resgatar agora. Tente de novo.";

test("mensagem da regra do servidor aparece", () => {
  assert.equal(
    rpcErrorMessage({ code: "P0001", message: "A recompensa de hoje já foi resgatada" }, FALLBACK),
    "A recompensa de hoje já foi resgatada",
  );
  assert.equal(rpcErrorMessage({ code: "22023", message: "Nome inválido" }, FALLBACK), "Nome inválido");
});

test("erro de rede ou de infraestrutura vira texto em portugues", () => {
  assert.equal(rpcErrorMessage({ code: "", message: "TypeError: Failed to fetch" }, FALLBACK), FALLBACK);
  assert.equal(rpcErrorMessage({ code: "PGRST202", message: "Could not find the function" }, FALLBACK), FALLBACK);
  assert.equal(rpcErrorMessage({ code: "42883", message: "function does not exist" }, FALLBACK), FALLBACK);
  assert.equal(rpcErrorMessage({ code: "P0001", message: "" }, FALLBACK), FALLBACK);
  assert.equal(rpcErrorMessage(null, FALLBACK), FALLBACK);
});
