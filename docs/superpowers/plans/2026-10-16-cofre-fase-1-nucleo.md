# Cofre — Fase 1 (núcleo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** This phase delivers the Cofre memory game's rules engine with tests, the card and board with their animations (flip and moving board), and a playable local practice mode ("Treino") at `/games/cofre`. It also registers the game in the hub as "em breve".

**Architecture:** The engine is pure, immutable TypeScript with no imports, living in `web/lib/cofre/engine.ts`. Treino uses it on the client. In phase 2 the server will copy this file to `server/src/cofreEngine.ts`, with a test that fails if the two files diverge. The spec places the engine on the server; this is a deliberate deviation, because the server's `rootDir: src` cannot import from `web/`. The UI is React 19 with Tailwind v4 variables and CSS keyframes prefixed `cofre-*`.

**Tech Stack:** Next.js 16.3, React 19.2 (lint from the React Compiler), Tailwind v4, `node --test` with native TS imports (`allowImportingTsExtensions`), Node 24.

**Spec:** `docs/superpowers/specs/2026-10-16-cofre-design.md`

## Global Constraints

- **Slug, route and folders:** the slug is `cofre`, the route is `/games/cofre`, the folders are `web/components/cofre/` and `web/lib/cofre/`, and keyframes and classes use the `cofre-` prefix.
- **Rules:** this is the classic memory game. A match keeps the turn and a miss passes it. A normal pair is worth **1 point** and a Coringa pair **3 points**. On a points tie, more pairs wins; after that, fewer misses wins; after that, the placement is shared.
- **Board sizes:** `4x4` (8 pairs), `6x4` (12), `6x5` (15), `6x6` (18). The default is `6x4`.
- **Coringa:** it replaces one normal pair with a pair of `coringa` cards, so the total number of cards stays the same.
- **Moving board:** after each miss, two hidden cards swap places, with a slide of about **0.6 s** that everyone can see.
- **Solo score:** `moves × 10 + seconds`. Lower is better.
- **Card art:** cards live at `/games/cofre/cards/<id>.png` and the back at `/games/cofre/cards/back.png`. The images may not exist yet (the user generates them in GPT), so every image needs a fallback.
- **Code style:** short code comments in Portuguese without accents; player-facing text with accents. Do not run prettier. localStorage only via `useLocalFlag`, always inside try/catch. Game buttons use `onMouseDown={(e) => e.preventDefault()}`.
- **Next 16:** before writing route or component code, read `web/node_modules/next/dist/docs/`.
- **Animations:** respect `prefers-reduced-motion` through a `.cofre-motion` class, the same pattern as `.race-motion` in `globals.css:554`.
- **Git:** commit with `git add` by path only, never `-A`. The repo has other people's changes that are not ours. Commit messages are `Cofre: ...` and end with the `Co-Authored-By` line from the environment. Push only with the user's confirmation.

## Review Focus

1. **A third click while a miss is still showing** must be ignored, not flip a third card. Test: `flip ignora clique com erro pendente` (Task 1).
2. **Clicking the same card twice, or a card already taken,** returns `invalid` and does not count as a move. Tests: `flip ignora carta ja virada ou recolhida` (Task 1).
3. **Restarting or leaving during the 900 ms after a miss** must not let the old timeout call `resolveMiss` on the new game. The timeout ref is cleared on restart and unmount. Checked manually in Task 5, Step 4: miss, then immediately "Jogar de novo"; the new board must not change by itself. Also covered by the engine side: `resolveMiss sem erro pendente nao faz nada` (Task 2).
4. **A missing card image** shows the fallback (label + emoji) and not a broken image. This is checked manually in Task 3, Step 4.
5. **Reduced motion** keeps the swap understandable: no slide, but both cells blink a highlight for 0.6 s. This is checked manually in Task 4, Step 4.

---

### Task 0: Branch

- [ ] **Step 1:** Run `git switch -c cofre/fase-1` from `main`. Expected: the branch is created and the other sessions' uncommitted changes stay in the working tree, untouched.

