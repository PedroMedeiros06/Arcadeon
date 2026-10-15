# Fase 2: economia — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para seguir este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** entregar a parte de tela da economia: missões do dia, calendário da sequência do Arcadeon (home e perfil) e o selo "+15 moedas" que as sessões dos jogos põem na tela de resultado. Tudo funciona antes do banco existir: sem RPC, a tela fica como está hoje.

**Arquitetura:** validação e regras de exibição ficam em módulos puros em `web/lib/economy/`, testados com `node --test`. Um módulo de API fino chama as RPCs e devolve `null` quando a RPC não existe ou responde fora do formato. Os componentes em `web/components/economy/` só desenham o que recebem. Banco e servidor são pedidos no vault (já escritos em 2026-10-14, seção "Fase 2: economia" de `Pedidos-ao-Servidor.md`).

**Tecnologia:** Next.js 16 (App Router), React 19, Tailwind 4, lucide-react, Supabase JS, `node --test` do Node 24 (sem dependência nova).

**Spec:** `docs/superpowers/specs/2026-10-12-arcadeon-escopo-final-design.md`, seção 6.

## Restrições globais

- A sessão Frontend nunca edita `server/`, migrations ou o banco. Nada de `apply_migration` nem SQL de escrita pelo MCP do Supabase.
- Arquivos dos jogos (`components/termo|buggle|draw|race`, `app/games/*`, `lib/termo|buggle|draw|race`) são das sessões de cada jogo. Este plano entrega `MatchCoins` pronto; encaixar na tela de resultado é pedido.
- Loja (`components/shop/*`, `app/(hub)/shop/*`) fica intocada: o usuário vai mexer nela em outro dia.
- Commits só por caminho (`git add <arquivos>`). Mensagem em português, prosa normal, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comentários no código em português sem acento, no estilo do repositório.
- Módulos testados não usam o alias `@/` e importam irmãos com extensão `.ts` só nos testes.
- Nenhuma dependência nova.
- Textos em caixa normal, voz ativa. Nenhuma mensagem de culpa na sequência ("Você perdeu", "Não deixe quebrar" estão proibidos).
- Dia do Arcadeon = dia de Brasília. A contagem regressiva usa `msUntilBrasiliaMidnight` de `web/lib/time.ts`; o estado do dia vem sempre do servidor, nunca da data local.
- Toda mudança de saldo na tela chama `refreshProfile()` do `AuthProvider`, pra o header acompanhar.
- Tudo que se move respeita `prefers-reduced-motion`.

## Foco da revisão

1. RPC ausente, com erro ou com formato inesperado (campo faltando, `cycle_day` 0 ou 9, `rewards` com 6 itens): o cartão some ou usa os valores padrão, nunca quebra a home. Testes nas Tasks 1 e 2.
2. Sequência quebrada vs. ciclo completo: com `streak` 7 contado hoje o dia 7 fica resgatável; com `streak` 0 e nada contado, nenhum dia aparece feito. Teste na Task 1.
3. Resgate clicado duas vezes ou com erro do servidor: o botão trava durante a chamada e a mensagem do servidor aparece no cartão. Verificado na Task 5 com a sessão falsa.
4. Saldo do header desatualizado depois de resgatar, de completar missão ou de receber moedas de partida. Verificado nas Tasks 5 e 7.
5. Missão com `progress` maior que `target` ou `target` 0: barra nunca passa de 100% e missão inválida é descartada. Teste na Task 2.

## Uso de skills e MCPs

- **superpowers:test-driven-development** em toda função pura.
- **frontend-design** e **design-taste-frontend** nas tasks visuais (5 a 7).
- **Playwright MCP** com a sessão falsa da Task 4: prints em 1440 px e 390 px, claro e escuro.
- **Supabase MCP** só leitura (`list_tables`) pra ver se algum pedido já foi atendido.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `web/lib/economy/streak.ts` (novo) | `parseStreak`, `streakSlots`, `todayReward`, `streakHint` |
| `web/lib/economy/missions.ts` (novo) | `parseMissions`, `missionDone`, `missionPercent`, `missionsDoneCount` |
| `web/lib/economy/matchCoins.ts` (novo) | `matchCoinsLabel` |
| `web/lib/economy/*.test.ts` (novos) | testes dos três acima |
| `web/lib/economy/api.ts` (novo) | `fetchArcadeonStreak`, `getArcadeonStreakShared`, `fetchDailyMissions`, `claimStreakReward` |
| `web/lib/auth/AuthProvider.tsx` | `refreshProfile` estável (`useCallback`) |
| `web/components/economy/useArcadeonStreak.ts` (novo) | hook de busca e resgate |
| `web/components/economy/StreakCalendar.tsx` (novo) | calendário de 7 dias |
| `web/components/economy/MissionsCard.tsx` (novo) | cartão "Missões de hoje" |
| `web/components/economy/MatchCoins.tsx` (novo) | selo de moedas da partida, para as sessões dos jogos |
| `web/components/home/HomeDaily.tsx` (novo) | linha "missões + sequência" logo abaixo do destaque |
| `web/components/home/HomeAside.tsx` | chama da sequência do Letrado só quando a do Arcadeon não existe |
| `web/app/(hub)/page.tsx` | encaixa `HomeDaily` |
| `web/components/profile/ProfilePageContent.tsx` | calendário no perfil |

**Decisão de layout (registrar como ruling):** o spec põe missões e calendário "na coluna da home". A coluna tem 1/3 da largura ao lado do carrossel de 17 rem; com quatro cartões ela ficaria duas vezes mais alta que o carrossel. As duas peças vão numa linha própria logo abaixo do destaque, com as mesmas colunas (2fr missões, 1fr sequência), e a coluna continua com moedas e posição. Custo se errado: mover `HomeDaily` pra dentro de `HomeAside`.

