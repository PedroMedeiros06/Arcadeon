// Distribuição de letras PT-BR aproximada (frequência), sem K/W/Y (raras em palavras comuns).
// Usada só pra preencher células que sobraram depois de encaixar as palavras da rodada.
const LETTER_POOL =
  "AAAAAAAAAAAEEEEEEEEEEEEEOOOOOOOOOSSSSSSSRRRRRRIIIIIIIINNNNNNDDDDDDMMMMMTTTTTUUUUUCCCCLLLLPPPPVVBGHFJQXZ";

export interface BoggleCell {
  row: number;
  col: number;
  letter: string;
}

export type BoggleBoard = BoggleCell[][];

// ---------------------------------------------------------------------------
// BoardGenerator: monta o tabuleiro escolhendo palavras primeiro, em vez de
// sortear letras e torcer. Fluxo: secretWord -> outras palavras -> preenchimento.
// ---------------------------------------------------------------------------

type Grid = (string | null)[][];

function neighborsOf(size: number, r: number, c: number): [number, number][] {
  const result: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) result.push([nr, nc]);
    }
  }
  return result;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Tenta encaixar `word` num grid parcialmente preenchido, reaproveitando letras
// já colocadas quando baterem, e ocupando células vazias quando precisar.
// Retorna o caminho (coordenadas) se conseguir, ou null.
function tryPlaceWord(grid: Grid, size: number, word: string): [number, number][] | null {
  const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function dfs(r: number, c: number, idx: number, path: [number, number][]): [number, number][] | null {
    const cell = grid[r][c];
    if (cell !== null && cell !== word[idx]) return null;

    visited[r][c] = true;
    const newPath = [...path, [r, c] as [number, number]];

    if (idx === word.length - 1) return newPath;

    for (const [nr, nc] of shuffle(neighborsOf(size, r, c))) {
      if (!visited[nr][nc]) {
        const found = dfs(nr, nc, idx + 1, newPath);
        if (found) return found;
      }
    }
    visited[r][c] = false;
    return null;
  }

  const startCells = shuffle(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number])
  ).filter(([r, c]) => grid[r][c] === null || grid[r][c] === word[0]);

  for (const [r, c] of startCells) {
    const found = dfs(r, c, 0, []);
    if (found) return found;
  }
  return null;
}

function applyPath(grid: Grid, word: string, path: [number, number][]): void {
  path.forEach(([r, c], i) => {
    grid[r][c] = word[i];
  });
}

export interface BoardGenerationResult {
  board: BoggleBoard;
  secretWord: { word: string; path: BoggleCell[] };
}

// Escolhe as palavras da rodada e monta o tabuleiro em torno delas:
// 1. sorteia uma secretWord (longa) e garante um caminho pra ela;
// 2. tenta encaixar outras palavras candidatas reaproveitando letras existentes;
// 3. preenche o resto do grid com letras ponderadas por frequência.
// Se qualquer etapa obrigatória falhar, descarta e tenta o board inteiro de novo.
export function generateBoardWithSecret(
  size: number,
  dictionary: string[],
  minLength: number,
  maxAttempts = 20
): BoardGenerationResult {
  const secretCandidates = shuffle(
    dictionary.filter((w) => w.length >= Math.max(minLength, 5) && w.length <= size * size)
  );
  const fillerCandidates = shuffle(dictionary.filter((w) => w.length >= minLength && w.length <= size * size));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const secretWordRaw = secretCandidates[attempt % secretCandidates.length];
    if (!secretWordRaw) break;
    const secretWord = secretWordRaw.toUpperCase();

    const grid: Grid = Array.from({ length: size }, () => Array(size).fill(null));
    const secretPath = tryPlaceWord(grid, size, secretWord);
    if (!secretPath) continue;
    applyPath(grid, secretWord, secretPath);

    // Encaixa mais algumas palavras aproveitando letras já no grid, pra não
    // sobrar células soltas. Não é obrigatório conseguir todas.
    let placedCount = 0;
    for (const candidate of fillerCandidates) {
      if (placedCount >= 40) break;
      const word = candidate.toUpperCase();
      if (word === secretWord) continue;
      const path = tryPlaceWord(grid, size, word);
      if (path) {
        applyPath(grid, word, path);
        placedCount++;
      }
    }

    // Preenche o que sobrou com letras ponderadas por frequência PT-BR.
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) {
          grid[r][c] = LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
        }
      }
    }

    const board: BoggleBoard = grid.map((row, r) => row.map((letter, c) => ({ row: r, col: c, letter: letter! })));
    const secretPathCells: BoggleCell[] = secretPath.map(([r, c]) => board[r][c]);

    return { board, secretWord: { word: secretWord, path: secretPathCells } };
  }

  // Fallback: nenhuma secretWord coube (board muito pequeno pra dicionário, etc).
  // Gera um board só com letras aleatórias pra nunca travar o jogo.
  const grid: Grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)])
  );
  const board: BoggleBoard = grid.map((row, r) => row.map((letter, c) => ({ row: r, col: c, letter: letter! })));
  const fallback = findAllWords(board, dictionary, minLength);
  const secretWord = pickSecretWord(fallback) ?? { word: "", path: [] };
  return { board, secretWord };
}

