// Analise pos-jogo estilo WordleBot: a cada palpite, quantas respostas ainda eram possiveis e qual
// palpite teria cortado mais. Roda no navegador sobre a lista de respostas (words5_target.txt).
// Medida: "restantes esperadas" = soma(tamanho do grupo^2) / total, agrupando as candidatas pelo
// padrao de cores que o palpite daria. Quanto menor, melhor o palpite.

import { patternOf } from "./logic";

export interface GuessAnalysis {
  guess: string;
  /** respostas possiveis antes deste palpite */
  before: number;
  /** respostas possiveis depois do padrao que realmente saiu */
  after: number;
  /** restantes esperadas com o palpite do jogador */
  expected: number;
  /** melhor palpite que o bot achou e o esperado dele */
  botGuess: string;
  botExpected: number;
  /** 0 a 100: quao perto o palpite ficou do melhor do bot */
  score: number;
  /** palpite ja era a resposta */
  solved: boolean;
}

function expectedRemaining(guess: string, candidates: string[]): number {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    const p = patternOf(guess, c);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let sum = 0;
  for (const n of counts.values()) sum += n * n;
  return sum / candidates.length;
}

function bestGuess(candidates: string[], guessPool: string[]): { word: string; expected: number } {
  if (candidates.length <= 2) return { word: candidates[0], expected: 1 };
  let best = { word: candidates[0], expected: Infinity };
  // palpites candidatos: todas as respostas possiveis + o pool (limitado quando sobra pouca coisa)
  const pool = candidates.length > 200 ? guessPool : [...new Set([...candidates, ...guessPool])];
  for (const word of pool) {
    const e = expectedRemaining(word, candidates);
    // desempate: preferir palavra que ainda pode ser a resposta
    if (e < best.expected || (e === best.expected && candidates.includes(word) && !candidates.includes(best.word))) {
      best = { word, expected: e };
    }
  }
  return best;
}

// o primeiro palpite do bot e sempre o mesmo pra mesma lista: calcula uma vez
let openerCache: { key: number; word: string; expected: number } | null = null;

/** Analisa um tabuleiro. `targets` = lista de respostas possiveis; `answer` = resposta desse tabuleiro. */
export function analyzeBoard(guesses: string[], answer: string, targets: string[]): GuessAnalysis[] {
  let candidates = targets;
  const result: GuessAnalysis[] = [];

  for (let g = 0; g < guesses.length; g++) {
    const guess = guesses[g];
    const before = candidates.length;

    let bot: { word: string; expected: number };
    if (g === 0 && openerCache?.key === targets.length) {
      bot = openerCache;
    } else {
      bot = bestGuess(candidates, targets);
      if (g === 0) openerCache = { key: targets.length, ...bot };
    }

    const expected = expectedRemaining(guess, candidates);
    const pattern = patternOf(guess, answer);
    const next = candidates.filter((c) => patternOf(guess, c) === pattern);
    const solved = guess === answer;
    // nota: 100 = tao bom quanto o bot; cai conforme deixa mais palavras que o bot deixaria
    const score = solved ? 100 : Math.max(0, Math.min(100, Math.round((bot.expected / expected) * 100)));

    result.push({ guess, before, after: next.length, expected, botGuess: bot.word, botExpected: bot.expected, score, solved });
    if (solved) break;
    candidates = next.length > 0 ? next : candidates;
  }
  return result;
}