---

### Task 0: branch

- [x] Branch `feat/fase-2-economia` criada a partir de `feat/fase-0-1-visual` (ainda não mesclada na `main`; avisar o usuário no fim).

---

### Task 1: lógica da sequência

**Arquivos:**
- Criar: `web/lib/economy/streak.ts`
- Criar: `web/lib/economy/streak.test.ts`

**Interfaces:**
- Produz: `ArcadeonStreak`, `StreakSlot`, `SlotState`, `DEFAULT_STREAK_REWARDS`, `parseStreak(raw: unknown): ArcadeonStreak | null`, `streakSlots(s): StreakSlot[]`, `todayReward(s): number`, `streakHint(s): string`.

- [ ] **Passo 1: teste.** Criar `web/lib/economy/streak.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STREAK_REWARDS, parseStreak, streakHint, streakSlots, todayReward } from "./streak.ts";

const base = { streak: 4, best_streak: 9, counted_today: true, cycle_day: 4, claimed_today: false, rewards: [10, 10, 15, 15, 20, 25, 50] };

test("le o formato do servidor", () => {
  assert.deepEqual(parseStreak(base), {
    streak: 4,
    bestStreak: 9,
    countedToday: true,
    cycleDay: 4,
    claimedToday: false,
    rewards: [10, 10, 15, 15, 20, 25, 50],
  });
});

test("formato inesperado vira null", () => {
  assert.equal(parseStreak(null), null);
  assert.equal(parseStreak("x"), null);
  assert.equal(parseStreak({ ...base, streak: "4" }), null);
  assert.equal(parseStreak({ ...base, cycle_day: 0 }), null);
  assert.equal(parseStreak({ ...base, cycle_day: 8 }), null);
  assert.equal(parseStreak({ ...base, streak: -1 }), null);
});

test("recompensas fora do formato usam as do spec", () => {
  assert.deepEqual(parseStreak({ ...base, rewards: [10, 10] })?.rewards, DEFAULT_STREAK_REWARDS);
  assert.deepEqual(parseStreak({ ...base, rewards: undefined })?.rewards, DEFAULT_STREAK_REWARDS);
  assert.deepEqual(parseStreak({ ...base, rewards: [1, 2, 3, 4, 5, 6, "7"] })?.rewards, DEFAULT_STREAK_REWARDS);
});

test("resgatado implica dia contado e o recorde nunca fica abaixo da sequencia", () => {
  const s = parseStreak({ ...base, counted_today: false, claimed_today: true, best_streak: 2 });
  assert.equal(s?.countedToday, true);
  assert.equal(s?.bestStreak, 4);
});

test("dia contado e nao resgatado fica resgatavel", () => {
  const states = streakSlots(parseStreak(base)!).map((d) => d.state);
  assert.deepEqual(states, ["done", "done", "done", "claimable", "upcoming", "upcoming", "upcoming"]);
});

test("dia ainda nao contado fica esperando", () => {
  const states = streakSlots(parseStreak({ ...base, counted_today: false })!).map((d) => d.state);
  assert.deepEqual(states, ["done", "done", "done", "waiting", "upcoming", "upcoming", "upcoming"]);
});

test("sequencia quebrada nao mostra dia feito", () => {
  const states = streakSlots(parseStreak({ ...base, streak: 0, counted_today: false, cycle_day: 1 })!).map((d) => d.state);
  assert.deepEqual(states, ["waiting", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"]);
});

test("setimo dia contado libera o bau", () => {
  const s = parseStreak({ ...base, streak: 7, cycle_day: 7 })!;
  assert.equal(streakSlots(s)[6].state, "claimable");
  assert.equal(todayReward(s), 50);
});

test("dicas sem culpa", () => {
  assert.equal(streakHint(parseStreak({ ...base, counted_today: false })!), "Termine uma partida hoje pra contar o dia.");
  assert.equal(streakHint(parseStreak(base)!), "Resgate 15 moedas do dia 4.");
  assert.equal(streakHint(parseStreak({ ...base, claimed_today: true })!), "Volte amanhã pro dia 5.");
  assert.equal(
    streakHint(parseStreak({ ...base, streak: 7, cycle_day: 7, claimed_today: true })!),
    "Ciclo completo. Amanhã começa um novo.",
  );
});
```

- [ ] **Passo 2:** `cd web && node --test lib/economy/streak.test.ts`. Esperado: falha com `Cannot find module` (`streak.ts` não existe).

- [ ] **Passo 3: implementação.** Criar `web/lib/economy/streak.ts`:

