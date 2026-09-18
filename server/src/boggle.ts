// Distribuição de letras PT-BR aproximada (frequência), sem K/W/Y (raras em palavras comuns)
const LETTER_POOL =
  "AAAAAAAAAAAEEEEEEEEEEEEEOOOOOOOOOSSSSSSSRRRRRRIIIIIIIINNNNNNDDDDDDMMMMMTTTTTUUUUUCCCCLLLLPPPPVVBGHFJQXZ";

export interface BoggleCell {
  row: number;
  col: number;
  letter: string;
}

export type BoggleBoard = BoggleCell[][];

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

function neighbors(board: BoggleBoard, r: number, c: number): [number, number][] {
  const size = board.length;
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
    for (const [nr, nc] of neighbors(board, r, c)) {
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

// Encontra todas as palavras válidas do dicionário presentes no board (para revelar
// palavras não descobertas e escolher a palavra secreta).
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
