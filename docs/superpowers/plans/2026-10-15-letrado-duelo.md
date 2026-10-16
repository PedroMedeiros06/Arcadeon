# Letrado Duelo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live 1v1 duel in the Letrado (any board count). Both players get the same words. The first to solve every board wins; otherwise the player who got closest wins. The result feeds a head-to-head scoreboard.

**Architecture:**
- **Authority.** Postgres is the authority. `security definer` RPCs (`termo_duel_*`) hold the words, evaluate guesses, apply the end rules under a row lock, and timestamp everything with `now()`.
- **Live updates.** Clients follow the duel through Supabase Realtime `postgres_changes` on two RLS-protected tables that expose colors only. A 10 s refetch covers dropped events.
- **UI.** The UI is a new `duel/` folder reusing `Boards`, `Keyboard`, `useWordInput` and `useFitBoards`, mounted from `TermoGame` as a third "extra" mode.

**Tech Stack:** Supabase (Postgres plpgsql, RLS, Realtime), Next 16 / React 19, Tailwind v4, `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-10-15-letrado-duelo-design.md`

## Global Constraints

- Every RPC is `security definer`, `set search_path = ''`, revoked from `public`/`anon`, granted to `authenticated` only.
- Room codes use the same format as the other games: `^[A-HJ-NP-Z2-9]{5}$`. The link is `/games/termo?join=<code>`.
- Attempts per player: `board_count + 5`. Countdown: 3 s. Heartbeat every 15 s. Abandonment after 60 s without heartbeat. A waiting room expires after 15 min.
- Closest score per board: 10 if solved, else max over rows of `2*greens + yellows`. Tie on score: earlier `finished_at` wins.
- No coins. Duels never touch the daily streak, shields or achievements.
- The rival only ever receives color patterns (`C`/`P`/`A`) until the duel ends.
- Tailwind colors: `bg-[var(--x)]`. UI copy in Portuguese. Do not run prettier. `git add` by path.

## Review Focus

1. **Two players solve within the same few ms.** Exactly one winner, decided by commit order under `for update`. Covered by the dry-run "double solve" case.
2. **Guess sent before `started_at`.** Countdown still running, so it is rejected with "O duelo ainda não começou". Covered by the dry-run.
3. **Player reloads (F5) mid-duel.** Comes back to the same rows, the same opponent progress and the same timer. Covered by `?join=` re-entry, since `termo_duel_join` is idempotent for members, and by the Playwright test.
4. **Rival tab sleeps (phone locked) for over 60 s while still technically in the game.** A claim is accepted. When the sleeper returns, a guess gets the finished state, not an error. Covered by the dry-run "claim" case.
5. **Repeated letters in guesses.** `termo_eval` must match `evaluateGuess`, e.g. guess `aarar` vs `arara`. Covered by the eval parity test.

---

### Task 1: Migration and dry-run

**Files:**
- Create: `supabase/migrations/20261015030000_termo_duelo.sql`

**Produces:**
- Tables: `termo_duels`, `termo_duel_words`, `termo_duel_players`, `termo_duel_guesses`.
- Functions:
  - `termo_eval(text, text) → text`
  - `termo_duel_create(int) → jsonb {code}`
  - `termo_duel_join(text) → jsonb state`
  - `termo_duel_start(text) → jsonb state`
  - `termo_duel_state(text) → jsonb state`
  - `termo_duel_guess(text, text) → jsonb state`
  - `termo_duel_ping(text) → void`
  - `termo_duel_forfeit(text) → jsonb state`
  - `termo_duel_claim(text) → jsonb state`
  - `termo_duel_record(uuid) → jsonb {wins, losses}`

**State JSON:**

```json
{ "code", "board_count", "status", "host_id", "guest_id", "created_at", "started_at", "finished_at",
  "winner_id", "end_reason", "now",
  "me":  { "user_id", "guesses": [..], "patterns": [..], "solved": [..], "finished_at", "score" },
  "opponent": { "user_id", "username", "avatar", "patterns": [..], "solved": [..], "finished_at", "score", "last_seen_at", "guesses": [..] only when finished },
  "words": [..] only when finished }
```

`patterns[i]` holds `board_count` five-letter codes joined by `|`. A board already solved before row `i` gets `-----`.