```ts
/** Valores do ciclo de 7 dias do spec (6.4); o servidor manda os dele em `rewards`. */
export const DEFAULT_STREAK_REWARDS = [10, 10, 15, 15, 20, 25, 50];

export interface ArcadeonStreak {
  streak: number;
  bestStreak: number;
  countedToday: boolean;
  /** posicao de hoje no ciclo, de 1 a 7 */
  cycleDay: number;
  claimedToday: boolean;
  rewards: number[];
}

/** done: dia passado do ciclo; claimable/claimed/waiting: hoje; upcoming: dias seguintes. */
export type SlotState = "done" | "claimable" | "claimed" | "waiting" | "upcoming";

export interface StreakSlot {
  day: number;
  reward: number;
  state: SlotState;
}

function count(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/** Retorno de `get_arcadeon_streak()`. null quando nao da pra confiar no formato. */
export function parseStreak(raw: unknown): ArcadeonStreak | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const streak = count(r.streak);
  const cycleDay = count(r.cycle_day);
  if (streak === null || cycleDay === null || cycleDay < 1 || cycleDay > 7) return null;
  const rewards =
    Array.isArray(r.rewards) && r.rewards.length === 7 && r.rewards.every((n) => count(n) !== null)
      ? (r.rewards as number[])
      : DEFAULT_STREAK_REWARDS;
  const claimedToday = r.claimed_today === true;
  return {
    streak,
    bestStreak: Math.max(count(r.best_streak) ?? 0, streak),
    // so da pra resgatar dia contado; se o servidor mandar os dois desencontrados, vale o resgate
    countedToday: r.counted_today === true || claimedToday,
    cycleDay,
    claimedToday,
    rewards,
  };
}

export function streakSlots(s: ArcadeonStreak): StreakSlot[] {
  return s.rewards.map((reward, i) => {
    const day = i + 1;
    let state: SlotState;
    if (day < s.cycleDay) state = "done";
    else if (day > s.cycleDay) state = "upcoming";
    else if (!s.countedToday) state = "waiting";
    else state = s.claimedToday ? "claimed" : "claimable";
    return { day, reward, state };
  });
}

export function todayReward(s: ArcadeonStreak): number {
  return s.rewards[s.cycleDay - 1];
}

/** Uma frase sobre o que fazer agora. Nunca fala em perder a sequencia. */
export function streakHint(s: ArcadeonStreak): string {
  if (!s.countedToday) return "Termine uma partida hoje pra contar o dia.";
  if (!s.claimedToday) return `Resgate ${todayReward(s)} moedas do dia ${s.cycleDay}.`;
  return s.cycleDay === 7 ? "Ciclo completo. Amanhã começa um novo." : `Volte amanhã pro dia ${s.cycleDay + 1}.`;
}
```

- [ ] **Passo 4:** `cd web && node --test lib/economy/streak.test.ts`. Esperado: `# pass 9`, `# fail 0`.
- [ ] **Passo 5: commit.**

```bash
git add web/lib/economy/streak.ts web/lib/economy/streak.test.ts
git commit -m "feat: regras do calendario da sequencia do Arcadeon"
```

---

### Task 2: lógica das missões e do selo de moedas

**Arquivos:**
- Criar: `web/lib/economy/missions.ts`, `web/lib/economy/missions.test.ts`
- Criar: `web/lib/economy/matchCoins.ts`, `web/lib/economy/matchCoins.test.ts`

**Interfaces:**
- Produz: `Mission`, `DailyMissions`, `parseMissions(raw: unknown): DailyMissions | null`, `missionDone(m): boolean`, `missionPercent(m): number`, `missionsDoneCount(d): number`, `matchCoinsLabel(awarded: number, capped: boolean): string | null`.

- [ ] **Passo 1: testes.** Criar `web/lib/economy/missions.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { missionDone, missionPercent, missionsDoneCount, parseMissions } from "./missions.ts";

const mission = {
  id: "m1",
  game: "drawit",
  kind: "draw_correct_guess",
  text: "Acerte 5 desenhos no Rabiscado",
  target: 5,
  progress: 2,
  reward: 15,
  completed_at: null,
};
const raw = { day: "2026-10-14", missions: [mission], chest: { reward: 30, claimed: false } };

test("le o formato do servidor", () => {
  assert.deepEqual(parseMissions(raw), {
    day: "2026-10-14",
    missions: [
      { id: "m1", game: "drawit", text: "Acerte 5 desenhos no Rabiscado", target: 5, progress: 2, reward: 15, completedAt: null },
    ],
    chest: { reward: 30, claimed: false },
  });
});

test("sem lista ou sem missao valida vira null", () => {
  assert.equal(parseMissions(null), null);
  assert.equal(parseMissions({ day: "2026-10-14" }), null);
  assert.equal(parseMissions({ ...raw, missions: [] }), null);
  assert.equal(parseMissions({ ...raw, missions: [{ ...mission, target: 0 }] }), null);
});

test("missao invalida e descartada, as outras ficam", () => {
  const d = parseMissions({ ...raw, missions: [{ ...mission, text: 3 }, { ...mission, id: "m2" }] });
  assert.deepEqual(d?.missions.map((m) => m.id), ["m2"]);
});

test("jogo desconhecido ou nulo vira null", () => {
  assert.equal(parseMissions({ ...raw, missions: [{ ...mission, game: null }] })?.missions[0].game, null);
});

test("sem bau no retorno vira bau zerado e fechado", () => {
  assert.deepEqual(parseMissions({ ...raw, chest: undefined })?.chest, { reward: 0, claimed: false });
});

test("barra nunca passa de 100", () => {
  const d = parseMissions({ ...raw, missions: [{ ...mission, progress: 9 }] })!;
  assert.equal(missionPercent(d.missions[0]), 100);
  assert.equal(missionDone(d.missions[0]), true);
});

test("porcentagem arredondada e progresso negativo vira zero", () => {
  const d = parseMissions({ ...raw, missions: [{ ...mission, target: 3, progress: 1 }, { ...mission, id: "m2", progress: -4 }] })!;
  assert.equal(missionPercent(d.missions[0]), 33);
  assert.equal(missionPercent(d.missions[1]), 0);
});

test("completed_at conta como feita mesmo com progresso baixo", () => {
  const d = parseMissions({
    ...raw,
    missions: [{ ...mission, completed_at: "2026-10-14T20:00:00Z" }, { ...mission, id: "m2" }],
  })!;
  assert.equal(missionsDoneCount(d), 1);
  assert.equal(missionPercent(d.missions[0]), 100);
});
```