// ---------------------------------------------------------------------------
// WordPathFinder: dado um board já pronto, verifica se uma palavra existe nele.
// ---------------------------------------------------------------------------

// Verifica se `word` pode ser formada no board por caminho de adjacência sem reusar célula.
// Retorna o caminho (lista de células) se existir, senão null.
export function findWordPath(board: BoggleBoard, word: string): BoggleCell[] | null {
  const target = word.toUpperCase();
  const size = board.length;
  const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function dfs(r: number, c: number, idx: number, path: BoggleCell[]): BoggleCell[] | null {
    if (board[r][c].letter !== target[idx]) return null;
    const newPath = [...path, board[r][c]];
    if (idx === target.length - 1) return newPath;

    visited[r][c] = true;
    for (const [nr, nc] of neighborsOf(size, r, c)) {
      if (!visited[nr][nc]) {
        const found = dfs(nr, nc, idx + 1, newPath);
        if (found) {
          visited[r][c] = false;
          return found;
        }
      }
    }
    visited[r][c] = false;
    return null;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c].letter === target[0]) {
        const found = dfs(r, c, 0, []);
        if (found) return found;
      }
    }
  }
  return null;
}

// Pontuação padrão Boggle: 3-4=1, 5=2, 6=3, 7=5, 8+=11
export function scoreForWord(length: number): number {
  if (length <= 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  return 11;
}

// ---------------------------------------------------------------------------
// BoardValidator: varre o dicionário inteiro contra o board pronto, pra saber
// de fato todas as palavras válidas (usado pro reveal final e placar).
// ---------------------------------------------------------------------------

export function findAllWords(
  board: BoggleBoard,
  dictionary: string[],
  minLength: number
): { word: string; path: BoggleCell[] }[] {
  const found: { word: string; path: BoggleCell[] }[] = [];
  for (const word of dictionary) {
    if (word.length < minLength) continue;
    const path = findWordPath(board, word);
    if (path) found.push({ word: word.toUpperCase(), path });
  }
  return found;
}

// Palavra secreta = a mais difícil de formar entre as encontradas (caminho mais longo/tortuoso).
// Heurística simples: maior palavra encontrada; empate resolvido por menos ocorrências no board.
export function pickSecretWord(
  found: { word: string; path: BoggleCell[] }[]
): { word: string; path: BoggleCell[] } | null {
  if (found.length === 0) return null;
  return [...found].sort((a, b) => b.word.length - a.word.length)[0];
}

// Mantido por compat (usado no fallback acima); gera board 100% aleatório sem
// garantias de palavras.
export function generateBoard(size: number): BoggleBoard {
  const board: BoggleBoard = [];
  for (let r = 0; r < size; r++) {
    const row: BoggleCell[] = [];
    for (let c = 0; c < size; c++) {
      const letter = LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
      row.push({ row: r, col: c, letter });
    }
    board.push(row);
  }
  return board;
}
