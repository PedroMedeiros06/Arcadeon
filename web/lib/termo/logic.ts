// Regras puras do Termo (sem React). O Diario e avaliado no servidor (supabase termo_daily_guess);
// estas funcoes rodam o modo Infinito e montam tabuleiro/teclado a partir de palpites + cores.

export const WORD_LENGTH = 5;
export type BoardCount = 1 | 2 | 4;
export type PlayMode = "daily" | "infinite";
export type LetterState = "correct" | "present" | "absent" | "empty";

export interface Cell {
  letter: string;
  state: LetterState;
}

export const MODES: { count: BoardCount; label: string }[] = [
  { count: 1, label: "Letrado" },
  { count: 2, label: "Duplo" },
  { count: 4, label: "Quádruplo" },
];

export function maxAttemptsFor(boardCount: BoardCount) {
  return boardCount + 5;
}

export function modeLabel(boardCount: BoardCount) {
  return MODES.find((m) => m.count === boardCount)?.label ?? "Letrado";
}

const OFFENSIVE_WORDS = new Set([
  "buceta", "caceta", "cacete", "cralho", "piroca", "punheta", "corno", "putao", "putas", "veado",
  "bicha", "baitola", "escrota", "escroto", "fdp", "otaria", "otario", "viado", "xoxota", "arrombado",
  "arrombada", "babaca", "idiota", "estupro", "retardado", "retardada", "negrofobico", "pinto", "pinta",
  "penis", "vulva", "anus", "cu", "cus", "seios", "vagina", "testiculo", "anais", "xibiu", "bunda",
]);

/** Le uma lista de palavras (uma por linha), tirando ofensivas e tamanhos errados. */
export function parseWordList(text: string): string[] {
  return text
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length === WORD_LENGTH && !OFFENSIVE_WORDS.has(w));
}

export function evaluateGuess(guess: string, target: string): LetterState[] {
  const result: LetterState[] = Array(WORD_LENGTH).fill("absent");
  const letterCount: Record<string, number> = {};

  for (const letter of target) {
    letterCount[letter] = (letterCount[letter] ?? 0) + 1;
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
      letterCount[guess[i]]--;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "absent" && letterCount[guess[i]] > 0) {
      result[i] = "present";
      letterCount[guess[i]]--;
    }
  }

  return result;
}

const CODE_TO_STATE: Record<string, LetterState> = { C: "correct", P: "present", A: "absent" };

/** Converte o formato do servidor ("CPAAC") em estados. */
export function codeToStates(code: string): LetterState[] {
  return code.split("").map((c) => CODE_TO_STATE[c] ?? "absent");
}

// Recusa combinar palavras muito parecidas (ex: JOIAS/JOGAS/JOVAS), pra evitar tabuleiros de
// Duplo/Quádruplo onde uma dica resolve varias palavras de uma vez. Mesma regra do servidor.
const MAX_SHARED_LETTERS = 1;
const MAX_SAME_POSITION = 0;

function sharedLetterCount(a: string, b: string): number {
  const setB = new Set(b);
  let shared = 0;
  for (const letter of new Set(a)) {
    if (setB.has(letter)) shared++;
  }
  return shared;
}

function samePositionCount(a: string, b: string): number {
  let same = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) same++;
  }
  return same;
}

function tooSimilarToAny(candidate: string, chosen: string[]): boolean {
  return chosen.some(
    (w) => sharedLetterCount(candidate, w) > MAX_SHARED_LETTERS || samePositionCount(candidate, w) > MAX_SAME_POSITION,
  );
}

export function pickRandomWords(pool: string[], boardCount: BoardCount): string[] {
  const words: string[] = [];
  let skippedForSimilarity = 0;
  const maxSkips = pool.length * 4;

  while (words.length < boardCount) {
    const w = pool[Math.floor(Math.random() * pool.length)];
    if (words.includes(w)) continue;

    // valvula de escape: depois de muitas tentativas aceita palavra parecida pra nao travar
    if (skippedForSimilarity < maxSkips && tooSimilarToAny(w, words)) {
      skippedForSimilarity++;
      continue;
    }
    words.push(w);
  }
  return words;
}