Criar `web/lib/economy/matchCoins.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchCoinsLabel } from "./matchCoins.ts";

test("moedas ganhas", () => {
  assert.equal(matchCoinsLabel(15, false), "+15 moedas");
  assert.equal(matchCoinsLabel(1, false), "+1 moeda");
});

test("limite cortou parte do pagamento", () => {
  assert.equal(matchCoinsLabel(5, true), "+5 moedas, limite de hoje atingido");
});

test("limite cortou tudo", () => {
  assert.equal(matchCoinsLabel(0, true), "Limite de moedas de hoje atingido");
});

test("partida sem pagamento nao mostra nada", () => {
  assert.equal(matchCoinsLabel(0, false), null);
  assert.equal(matchCoinsLabel(-3, false), null);
  assert.equal(matchCoinsLabel(Number.NaN, false), null);
});
```

- [ ] **Passo 2:** `cd web && node --test lib/economy/missions.test.ts lib/economy/matchCoins.test.ts`. Esperado: falha com `Cannot find module`.

- [ ] **Passo 3: implementação.** Criar `web/lib/economy/missions.ts`:

```ts
const GAMES = ["termo", "buggle", "drawit", "corrida"];

export interface Mission {
  id: string;
  /** slug do jogo, ou null pra missao de qualquer jogo */
  game: string | null;
  text: string;
  target: number;
  progress: number;
  reward: number;
  completedAt: string | null;
}

export interface DailyMissions {
  day: string;
  missions: Mission[];
  chest: { reward: number; claimed: boolean };
}

function nonNegative(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseMission(raw: unknown): Mission | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const target = nonNegative(m.target);
  if (typeof m.id !== "string" || typeof m.text !== "string" || target === 0) return null;
  return {
    id: m.id,
    game: typeof m.game === "string" && GAMES.includes(m.game) ? m.game : null,
    text: m.text,
    target,
    progress: nonNegative(m.progress),
    reward: nonNegative(m.reward),
    completedAt: typeof m.completed_at === "string" ? m.completed_at : null,
  };
}

/** Retorno de `get_daily_missions()`. null quando nao sobra nenhuma missao valida. */
export function parseMissions(raw: unknown): DailyMissions | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.missions)) return null;
  const missions = r.missions.map(parseMission).filter((m): m is Mission => m !== null);
  if (missions.length === 0) return null;
  const chest = (r.chest && typeof r.chest === "object" ? r.chest : {}) as Record<string, unknown>;
  return {
    day: typeof r.day === "string" ? r.day : "",
    missions,
    chest: { reward: nonNegative(chest.reward), claimed: chest.claimed === true },
  };
}

export function missionDone(m: Mission): boolean {
  return m.completedAt !== null || m.progress >= m.target;
}

export function missionPercent(m: Mission): number {
  if (missionDone(m)) return 100;
  return Math.round((Math.min(m.progress, m.target) / m.target) * 100);
}

export function missionsDoneCount(d: DailyMissions): number {
  return d.missions.filter(missionDone).length;
}
```

Criar `web/lib/economy/matchCoins.ts`:

```ts
/** Texto do selo da tela de resultado. null quando a partida nao paga (menos de 2 logados). */
export function matchCoinsLabel(awarded: number, capped: boolean): string | null {
  const n = Number.isFinite(awarded) ? Math.max(0, Math.floor(awarded)) : 0;
  const coins = n === 1 ? "+1 moeda" : `+${n} moedas`;
  if (n > 0 && capped) return `${coins}, limite de hoje atingido`;
  if (n > 0) return coins;
  return capped ? "Limite de moedas de hoje atingido" : null;
}
```

- [ ] **Passo 4:** `cd web && node --test lib/economy/missions.test.ts lib/economy/matchCoins.test.ts`. Esperado: `# pass 12`, `# fail 0`.
- [ ] **Passo 5:** `cd web && npm test`. Esperado: tudo passando (24 da fase 0-1 + 21 novos).
- [ ] **Passo 6: commit.**

```bash
git add web/lib/economy/missions.ts web/lib/economy/missions.test.ts web/lib/economy/matchCoins.ts web/lib/economy/matchCoins.test.ts
git commit -m "feat: regras das missoes do dia e do selo de moedas da partida"
```

---

### Task 3: API da economia e `refreshProfile` estável

**Arquivos:**
- Criar: `web/lib/economy/api.ts`
- Modificar: `web/lib/auth/AuthProvider.tsx`

**Interfaces:**
- Consome: `parseStreak`, `parseMissions` (Tasks 1 e 2), `createOnce` de `web/lib/home/dailyCache.ts`.
- Produz: `fetchArcadeonStreak(): Promise<ArcadeonStreak | null>`, `getArcadeonStreakShared(key: string): Promise<ArcadeonStreak | null>`, `fetchDailyMissions(): Promise<DailyMissions | null>`, `claimStreakReward(): Promise<{ coinsAwarded: number; coins: number }>` (lança `Error` com a mensagem do servidor). `refreshProfile` passa a ter identidade estável entre renders.

- [ ] **Passo 1: API.** Criar `web/lib/economy/api.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
import { createOnce } from "@/lib/home/dailyCache";
import { parseStreak, type ArcadeonStreak } from "./streak";
import { parseMissions, type DailyMissions } from "./missions";

/** Leitura que nunca lanca: RPC que ainda nao existe (404) ou rede fora viram null. */
async function readRpc(name: string): Promise<unknown> {
  try {
    const { data, error } = await createClient().rpc(name);
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function fetchArcadeonStreak(): Promise<ArcadeonStreak | null> {
  return parseStreak(await readRpc("get_arcadeon_streak"));
}

/** Home e coluna lateral montam juntas: uma requisicao so. */
export const getArcadeonStreakShared = createOnce(fetchArcadeonStreak);

export async function fetchDailyMissions(): Promise<DailyMissions | null> {
  return parseMissions(await readRpc("get_daily_missions"));
}

export async function claimStreakReward(): Promise<{ coinsAwarded: number; coins: number }> {
  const { data, error } = await createClient().rpc("claim_streak_reward");
  // o servidor manda as mensagens em portugues, prontas pra mostrar
  if (error) throw new Error(error.message || "Não deu pra resgatar agora. Tente de novo.");
  const d = (data ?? {}) as { coins_awarded?: unknown; coins?: unknown };
  return { coinsAwarded: Number(d.coins_awarded) || 0, coins: Number(d.coins) || 0 };
}
```