### Task 1: Engine — board, flip, match, miss, Coringa

**Files:**
- Create: `web/lib/cofre/engine.ts`
- Test: `web/lib/cofre/engine.test.ts`

**Interfaces (Produces):**
```ts
export type BoardSize = "4x4" | "6x4" | "6x5" | "6x6";
export const BOARD_SIZES: Record<BoardSize, { cols: number; rows: number }>;
export const LOOT_FACES: readonly string[]; // 18 ids, in the spec's order: diamante, barra-ouro, relogio, coroa, perolas, chave, rubi, dobrao, calice, anel, dragao-jade, ovo-imperial, maleta, quadro, ficha, bussola, safira, mascara
export const CORINGA = "coringa";
export type Rng = () => number; // [0,1)
export function mulberry32(seed: number): Rng;
export interface CofreOptions { size: BoardSize; movingBoard: boolean; coringa: boolean }
export type CellState = "hidden" | "up" | "taken";
export interface Cell { face: string; state: CellState }
export interface PlayerScore { points: number; pairs: number; misses: number }
export interface GameState {
  options: CofreOptions; cols: number; rows: number;
  cells: Cell[];            // the index never changes; the moving board swaps contents
  flipped: number[];        // 0, 1 or 2 indices face-up in the current move
  pendingMiss: boolean;     // true after a miss until resolveMiss
  players: PlayerScore[]; turn: number; moves: number; finished: boolean;
}
export type FlipEvent =
  | { kind: "invalid" }
  | { kind: "first"; index: number }
  | { kind: "match"; a: number; b: number; points: 1 | 3; finished: boolean }
  | { kind: "miss"; a: number; b: number };
export function createGame(options: CofreOptions, playerCount: number, rng: Rng): GameState;
export function flip(state: GameState, index: number): { state: GameState; event: FlipEvent };
export function pairPoints(face: string): 1 | 3;
```
Every function returns a new state and never mutates its input.

- [ ] **Step 1: Write the failing tests** in `engine.test.ts`, importing from `"./engine.ts"`:
  - `createGame monta pares embaralhados`: for each size, `cells.length === cols*rows`, every face appears exactly 2 times, all cells are `hidden`, and `players.length === playerCount` with zeros everywhere.
  - `createGame com coringa troca um par`: with `coringa: true` on `4x4`, exactly 2 cells have `CORINGA` and there are 7 distinct normal faces. With `coringa: false`, no cell has `CORINGA`.
  - `createGame e deterministico com a mesma semente`: `createGame(o, 2, mulberry32(42))` deep-equals a second call with the same arguments, and differs with seed 43.
  - `flip acerta par normal`: with a hand-built state (helper `stateWith(faces: string[])`, which builds the state without shuffling), flipping 0 and then 1 on `["diamante","diamante",...]` gives `match` with `points: 1`. Both cells become `taken`, `players[0]` is `{points:1,pairs:1,misses:0}`, `turn` stays 0, `moves === 1` and `flipped` is empty.
  - `flip par de coringa vale 3`: the same flow with `CORINGA` gives `points: 3` and `players[0].points === 3`.
  - `flip erra e segura as cartas`: on a miss, the event is `miss` with `a` and `b`, both cells are `up`, `pendingMiss === true`, `players[0].misses === 1`, and `turn` has not changed yet (it changes in `resolveMiss`, Task 2).
  - `flip ignora clique com erro pendente`: with `pendingMiss`, `flip` on a third card returns `invalid` and the state is unchanged (`===`).
  - `flip ignora carta ja virada ou recolhida`: flipping the same index twice returns `invalid` the second time, and so does flipping a `taken` cell or an index out of range. `moves` does not change.
  - `ultimo par termina o jogo`: in a `stateWith` where only 1 pair is still hidden, the `match` comes with `finished: true` and `state.finished === true`. After that, any `flip` is `invalid`.

- [ ] **Step 2:** `cd web && node --test lib/cofre/engine.test.ts`. Expected: FAIL (the module does not exist yet).