- [ ] Write the migration: tables, RLS policies (select only where `auth.uid()` is host or guest, or the row's own player), indexes, `termo_eval`, RPCs, grants, and `alter publication supabase_realtime add table termo_duels, termo_duel_players`.
- [ ] Apply with `mcp__supabase__apply_migration`.
- [ ] Run the dry-run DO block (ends with `raise exception 'dry-run ok'`). It sets `request.jwt.claims` to two existing test users and covers:
  - create, join, start, and a guess before start (error);
  - a solve that ends the duel;
  - both players exhausting attempts, decided by score;
  - a score tie decided by time;
  - forfeit;
  - claim refused, then accepted after moving `last_seen_at` back 61 s;
  - the record.
- [ ] Eval parity: run `termo_eval` for these pairs and compare with `node -e` running `evaluateGuess`: `aarar/arara`, `sssss/assar`, `carro/corra`, `abcde/edcba`.
- [ ] Run `get_advisors` (security) and check that no new warnings appear on the duel tables.
- [ ] Commit the migration.

### Task 2: Client lib with tests

**Files:**
- Create: `web/lib/termo/duel.ts` (types, `parseDuelState`, `duelScoreBreakdown`, RPC wrappers, `subscribeDuel`).
- Create: `web/lib/termo/duel.test.ts`.

**Produces:**
- `type DuelStatus = "waiting" | "playing" | "finished" | "expired"`
- `interface DuelPlayer { userId; username; avatar; guesses: string[]; patterns: string[][]; solved: (number|null)[]; finishedAt: number|null; score: number|null; lastSeenAt: number|null }`
- `interface DuelState { code; boardCount: BoardCount; status; hostId; guestId; startedAt: number|null; finishedAt: number|null; winnerId; endReason; serverOffset: number; me: DuelPlayer; opponent: DuelPlayer|null; words: string[]|null }`
- `parseDuelState(raw: unknown, now: number): DuelState | null`
- `boardScores(patterns: string[][], boardCount): number[]`
- Async functions:
  - `createDuel(boardCount) → string`
  - `joinDuel(code) → DuelState`
  - `startDuel(code)`
  - `fetchDuel(code) → DuelState|null`
  - `guessDuel(code, word) → DuelState`
  - `pingDuel(code)`
  - `forfeitDuel(code)`
  - `claimDuel(code)`
  - `fetchDuelRecord(friendId) → {wins, losses}|null`
- `subscribeDuel(duelId, onChange) → () => void`

- [ ] Write tests: parse a valid state, reject malformed input, patterns split by `|`, `boardScores` (solved = 10, best row, `-----` ignored).
- [ ] `npm test`: fails.
- [ ] Implement.
- [ ] `npm test`: passes. Commit.

### Task 3: UI (lobby, game, result) and TermoGame wiring

**Files:**
- Create: `web/components/termo/duel/DuelScreen.tsx` (state machine: loads, subscribes, pings, routes to lobby, game or result).
- Create: `web/components/termo/duel/DuelLobby.tsx`
- Create: `web/components/termo/duel/DuelGame.tsx`
- Create: `web/components/termo/duel/DuelResult.tsx`
- Create: `web/components/termo/duel/OpponentBoards.tsx`
- Modify: `web/components/termo/ModeMenu.tsx` (`ExtraMode` adds `"duel"`, plus a third card).
- Modify: `web/components/termo/TermoGame.tsx` (`?join=` param, render `DuelScreen` when `extraMode === "duel"`, leave guard text).

- [ ] `DuelScreen` has two entry paths. Without a code it shows mode pick → `createDuel`. With a code (from `?join=` or sessionStorage `termoDuelCode`) it runs `joinDuel`. Logged-out users see an "Entre na sua conta" card.
- [ ] Lobby:
  - Shows the code, a copy-link button, and the friend list from `useFriends()` with an invite button for online friends (`sendGameInvite(id, "termo", code)`). Invite errors show as a message, since `termo` is not yet whitelisted.
  - Shows who joined, and the host's Começar button.
- [ ] Game:
  - `Boards` driven by `me.guesses` and evaluated locally from server patterns via `codeToStates`.
  - Keyboard; opponent mini boards; a countdown overlay until `startedAt`; a Desistir button.
  - When the rival's `lastSeenAt` is over 60 s old, a "Reivindicar vitória" button appears.
- [ ] Result: winner banner by `endReason`, scores when `closest`, both players' words and rows, the record, and the "Novo duelo" / "Voltar" buttons.
- [ ] `npm run lint` and `npx tsc --noEmit` pass.
- [ ] Playwright: two browser contexts with two test accounts at 390x664. Run a full duel in Duplo and check the 1/4 layouts. Commit.

### Task 4: Wrap-up

- [ ] Push. Confirm the Vercel deploy status.
- [ ] Vault:
  - `Pedidos-ao-Servidor.md`: add `termo` to the `send_game_invite` whitelist.
  - Frontend: add `termo` to `MULTIPLAYER` in `web/lib/social/rules.ts`.
  - `03-Termo-Game.md`: notes.
- [ ] Update `.claude/agents/letrado.md` with the duel architecture.