- [ ] **Passo 2: `refreshProfile` estável.** Em `web/lib/auth/AuthProvider.tsx`:
  - trocar o import da primeira linha de React por `import { createContext, useCallback, useContext, useEffect, useState } from "react";`
  - substituir a função `refreshProfile` inteira por:

```tsx
  const userId = session?.user?.id ?? null;
  // estavel entre renders: componentes chamam dentro de efeitos sem entrar em laco
  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("username, coins, equipped_avatar_id, avatars:equipped_avatar_id(*)")
      .eq("id", userId)
      .single();
    setUsername(data?.username ?? null);
    setCoins(data?.coins ?? 0);
    setEquippedAvatar((data?.avatars as unknown as Avatar) ?? null);
  }, [userId]);
```

- [ ] **Passo 3:** `cd web && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Passo 4:** `cd web && npx eslint lib/economy lib/auth`. Esperado: nenhum erro novo (comparar com `git stash`-free: rodar `git diff --stat` e conferir que os avisos citam só linhas que já existiam).
- [ ] **Passo 5: commit.**

```bash
git add web/lib/economy/api.ts web/lib/auth/AuthProvider.tsx
git commit -m "feat: chamadas da economia que falham em silencio e refreshProfile estavel"
```

---

### Task 4: sessão falsa pra ver telas logadas

As telas desta fase só aparecem logado e o banco ainda não tem as RPCs. Esta task monta, **fora do repositório**, um jeito de abrir o site no Playwright como se houvesse login, com as respostas do Supabase simuladas. Nada aqui é commitado.

**Arquivos:**
- Criar: `<scratchpad>/fake-session.js` (diretório de rascunho da sessão)

- [ ] **Passo 1: descobrir a referência do projeto.** `grep NEXT_PUBLIC_SUPABASE_URL web/.env.local` (ou `../web/.env.local` do repositório principal, se a worktree não tiver o arquivo). A referência é o primeiro pedaço do host: em `https://abcd1234.supabase.co`, `abcd1234`.

- [ ] **Passo 2: script.** Criar `<scratchpad>/fake-session.js`, trocando `REF` pela referência:

```js
async (page) => {
  const REF = "REF";
  const API = `https://${REF}.supabase.co`;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "teste@arcadeon.dev",
    created_at: "2026-01-10T12:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
  };
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, role: "authenticated", aud: "authenticated", exp: now + 86400 })}.x`;
  const session = { access_token: jwt, refresh_token: "falso", token_type: "bearer", expires_in: 86400, expires_at: now + 86400, user };
  await page.context().addCookies([
    { name: `sb-${REF}-auth-token`, value: "base64-" + b64(session), domain: "localhost", path: "/" },
  ]);

  // respostas por caminho; editar FIXTURES pra testar cada estado
  const FIXTURES = {
    "/rest/v1/profiles": { username: "raposa", coins: 245, equipped_avatar_id: null, avatars: null },
    "/rest/v1/rpc/get_arcadeon_streak": { streak: 4, best_streak: 9, counted_today: true, cycle_day: 4, claimed_today: false, rewards: [10, 10, 15, 15, 20, 25, 50] },
    "/rest/v1/rpc/claim_streak_reward": { coins_awarded: 15, coins: 260 },
    "/rest/v1/rpc/get_daily_missions": {
      day: "2026-10-14",
      missions: [
        { id: "m1", game: "drawit", kind: "draw_correct_guess", text: "Acerte 5 desenhos no Rabiscado", target: 5, progress: 2, reward: 15, completed_at: null },
        { id: "m2", game: "termo", kind: "termo_win", text: "Vença o Letrado de hoje", target: 1, progress: 1, reward: 10, completed_at: "2026-10-14T13:00:00Z" },
        { id: "m3", game: null, kind: "play_any", text: "Termine 3 partidas em qualquer jogo", target: 3, progress: 0, reward: 10, completed_at: null },
      ],
      chest: { reward: 30, claimed: false },
    },
  };
  globalThis.__FIXTURES = FIXTURES;
  await page.route(`${API}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/auth/v1/user")) return route.fulfill({ json: user });
    const key = Object.keys(globalThis.__FIXTURES).find((k) => path.startsWith(k));
    if (key) return route.fulfill({ json: globalThis.__FIXTURES[key] });
    if (path.startsWith("/rest/v1/rpc/")) return route.fulfill({ status: 404, json: { code: "PGRST202", message: "not found" } });
    return route.fulfill({ json: [] });
  });
  return "sessao falsa pronta";
}
```

- [ ] **Passo 3: confirmar que funciona.** Com o `next dev` na porta 3100: rodar o script com `browser_run_code_unsafe`, navegar pra `http://localhost:3100/profile` e tirar print. Esperado: perfil de "raposa" com 245 moedas (não o "Seu perfil fica aqui").
  - Se o perfil não aparecer: ler `node_modules/@supabase/ssr/dist/module/cookies.js` (nome e codificação do cookie) e `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` (`getSession`/`__loadSession`) e ajustar o script. Registrar o ajuste como ruling no ledger.
  - Se mesmo assim não der em 30 min de investigação: registrar ruling "telas logadas verificadas só por tsc, testes e build" e seguir.
- [ ] **Passo 4:** sem commit. Anotar no ledger o caminho do script pra Tasks 5 a 8 e pro plano da fase 4.