- [ ] **Step 3: Implement** everything in the Interfaces block in `engine.ts`.
  - Use Fisher–Yates driven by `rng` for the shuffle.
  - The faces used are the first `cols*rows/2` items of `LOOT_FACES`, picked after shuffling `LOOT_FACES` with `rng`.
  - With Coringa, the last face picked is replaced by `CORINGA`.
  - `moves` counts completed moves, meaning every second card turned over (a match or a miss).
  - Use the standard `mulberry32`.

- [ ] **Step 4:** Run the command from Step 2. Expected: all tests pass.

- [ ] **Step 5: Commit** — `git add web/lib/cofre/engine.ts web/lib/cofre/engine.test.ts`, `git commit -m "Cofre: engine com pares, coringa e jogada"`.

### Task 2: Engine — resolve the miss, moving board, ranking

**Files:**
- Modify: `web/lib/cofre/engine.ts`
- Test: `web/lib/cofre/engine.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Rng`, `PlayerScore` (Task 1)
- Produces:
```ts
export function resolveMiss(state: GameState, rng: Rng): { state: GameState; swap: [number, number] | null };
export function placements(players: PlayerScore[]): number[]; // 1-based placement per player, ties share the placement (e.g. [1,1,3])
export function soloScore(moves: number, seconds: number): number; // moves*10 + seconds
```

- [ ] **Step 1: Write the failing tests:**
  - `resolveMiss esconde e passa a vez`: after a miss with 2 players, `resolveMiss` puts both cells back to `hidden`, clears `flipped`, sets `pendingMiss=false` and `turn: 0 → 1`, and with 2 players turn 1 wraps back to 0. With `movingBoard:false`, `swap === null` and the faces are in the same order.
  - `resolveMiss com tabuleiro movel troca duas escondidas`: with `movingBoard:true`, `swap` is `[a,b]` with `a !== b`, both were `hidden` after the cards were put back, `cells[a].face` and `cells[b].face` are swapped compared with before, and every other cell is the same.
  - `resolveMiss no fim do jogo troca as duas que erraram`: in a state where the only cells not `taken` are the 2 that just missed, with `movingBoard:true`, `swap` is exactly those 2 indices (in either order) and nothing throws.
  - `resolveMiss sem erro pendente nao faz nada`: without `pendingMiss`, it returns the same state (`===`) and `swap: null`.
  - `placements desempata por pares e erros`: `[{points:3,pairs:1,misses:0},{points:3,pairs:3,misses:5}]` gives `[2,1]`. `[{3,3,2},{3,3,1}]` gives `[2,1]`. `[{3,3,1},{3,3,1},{1,1,0}]` gives `[1,1,3]`.
  - `soloScore`: `soloScore(14, 63) === 203`.

- [ ] **Step 2:** `cd web && node --test lib/cofre/engine.test.ts`. Expected: FAIL on the new tests.

- [ ] **Step 3: Implement.**
  - The swap picks 2 distinct `hidden` indices, with uniform odds via `rng`, after hiding the missed cards.
  - `placements` sorts by points desc, then pairs desc, then misses asc. A player's placement is 1 + the number of players strictly better.

- [ ] **Step 4:** Run the command from Step 2. Expected: everything passes.

- [ ] **Step 5: Commit** — `git commit -m "Cofre: tabuleiro movel, desempate e nota solo"` with the 2 paths.

### Task 3: Card catalog and `Card` component with 3D flip

**Files:**
- Create: `web/lib/cofre/cards.ts`, `web/components/cofre/Card.tsx`
- Modify: `web/app/globals.css`. Add a new `/* ---------- Cofre ---------- */` section at the end of the file containing the `cofre-*` keyframes and `.cofre-motion` reduced motion. The token blocks go in Task 5.

