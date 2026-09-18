// Para regenerar: baixe palavras_raw.txt primeiro:
//   curl -sL https://raw.githubusercontent.com/pythonprobr/palavras/master/palavras.txt -o server/src/palavras_raw.txt
// depois: npx tsx src/build-dictionary.ts
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const OFFENSIVE_WORDS = new Set([
  "buceta", "caceta", "cacete", "cralho", "piroca", "punheta", "corno",
  "putao", "putas", "veado", "bicha", "baitola", "escrota", "escroto",
  "fdp", "otaria", "otario", "viado", "xoxota", "arrombado", "arrombada",
  "babaca", "idiota", "estupro", "retardado", "retardada", "negrofobico",
  "pinto", "pinta", "penis", "vulva", "anus", "cu", "cus", "seios",
  "vagina", "testiculo", "anais", "xibiu", "bunda",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const raw = readFileSync(join(__dirname, "palavras_raw.txt"), "utf-8");
const lines = raw.split("\n").map((l) => l.trim().toLowerCase());

const seen = new Set<string>();
const result: string[] = [];

for (const line of lines) {
  if (!line) continue;
  if (OFFENSIVE_WORDS.has(line)) continue;
  const normalized = stripAccents(line).toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) continue; // remove hifenizadas, com números, etc
  if (normalized.length < 3 || normalized.length > 15) continue;
  if (seen.has(normalized)) continue;
  seen.add(normalized);
  result.push(normalized);
}

result.sort();

const output = `// Gerado a partir de pythonprobr/palavras (MPL-2.0): https://github.com/pythonprobr/palavras
// Ver server/src/build-dictionary.ts para regenerar.
export const DICTIONARY: string[] = ${JSON.stringify(result)};
`;

writeFileSync(join(__dirname, "dictionary.ts"), output, "utf-8");
console.log(`Geradas ${result.length} palavras em dictionary.ts`);