---

### Task 5: home — missões e sequência

**Arquivos:**
- Criar: `web/components/economy/useArcadeonStreak.ts`
- Criar: `web/components/economy/StreakCalendar.tsx`
- Criar: `web/components/economy/MissionsCard.tsx`
- Criar: `web/components/home/HomeDaily.tsx`
- Modificar: `web/app/(hub)/page.tsx`
- Modificar: `web/components/home/HomeAside.tsx`

**Interfaces:**
- Consome: Task 3 (`getArcadeonStreakShared`, `fetchDailyMissions`, `claimStreakReward`), Tasks 1 e 2, `formatCountdown`/`msUntilBrasiliaMidnight` de `web/lib/time.ts`, `useAuth`.
- Produz: `useArcadeonStreak(): { streak: ArcadeonStreak | null; loading: boolean; claiming: boolean; error: string | null; claim: () => Promise<void> }`, `<StreakCalendar streak={...} claiming error onClaim />`, `<MissionsCard missions={...} />`, `<HomeDaily />`.

- [ ] **Passo 1: hook.** Criar `web/components/economy/useArcadeonStreak.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { claimStreakReward, getArcadeonStreakShared } from "@/lib/economy/api";
import type { ArcadeonStreak } from "@/lib/economy/streak";

/** Sequencia do Arcadeon do usuario logado. streak null = sem conta ou RPC ainda nao existe. */
export function useArcadeonStreak() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const userId = user?.id ?? null;
  const [streak, setStreak] = useState<ArcadeonStreak | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !userId) return;
    let alive = true;
    getArcadeonStreakShared(userId).then((s) => {
      if (!alive) return;
      setStreak(s);
      setLoadedFor(userId);
    });
    return () => {
      alive = false;
    };
  }, [authLoading, userId]);

  const claim = useCallback(async () => {
    if (!userId || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      await claimStreakReward();
      const [fresh] = await Promise.all([getArcadeonStreakShared(userId), refreshProfile()]);
      setStreak(fresh);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setClaiming(false);
    }
  }, [userId, claiming, refreshProfile]);

  // trocou de conta: o valor antigo nao vale ate a busca nova voltar
  const current = loadedFor === userId ? streak : null;
  return { streak: current, loading: !!userId && loadedFor !== userId, claiming, error, claim };
}
```

- [ ] **Passo 2: calendário.** Criar `web/components/economy/StreakCalendar.tsx`:

```tsx
"use client";

import { Check, Coins, Flame, Gift } from "lucide-react";
import { streakHint, streakSlots, todayReward, type ArcadeonStreak, type SlotState } from "@/lib/economy/streak";

const SLOT: Record<SlotState, string> = {
  done: "border-transparent bg-[var(--primary-tint)] text-[var(--primary)]",
  claimed: "border-transparent bg-[var(--primary)] text-white",
  claimable: "border-[var(--primary)] bg-[var(--card)] text-[var(--primary)]",
  waiting: "border-dashed border-[var(--border-hover)] bg-[var(--card)] text-[var(--fg)]",
  upcoming: "border-transparent bg-[var(--bg)] text-[var(--fg-muted)]",
};

const SLOT_LABEL: Record<SlotState, string> = {
  done: "feito",
  claimed: "resgatado",
  claimable: "pronto pra resgatar",
  waiting: "hoje, falta terminar uma partida",
  upcoming: "ainda vem",
};

/** Ciclo de 7 dias da sequencia do Arcadeon, com o resgate do dia. */
export function StreakCalendar({
  streak,
  claiming,
  error,
  onClaim,
}: {
  streak: ArcadeonStreak;
  claiming: boolean;
  error: string | null;
  onClaim: () => void;
}) {
  const slots = streakSlots(streak);
  const claimable = slots.some((s) => s.state === "claimable");

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Sequência</p>
        <p className="flex items-center gap-1 text-sm font-bold tabular-nums text-[var(--fg)]">
          <Flame className="h-4 w-4 text-[var(--primary)]" aria-hidden />
          {streak.streak} {streak.streak === 1 ? "dia" : "dias"}
        </p>
      </div>

      <ol className="grid grid-cols-7 gap-1.5">
        {slots.map((slot) => (
          <li
            key={slot.day}
            aria-label={`Dia ${slot.day}, ${slot.reward} moedas, ${SLOT_LABEL[slot.state]}`}
            className={`flex aspect-[3/4] flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-xs font-extrabold tabular-nums ${SLOT[slot.state]}`}
          >
            {slot.state === "done" || slot.state === "claimed" ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : slot.day === 7 ? (
              <Gift className="h-4 w-4" aria-hidden />
            ) : (
              <span aria-hidden>{slot.day}</span>
            )}
            <span aria-hidden className="text-[0.65rem] font-bold opacity-80">
              {slot.reward}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-sm text-[var(--fg-muted)]">{streakHint(streak)}</p>

      {claimable && (
        <button
          type="button"
          onClick={onClaim}
          disabled={claiming}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2 disabled:cursor-wait disabled:opacity-70"
        >
          <Coins className="h-4 w-4" aria-hidden />
          {claiming ? "Resgatando..." : `Resgatar ${todayReward(streak)} moedas`}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      )}
      <p className="text-xs text-[var(--fg-muted)]">Recorde: {streak.bestStreak} {streak.bestStreak === 1 ? "dia" : "dias"}</p>
    </div>
  );
}
```