**Interfaces:**
- Consumes: `CORINGA`, `LOOT_FACES`, `CellState` (Task 1)
- Produces:
```ts
// cards.ts
export interface CardArt { id: string; label: string; emoji: string; src: string }
export function cardArt(face: string): CardArt; // label in PT with accents (e.g. "Barra de ouro"), emoji fallback (e.g. "💎"), src `/games/cofre/cards/${id}.png`
export const CARD_BACK_SRC = "/games/cofre/cards/back.png";
// Card.tsx
export function Card(props: { face: string | null; state: CellState; disabled: boolean; highlight?: "swap" | null; onFlip: () => void }): React.JSX.Element;
```
`face` is `null` while the card is hidden. This matches the anti-cheat rule that the client never knows a hidden face, even in Treino; that keeps the same component working in phase 2.

- [ ] **Step 1:** Write `cards.ts` with all 18 loot faces plus `coringa`. Add a `cards.test.ts` test, `cardArt cobre todas as faces`: every `LOOT_FACES` id and `CORINGA` return a non-empty `label` and `emoji`, and `src` ends in `/${id}.png`. Run `node --test lib/cofre/cards.test.ts` and expect FAIL, then implement it and expect PASS.

- [ ] **Step 2: Implement `Card`.**
  - Structure: a `button` with an `aspect-[3/4]` box, `perspective: 800px`, an inner layer with `transform-style: preserve-3d` and rotateY at 0/180° using a `transition` of 300 ms, and two faces with `backface-visibility: hidden`.
  - Back face: the `CARD_BACK_SRC` image with `object-cover`. If it fails to load, the fallback is a dark gunmetal gradient (`#1d2329` → `#0e1215`) plus a teal circle with a ring in the center (the dial).
  - Front face: a dark velvet background (`#141a20`) with a fine `--game-accent` border, and an `<img>` of the art in `object-contain` with `p-[12%]`. `onError` switches it to big `emoji` + small `label`.
  - Coringa: border and glow in magenta/gold (`#e0409b` / `#f2c14e`) to set it apart.
  - `taken`: the card stays face-up and fades out with the `cofre-taken` keyframe (scale 1 → 0.9, opacity 1 → 0.25, 400 ms) and stays at 0.25 opacity.
  - `highlight="swap"`: a teal ring with the `cofre-swap-glow` keyframe (0.6 s).
  - `aria-label`: "Carta escondida" or the face's `label`.

- [ ] **Step 3:** `cd web && npx tsc --noEmit && npx eslint lib/cofre components/cofre`. Expected: no errors.