function isSolvedRow(states: LetterState[]) {
  return states.every((s) => s === "correct");
}

/**
 * Linhas de um tabuleiro. `evals[g][b]` = estados do palpite g no tabuleiro b.
 * Depois de resolvido, o tabuleiro para de receber linhas.
 */
export function buildBoardRows(guesses: string[], evals: LetterState[][][], boardIndex: number) {
  const rows: Cell[][] = [];
  let solved = false;
  for (let g = 0; g < guesses.length && !solved; g++) {
    const states = evals[g]?.[boardIndex];
    if (!states) break;
    rows.push(guesses[g].split("").map((letter, i) => ({ letter, state: states[i] })));
    solved = isSolvedRow(states);
  }
  return { rows, solved };
}

const STATE_PRIORITY: Record<LetterState, number> = { correct: 3, present: 2, absent: 1, empty: 0 };

/** Estado de cada tecla por tabuleiro (a tecla e desenhada dividida em Duplo/Quádruplo). */
export function computeKeyStates(
  guesses: string[],
  evals: LetterState[][][],
  boardCount: number,
): Record<string, LetterState[]> {
  const store: Record<string, LetterState[]> = {};
  guesses.forEach((guess, g) => {
    evals[g]?.forEach((states, b) => {
      for (let i = 0; i < WORD_LENGTH; i++) {
        const letter = guess[i];
        const arr = (store[letter] ??= Array(boardCount).fill("empty"));
        if (STATE_PRIORITY[states[i]] > STATE_PRIORITY[arr[b]]) arr[b] = states[i];
      }
    });
  });
  return store;
}

const STATE_EMOJI: Record<LetterState, string> = { correct: "🟩", present: "🟨", absent: "⬛", empty: "⬜" };
// modo daltonico usa laranja/azul (mesma troca do Wordle)
const STATE_EMOJI_CB: Record<LetterState, string> = { correct: "🟧", present: "🟦", absent: "⬛", empty: "⬜" };

export function stateEmoji(state: LetterState, colorblind = false) {
  return (colorblind ? STATE_EMOJI_CB : STATE_EMOJI)[state];
}

export function buildShareText(opts: {
  boardCount: BoardCount;
  mode: PlayMode | "challenge";
  playDate: string | null;
  guesses: string[];
  evals: LetterState[][][];
  won: boolean;
  url: string;
  hard?: boolean;
  hintsUsed?: number;
  colorblind?: boolean;
}): string {
  const { boardCount, mode, playDate, guesses, evals, won, url, hard, hintsUsed, colorblind } = opts;
  const score = `${won ? guesses.length : "X"}/${maxAttemptsFor(boardCount)}${hard ? "*" : ""}`;
  const date = playDate ? ` ${playDate.split("-").reverse().slice(0, 2).join("/")}` : "";
  const name = boardCount === 1 ? "Letrado" : `Letrado ${modeLabel(boardCount)}`;
  const when = mode === "daily" ? date : mode === "challenge" ? " (desafio)" : " (infinito)";
  const extras = [hard ? "modo difícil" : "", hintsUsed ? `${hintsUsed} dica${hintsUsed > 1 ? "s" : ""}` : ""]
    .filter(Boolean)
    .join(" · ");
  const title = `${name}${when} ${score}${extras ? `\n${extras}` : ""}`;

  const blocks = Array.from({ length: boardCount }, (_, b) =>
    buildBoardRows(guesses, evals, b)
      .rows.map((row) => row.map((c) => stateEmoji(c.state, colorblind)).join(""))
      .join("\n"),
  );
  return `${title}\n\n${blocks.join("\n\n")}\n\n${url}`;
}