- [ ] **Passo 3: missões.** Criar `web/components/economy/MissionsCard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Check, Gamepad2, Gift } from "lucide-react";
import { missionDone, missionPercent, missionsDoneCount, type DailyMissions } from "@/lib/economy/missions";
import { formatCountdown, msUntilBrasiliaMidnight } from "@/lib/time";

/** Tres missoes do dia; cada uma paga sozinha ao completar, e as tres juntas abrem o bau. */
export function MissionsCard({ missions }: { missions: DailyMissions }) {
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilBrasiliaMidnight(Date.now())));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const done = missionsDoneCount(missions);
  const total = missions.missions.length;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Missões de hoje</p>
        {countdown && <p className="text-xs font-medium text-[var(--fg-muted)]">Novas em {countdown}</p>}
      </div>

      <ul className="flex flex-col gap-3">
        {missions.missions.map((m) => {
          const finished = missionDone(m);
          const pct = missionPercent(m);
          return (
            <li key={m.id} className="flex items-center gap-3">
              {m.game ? (
                <span className={`pattern-${m.game} h-9 w-9 shrink-0 rounded-xl`} aria-hidden />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]" aria-hidden>
                  <Gamepad2 className="h-5 w-5" />
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-sm font-bold ${finished ? "text-[var(--fg-muted)]" : "text-[var(--fg)]"}`}>{m.text}</p>
                  <span className="shrink-0 text-xs font-extrabold tabular-nums text-[var(--primary)]">
                    {finished ? <Check className="inline h-4 w-4" aria-label="feita" /> : `+${m.reward}`}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={m.text}
                  aria-valuemin={0}
                  aria-valuemax={m.target}
                  aria-valuenow={Math.min(m.progress, m.target)}
                  aria-valuetext={`${Math.min(m.progress, m.target)} de ${m.target}`}
                  className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
                >
                  <div className="h-full rounded-full bg-[var(--primary)] transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {missions.chest.reward > 0 && (
        <p className="flex items-center gap-2 border-t-2 border-[var(--border)] pt-3 text-sm text-[var(--fg-muted)]">
          <Gift className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
          {missions.chest.claimed
            ? `Baú aberto: +${missions.chest.reward} moedas`
            : `Complete as ${total} pra abrir o baú de +${missions.chest.reward} (${done} de ${total})`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Passo 4: linha da home.** Criar `web/components/home/HomeDaily.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchDailyMissions } from "@/lib/economy/api";
import { missionsDoneCount, type DailyMissions } from "@/lib/economy/missions";
import { MissionsCard } from "@/components/economy/MissionsCard";
import { StreakCalendar } from "@/components/economy/StreakCalendar";
import { useArcadeonStreak } from "@/components/economy/useArcadeonStreak";

/** Missoes e sequencia, logo abaixo do destaque. Some sem conta ou enquanto o banco nao tem as RPCs. */
export function HomeDaily() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const userId = user?.id ?? null;
  const { streak, loading: streakLoading, claiming, error, claim } = useArcadeonStreak();
  const [missions, setMissions] = useState<DailyMissions | null>(null);
  const [missionsFor, setMissionsFor] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !userId) return;
    let alive = true;
    fetchDailyMissions().then((m) => {
      if (!alive) return;
      setMissions(m);
      setMissionsFor(userId);
      // missao paga sozinha no servidor; com alguma feita, o saldo do header pode estar velho
      if (m && missionsDoneCount(m) > 0) refreshProfile();
    });
    return () => {
      alive = false;
    };
  }, [authLoading, userId, refreshProfile]);

  if (authLoading || !userId) return null;

  const currentMissions = missionsFor === userId ? missions : null;
  if (streakLoading || missionsFor !== userId) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-hidden>
        <div className="skeleton h-44 rounded-3xl" />
        <div className="skeleton h-44 rounded-3xl" />
      </div>
    );
  }
  if (!currentMissions && !streak) return null;

  const calendar = streak && <StreakCalendar streak={streak} claiming={claiming} error={error} onClaim={claim} />;
  if (!currentMissions) return <div className="lg:w-1/3">{calendar}</div>;
  if (!streak) return <MissionsCard missions={currentMissions} />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <MissionsCard missions={currentMissions} />
      {calendar}
    </div>
  );
}
```

- [ ] **Passo 5: encaixe na home.** Em `web/app/(hub)/page.tsx`:
  - import: `import { HomeDaily } from "@/components/home/HomeDaily";`
  - logo depois do `<div className="animate-fade-up">` que envolve `<HomeFeature />`:

```tsx
      <div className="animate-fade-up">
        <HomeFeature />
      </div>
      <HomeDaily />
```

- [ ] **Passo 6: uma chama só.** Em `web/components/home/HomeAside.tsx`, a chama hoje mostra a sequência do Letrado. Com a sequência do Arcadeon na linha de baixo, mostrar as duas confunde. Trocar:
  - import: `import { getArcadeonStreakShared } from "@/lib/economy/api";`
  - dentro do `useEffect`, antes de `getDailyStatusShared(...)`, envolver a busca da sequência do Letrado:

```tsx
    // a chama e da sequencia do Letrado so enquanto o Arcadeon nao tem a dele (fase 2)
    getArcadeonStreakShared(user.id).then((arcadeon) => {
      if (!alive || arcadeon) return;
      getDailyStatusShared(user.id)
        .then((s) => alive && setStreak(s.currentStreak))
        .catch(() => alive && setStreak(null));
    });
```

  e apagar as três linhas antigas de `getDailyStatusShared(user.id).then(...).catch(...)`.

- [ ] **Passo 7:** `cd web && npx tsc --noEmit && npm test`. Esperado: sem erros, testes passando.
- [ ] **Passo 8: verificação visual com a sessão falsa (Task 4).** Para cada estado, ajustar `__FIXTURES` com `browser_evaluate`/`browser_run_code_unsafe`, recarregar `http://localhost:3100/` e tirar print em 1440 e 390, claro e escuro:
  1. dia contado e não resgatado (fixture padrão): botão "Resgatar 15 moedas"; clicar → botão vira "Resgatando...", depois o header mostra 260 (mudar a fixture de `profiles` pra `coins: 260` e a de streak pra `claimed_today: true` antes do clique).
  2. dia não contado: slot 4 tracejado, "Termine uma partida hoje pra contar o dia.", sem botão.
  3. resgate com erro: `claim_streak_reward` → `route.fulfill({ status: 400, json: { message: "A recompensa de hoje já foi resgatada" } })`; a frase aparece em vermelho no cartão.
  4. RPCs de missão e sequência ausentes (apagar as chaves): a linha some e a chama do Letrado volta na coluna.
  5. só missões (apagar a chave da sequência): cartão de missões ocupa a largura toda.
  6. teclado: Tab chega no botão de resgate com anel de foco visível.
  7. deslogado (sem o script): nada novo na home.
- [ ] **Passo 9:** conferir contra **frontend-design** e **design-taste-frontend**: hierarquia, caixa normal, estado vazio e carregando.
- [ ] **Passo 10: commit.**

```bash
git add web/components/economy/useArcadeonStreak.ts web/components/economy/StreakCalendar.tsx web/components/economy/MissionsCard.tsx web/components/home/HomeDaily.tsx web/app/(hub)/page.tsx web/components/home/HomeAside.tsx
git commit -m "feat: missoes do dia e sequencia do Arcadeon na home"
```

---

### Task 6: calendário no perfil

**Arquivos:**
- Modificar: `web/components/profile/ProfilePageContent.tsx`

**Interfaces:**
- Consome: `useArcadeonStreak`, `StreakCalendar` (Task 5).

- [ ] **Passo 1:** em `ProfilePageContent.tsx`:
  - imports: `import { StreakCalendar } from "@/components/economy/StreakCalendar";` e `import { useArcadeonStreak } from "@/components/economy/useArcadeonStreak";`
  - primeira linha do corpo de `ProfilePageContent`, junto dos outros hooks (antes de qualquer `return`): `const { streak, claiming, error: streakError, claim } = useArcadeonStreak();`
  - entre a `<section>` do cabeçalho do perfil e a `<section>` do inventário:

```tsx
      {streak && (
        <section className="flex flex-col gap-3 sm:max-w-md">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--fg)]">Sequência do Arcadeon</h2>
          <StreakCalendar streak={streak} claiming={claiming} error={streakError} onClaim={claim} />
        </section>
      )}
```

- [ ] **Passo 2:** `cd web && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Passo 3:** sessão falsa em `/profile`, prints 1440/390 claro/escuro; sem a RPC, a seção some.
- [ ] **Passo 4: commit.**

```bash
git add web/components/profile/ProfilePageContent.tsx
git commit -m "feat: calendario da sequencia no perfil"
```

---

### Task 7: selo de moedas da partida

**Arquivos:**
- Criar: `web/components/economy/MatchCoins.tsx`

**Interfaces:**
- Consome: `matchCoinsLabel` (Task 2), `useAuth().refreshProfile` (Task 3).
- Produz: `<MatchCoins awarded={number} capped={boolean} />` — usado pelas sessões dos jogos na tela de resultado (pedido "Fase 2 nos jogos" no vault).

- [ ] **Passo 1:** criar `web/components/economy/MatchCoins.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { Coins } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { matchCoinsLabel } from "@/lib/economy/matchCoins";

/**
 * Selo ao lado do proprio nome na tela de resultado, com o retorno do evento `coins-awarded`.
 * Atualiza o saldo do header ao aparecer.
 */
export function MatchCoins({ awarded, capped }: { awarded: number; capped: boolean }) {
  const { refreshProfile } = useAuth();
  const label = matchCoinsLabel(awarded, capped);

  useEffect(() => {
    if (awarded > 0) refreshProfile();
  }, [awarded, refreshProfile]);

  if (!label) return null;
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${
        awarded > 0 ? "bg-[var(--primary-tint)] text-[var(--primary)]" : "bg-[var(--bg)] text-[var(--fg-muted)]"
      }`}
    >
      <Coins className="h-3.5 w-3.5" aria-hidden /> {label}
    </span>
  );
}
```

- [ ] **Passo 2:** `cd web && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Passo 3: ver o selo.** Sem arquivo novo no repositório: com a sessão falsa, renderizar temporariamente `<MatchCoins awarded={15} capped={false} />`, `<MatchCoins awarded={5} capped />` e `<MatchCoins awarded={0} capped />` no topo de `HomeDaily`, tirar print claro/escuro e **desfazer** a mudança antes do commit (`git diff web/components/home/HomeDaily.tsx` vazio).
- [ ] **Passo 4: commit.**

```bash
git add web/components/economy/MatchCoins.tsx
git commit -m "feat: selo de moedas da partida para a tela de resultado dos jogos"
```

---

### Task 8: fechamento

- [ ] **Passo 1:** `cd web && npm test && npx tsc --noEmit && npx next build`. Esperado: tudo passando; build sem erro.
- [ ] **Passo 2:** `cd web && npx eslint` e comparar com os 20 erros antigos: nenhum erro novo em arquivo desta fase.
- [ ] **Passo 3:** Supabase MCP `list_tables`: anotar no handoff quais pedidos da fase 2 já existem no banco.
- [ ] **Passo 4: vault.** Em `Frontend/Handoff-Frontend.md`, seção "2026-10-14: fase 2, telas da economia": o que entrou, o que espera o Servidor, o caminho do script da sessão falsa (e que ele fica fora do repositório). Nos pedidos da fase 2, nada muda de status (quem muda é o Servidor).
- [ ] **Passo 5:** revisão final da branch inteira (subagente novo, modelo mais capaz), com este plano, o spec e as rulings do ledger.