- [ ] **Step 4: Manual check** (it happens in Task 5 once the screen exists; write it down here so it doesn't get forgotten). With no PNGs in `public/games/cofre/cards/`, every card shows emoji + label and no broken-image icon.

- [ ] **Step 5: Commit** — `git commit -m "Cofre: carta com virada 3D e fallback sem arte"` (paths: `cards.ts`, `cards.test.ts`, `Card.tsx`, `globals.css`).

### Task 4: `Board` with the moving-board animation

**Files:**
- Create: `web/components/cofre/Board.tsx`
- Modify: `web/app/globals.css` (Cofre section)

**Interfaces:**
- Consumes: `Card` (Task 3), `GameState`-shaped data
- Produces:
```ts
export interface BoardCell { face: string | null; state: CellState }
export function Board(props: {
  cols: number; cells: BoardCell[]; disabled: boolean;
  swap: { a: number; b: number; key: number } | null; // key changes on every new swap
  onFlip: (index: number) => void;
}): React.JSX.Element;
```

- [ ] **Step 1: Implement the grid.**
  - `grid` with `gridTemplateColumns: repeat(cols, minmax(0,1fr))`, `gap-2 sm:gap-3`, width limited by `max-w-[min(100%,calc((100dvh-12rem)*cols/rows*0.75))]` so a 6×6 board fits on a laptop without scrolling.
  - A `taken` cell keeps its slot (empty space, per the spec).

- [ ] **Step 2: Swap animation** (FLIP technique). When `swap.key` changes:
  - measure the `getBoundingClientRect()` of cells `a` and `b` (refs per index);
  - apply `--dx/--dy` to each one (the distance to the other cell);
  - run the `cofre-swap` keyframe, which goes from `translate(var(--dx),var(--dy))` to `translate(0,0)` in 600 ms ease-in-out.
  The content is already swapped in the state; the animation only makes the move visible. Use a `useLayoutEffect` keyed on `swap.key`, with no synchronous `setState` inside it: the animation is triggered by writing to the ref's `style` and clearing it on `animationend`. Also pass `highlight="swap"` to both cells during those 600 ms.
  - Under `.cofre-motion` with reduced motion: no translate, only `cofre-swap-glow`.

- [ ] **Step 3:** Run `npx tsc --noEmit && npx eslint components/cofre`. Expected: clean.

- [ ] **Step 4: Manual check** in Task 5: with the moving board on, after a miss two cards visibly slide past each other. With reduced motion emulated (Playwright `emulateMedia({reducedMotion:"reduce"})`), only the highlight blinks on both cells.

- [ ] **Step 5: Commit** — `git commit -m "Cofre: tabuleiro com animacao de troca"`.

### Task 5: Treino screen, route and hub registration

**Files:**
- Create:
  - `web/components/cofre/PracticeScreen.tsx`
  - `web/components/cofre/CofreGame.tsx`
  - `web/app/games/cofre/page.tsx`
  - `web/app/games/cofre/opengraph-image.tsx`
- Modify:
  - `web/lib/games.ts`: new entry at the end of the array
  - `web/lib/seo.ts`: `cofre` block after `corrida`
  - `web/components/gameIcons.tsx`: `CofreIcon` and the map entry
  - `web/app/globals.css`: `--game-cofre` light/dark, `[data-game="cofre"]`, `.pattern-cofre`

**Interfaces:**
- Consumes: `createGame`, `flip`, `resolveMiss`, `soloScore`, `mulberry32` (Tasks 1–2); `Board` (Task 4); `GameHeader` from `web/components/GameHeader.tsx` (import only, do not edit)
- Produces: `export function CofreGame(): React.JSX.Element` (the game's menu). Phase 2 adds the multiplayer to it.

- [ ] **Step 1: `PracticeScreen`.**
  - **Setup:** size chips (`4x4`/`6x4`/`6x5`/`6x6`, default `6x4`) and a "Tabuleiro móvel" toggle (off by default), remembered with `useLocalFlag` (key `cofreTreinoMovel`). "Começar" button.
  - **Game:**
    - `createGame({size, movingBoard, coringa:false}, 1, mulberry32(Date.now() >>> 0))`.
    - The `BoardCell` passes `face` only when the state is `up` or `taken`; otherwise it passes `null`.
    - After a `miss`, wait **900 ms** and then call `resolveMiss` (the board is disabled meanwhile). The timeout lives in a ref and is cleared on unmount and on restart.
  - **HUD:** moves, a stopwatch (starts on the first flip, stops at `finished`), and pairs found out of the total.
  - **End:** a card with moves, time and "Nota: N" (`soloScore`), with "Jogar de novo" and "Trocar tamanho" buttons.

- [ ] **Step 2: `CofreGame`.** Menu with 3 tiles:
  - "Treino": opens `PracticeScreen`.
  - "Salas online" and "Golpe do dia": disabled, labelled "Em breve".
  Header via `GameHeader`, the same way `RaceGame` uses it.

- [ ] **Step 3: Route and hub registration.**
  - `page.tsx`: same pattern as `web/app/games/corrida/page.tsx`, with `data-game="cofre"`, `gameMetadata("cofre")`, `<Suspense><CofreGame/></Suspense>`.
  - `opengraph-image.tsx`: same as the corrida one, with `renderGameOgImage("cofre")`.
  - `games.ts` entry:
    `{ slug: "cofre", title: "Cofre", description: "Jogo da memória de assalto: decore, combine e leve o espólio.", icon: "🔐", status: "coming-soon", multiplayer: true, accent: "var(--game-cofre)", players: "Até 8", tags: ["Online", "Diário"] }`.
    `coming-soon` hides it from the sitemap and leaves the card inactive until phase 2. That is my call; the route works by direct URL for testing.
  - `seo.ts`:
    - `color: "#2cc4b0"`
    - `tagline: "Jogo da memória com cara de assalto."`
    - `title: "Cofre — jogo da memória online"`
    - a description in the same tone as the others
    - keywords `["jogo da memória", "jogo da memória online", "memória multiplayer", "cofre"]`
  - `globals.css`:
    - `--game-cofre: #0f9f8f` (light) and `#2cc4b0` (dark), next to the other `--game-*` tokens.
    - `[data-game="cofre"] { --game-accent: var(--game-cofre); }`
    - Add `.pattern-cofre` to the shared selector list and define it with `background-image: repeating-conic-gradient(rgb(0 0 0 / 0.1) 0 25%, transparent 0 50%); background-size: 18px 18px;`.
  - `CofreIcon`: in the `IconShell` style of the others. A vault door (rounded rectangle) with a central dial in `#F7B733`, plus 4 tick marks.
  - `GAME_ART`: not changed in this phase, because without `cofre.png` the card already falls back to the pattern.

- [ ] **Step 4: Verify.**
  - `cd web && npm test && npx tsc --noEmit && npm run lint && npm run build`. Expected: all green, and the build lists `/games/cofre`.
  - Then run `npm run dev` and use Playwright at `http://localhost:3000/games/cofre`:
    - Play a full 4×4 to the end screen.
    - Repeat with the moving board on.
    - Check the fallback without art (Task 3, Step 4) and the reduced motion (Task 4, Step 4).
    - Check 390×844 (6×6 with no horizontal scroll) and 1366×768 (6×6 with no vertical scroll), in light and dark themes.
    - Kill the dev server at the end.

- [ ] **Step 5: Commit** — `git commit -m "Cofre: treino local e registro no hub"`, listing the paths explicitly (the new files plus `games.ts`, `seo.ts`, `gameIcons.tsx`, `globals.css`).

### Task 6: Session organization

**Files:**
- Create: `.claude/agents/cofre.md`
- Create (outside the repo): `C:\Users\pedro\Documents\Obsidian Vault\ClaudeContexts\Arcadeon\10-Cofre-Game.md`

- [ ] **Step 1: `cofre.md`.** Same skeleton as `.claude/agents/corrida.md`, with these sections:
  - frontmatter (`name: cofre`, description listing Treino/Diário/salas, `model: inherit`)
  - first step (read `10-Cofre-Game.md`)
  - territory (`web/lib/cofre/`, `web/components/cofre/`, `web/app/games/cofre/`, `cofre-*` in `globals.css`, plus `server/src/cofre*.ts` and the `cofre_*` migrations in phase 2; shared files as in Task 5)
  - working rules (the Global Constraints of this plan)
  - test port **3301**
  - invariants:
    - the engine is pure and immutable;
    - the client never receives a hidden face;
    - `server/src/cofreEngine.ts` is a copy of `web/lib/cofre/engine.ts`, protected by a diff test from phase 2 on;
    - scoring 1/3 and the tie-breaks.

- [ ] **Step 2: Vault note.** Summary of the spec, a pointer to the spec and to this plan, and a section `2026-10-16 — Fase 1` with the branch, commit hashes and what was left for phase 2.

- [ ] **Step 3: Commit** — `git add .claude/agents/cofre.md`, `git commit -m "Cofre: subagent do jogo"`.

---

## Next phases (separate plans, written when each one starts)
- **Phase 2, multiplayer:** copy the engine to `server/src/cofreEngine.ts` with a diff test; `/cofre` namespace following the Corrida patterns; `CreateRoomForm` with every option (size, 2–8 players, turn timer, moving board, Coringa, initial peek); migration adding `'cofre'` to `award_match_coins`; `record_cofre_result`/`cofre_leaderboard`; `cofre-sim.ts`; `RoomGame` in `joinCode.ts`; `status: "available"`.
- **Phase 3, daily:** `cofre_daily_*` tables and RPCs, always 6×4 with the moving board, Letrado-style scoreboard.
- **Phase 4, polish:** sounds, tutorial, mobile, OG image with the art.