/**
 * Modo dificil: cada palpite precisa usar o que ja foi descoberto no tabuleiro 1
 * (verde no mesmo lugar, amarelo em algum lugar). Mesma regra do servidor. Devolve a mensagem ou null.
 */
export function hardModeViolation(guesses: string[], evals: LetterState[][][], guess: string): string | null {
  for (let g = 0; g < guesses.length; g++) {
    const prev = guesses[g];
    const states = evals[g]?.[0];
    if (!states) continue;
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (states[i] === "correct" && guess[i] !== prev[i]) {
        return `A ${i + 1}ª letra deve ser ${prev[i].toUpperCase()}`;
      }
    }
    for (const letter of new Set(prev)) {
      let need = 0;
      for (let i = 0; i < WORD_LENGTH; i++) {
        if (prev[i] === letter && (states[i] === "correct" || states[i] === "present")) need++;
      }
      const have = guess.split("").filter((c) => c === letter).length;
      if (have < need) return `A palavra deve conter ${letter.toUpperCase()}`;
    }
  }
  return null;
}

/** Padrao de cores como texto ("CPAAC"), usado pra agrupar palavras que dariam a mesma resposta. */
export function patternOf(guess: string, target: string): string {
  return evaluateGuess(guess, target)
    .map((s) => (s === "correct" ? "C" : s === "present" ? "P" : "A"))
    .join("");
}

/**
 * Modo Vilao (estilo Absurdle): o jogo nao escolhe palavra; a cada palpite responde com o padrao que
 * deixa mais palavras possiveis. Empate: o padrao que revela menos (menos verdes, depois menos amarelos).
 */
export function villainStep(candidates: string[], guess: string): { pattern: string; remaining: string[] } {
  const buckets = new Map<string, string[]>();
  for (const word of candidates) {
    const p = patternOf(guess, word);
    const list = buckets.get(p);
    if (list) list.push(word);
    else buckets.set(p, [word]);
  }
  const reveal = (p: string) => [...p].reduce((n, c) => n + (c === "C" ? 10 : c === "P" ? 1 : 0), 0);
  let best: [string, string[]] | null = null;
  for (const entry of buckets) {
    if (
      !best ||
      entry[1].length > best[1].length ||
      (entry[1].length === best[1].length && reveal(entry[0]) < reveal(best[0]))
    ) {
      best = entry;
    }
  }
  return { pattern: best![0], remaining: best![1] };
}

// Desafio: palavras vao no link embaralhadas (nao e seguranca, so pra nao aparecerem a olho nu)
const CHALLENGE_KEY = "letrado";

export interface Challenge {
  words: string[];
  attempts: number | null;
  timeSeconds: number | null;
  name: string | null;
}

function xor(text: string) {
  return [...text].map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ CHALLENGE_KEY.charCodeAt(i % CHALLENGE_KEY.length))).join("");
}

export function encodeChallenge(c: Challenge): string {
  const raw = JSON.stringify({ w: c.words, a: c.attempts, t: c.timeSeconds, n: c.name });
  const b64 = btoa(unescape(encodeURIComponent(xor(raw))));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeChallenge(code: string, pool: Set<string>): Challenge | null {
  try {
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const raw = xor(decodeURIComponent(escape(atob(b64))));
    const data = JSON.parse(raw) as { w: unknown; a: unknown; t: unknown; n: unknown };
    const words = Array.isArray(data.w) ? data.w.filter((w): w is string => typeof w === "string" && pool.has(w)) : [];
    if (![1, 2, 4].includes(words.length)) return null;
    return {
      words,
      attempts: typeof data.a === "number" ? data.a : null,
      timeSeconds: typeof data.t === "number" ? data.t : null,
      name: typeof data.n === "string" ? data.n.slice(0, 30) : null,
    };
  } catch {
    return null;
  }
}

/** Palavra com acento pra exibir (SAUDE -> SAÚDE). O jogo compara sempre sem acento. */
export function withAccents(word: string, accents: Record<string, string>): string {
  return accents[word] ?? word;
}
