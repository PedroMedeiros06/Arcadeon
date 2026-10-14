# Fases 0 e 1: medição e visual — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para seguir este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** registrar a visita ao hub (fase 0) e entregar os 8 itens visuais aprovados (fase 1), sem tocar no servidor nem no banco.

**Arquitetura:** a lógica que pode errar (deduplicação, contagem regressiva, posição no ranking, código de sala) fica em módulos puros em `web/lib/`, testados com `node --test`. Os componentes React só consomem esses módulos. Tudo que depende de banco ou servidor vira pedido no vault e o front falha em silêncio até o pedido ser atendido.

**Tecnologia:** Next.js 16 (App Router), React 19, Tailwind 4, lucide-react, Supabase JS, `node --test` nativo do Node 24 (sem dependência nova).

**Spec:** `docs/superpowers/specs/2026-10-12-arcadeon-escopo-final-design.md` (seções 4 e 5).

## Restrições globais

- A sessão Frontend nunca edita `server/`, migrations ou o banco. Necessidades de banco e servidor viram pedidos em `C:\Users\pedro\Documents\Obsidian Vault\ClaudeContexts\Arcadeon\Comunicacao\Pedidos-ao-Servidor.md`.
- Arquivos dos jogos (`components/termo|buggle|draw|race`, `app/games/*`, `lib/termo|buggle|draw|race`) são das sessões de cada jogo. Mudança lá vira pedido no vault, nunca edição.
- Commits só por caminho (`git add <arquivos>`), nunca `git add -A` ou `.`. Mensagem em português, prosa normal, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comentários no código em português sem acento, no estilo do repositório.
- Nenhuma dependência nova.
- Textos de interface em caixa normal (sem `uppercase`), voz ativa, botões dizem o que acontece.
- Dia do Arcadeon = dia de Brasília (UTC−3 fixo, sem horário de verão), mesma regra de `termo_today()`.
- Tudo que se move respeita `prefers-reduced-motion`.
- Larguras máximas: placares e loja em `max-w-6xl`.

## Foco da revisão

1. `localStorage` bloqueado (aba anônima do Safari) ou com valor corrompido: `logActivity` e a deduplicação não podem lançar erro nem travar a página. Teste na Task 2.
2. Virada do dia e fuso: alguém em Lisboa ou em Manaus às 23h50 vê a contagem até a meia-noite de Brasília, nunca negativa. Teste na Task 5.
3. Usuário logado fora do top 100: a coluna mostra "Ver ranking", nunca "#0" ou "#-1". Teste na Task 4.
4. Código de sala digitado com minúsculas, espaços, hífen ou letras ambíguas (`O`/`0`, `I`/`1`): é normalizado antes da busca; código inválido não chega ao servidor. Teste na Task 11.
5. Carrossel só no teclado: dá para escolher qualquer destaque com Tab + Enter e o foco fica visível. Verificado com Playwright na Task 12.

## Uso de skills e MCPs (pedido do usuário)

- **superpowers:test-driven-development** em toda função pura.
- **frontend-design** e **design-taste-frontend** nas tasks visuais (3 a 10): conferir hierarquia, sentence case e estados vazio/carregando contra as skills antes do commit.
- **Playwright MCP**: prints em 1440 px e 390 px, claro e escuro, ao fim de cada task visual (salvar em `.playwright-mcp/`).
- **Supabase MCP** só leitura (`list_tables`, `execute_sql` com `select`, `get_advisors`) para conferir se os pedidos do Servidor já foram atendidos. Nunca `apply_migration`.
- **superpowers:verification-before-completion** e **code-review** na Task 12.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `web/lib/activityDedupe.ts` (novo) | `shouldLog` puro, sem imports |
| `web/lib/activity.ts` (novo) | `logActivity(game)` |
| `web/lib/activity.test.ts` (novo) | testes da deduplicação |
| `web/components/ActivityPing.tsx` (novo) | chama `logActivity("hub")` uma vez no layout do hub |
| `web/lib/home/rank.ts` (novo) | `rankFor` puro |
| `web/lib/home/dailyCache.ts` (novo) | uma busca do status diário por usuário, compartilhada |
| `web/lib/time.ts` (novo) | `msUntilBrasiliaMidnight`, `formatCountdown` |
| `web/lib/joinCode.ts` (novo) | `normalizeCode`, `joinTarget` |
| `web/components/home/HomeAside.tsx` (novo) | coluna direita da home |
| `web/components/home/JoinByCode.tsx` (novo) | campo "Entrar com código" |
| `web/components/SidebarDaily.tsx` (novo) | rodapé útil da barra lateral |
| `web/app/icon.tsx`, `web/app/apple-icon.tsx` (novos) | ícone quadrado |
| `web/app/globals.css` | `.pattern-*`, `.skeleton` |
| `web/components/home/FeatureCarousel.tsx`, `HomeFeature.tsx`, `GameCard.tsx`, `Sidebar.tsx` | itens 1, 2, 3, 7 |
| `web/components/leaderboard/LeaderboardPageContent.tsx`, `app/(hub)/leaderboard/page.tsx` | item 5 |
| `web/components/shop/ShopPageContent.tsx`, `app/(hub)/shop/page.tsx` | item 6 |
| `web/lib/ogImage.tsx`, `web/app/manifest.ts`, `web/app/layout.tsx` | item 8 |

---

### Task 1: infraestrutura de testes

**Arquivos:**
- Modificar: `web/package.json` (scripts)
- Modificar: `web/tsconfig.json` (compilerOptions)
- Criar: `web/lib/smoke.test.ts` (apagado no fim da task)

- [ ] **Passo 1: script de teste.** Em `web/package.json`, dentro de `scripts`, depois de `"lint": "eslint"`:

```json
    "lint": "eslint",
    "test": "node --test \"lib/**/*.test.ts\""
```

- [ ] **Passo 2: permitir import com `.ts`.** Em `web/tsconfig.json`, depois de `"noEmit": true,`:

```json
    "noEmit": true,
    "allowImportingTsExtensions": true,
```

Motivo: o Node 24 roda `.ts` direto, mas exige a extensão no import relativo. Os testes importam `./activity.ts`. Módulos testados **não** podem usar o alias `@/` (o Node não o resolve).

- [ ] **Passo 3: teste de fumaça.** Criar `web/lib/smoke.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("node --test roda TypeScript", () => {
  const n: number = 1 + 1;
  assert.equal(n, 2);
});
```

- [ ] **Passo 4:** `cd web && npm test`. Esperado: `# pass 1`, `# fail 0`.
- [ ] **Passo 5:** `cd web && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Passo 6:** apagar `web/lib/smoke.test.ts`.
- [ ] **Passo 7: commit.**

```bash
git add web/package.json web/tsconfig.json
git commit -m "chore: script de teste com node --test nativo"
```

---

### Task 2: fase 0, registro de atividade

**Arquivos:**
- Criar: `web/lib/activityDedupe.ts`, `web/lib/activity.ts`, `web/lib/activity.test.ts`, `web/components/ActivityPing.tsx`
- Modificar: `web/app/(hub)/layout.tsx`
- Vault: `Pedidos-ao-Servidor.md` e os pedidos para as sessões dos jogos

**Interfaces:**
- Produz: `type ActivityGame = "hub" | "termo" | "buggle" | "drawit" | "corrida"`, `shouldLog(raw: string | null, game: ActivityGame, now: number): { log: boolean; next: string }`, `logActivity(game: ActivityGame): Promise<void>`.
- Consome: RPC `log_activity(p_game text, p_anon_key text)` (pedido ao Servidor; até existir, a chamada falha em silêncio).

- [ ] **Passo 1: teste que falha.** Criar `web/lib/activity.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldLog, DEDUPE_MS } from "./activityDedupe.ts";

const T0 = 1_760_000_000_000;

test("primeira chamada registra e guarda o horario", () => {
  const r = shouldLog(null, "hub", T0);
  assert.equal(r.log, true);
  assert.deepEqual(JSON.parse(r.next), { hub: T0 });
});

test("dentro de 10 minutos nao registra de novo", () => {
  const first = shouldLog(null, "hub", T0);
  const r = shouldLog(first.next, "hub", T0 + DEDUPE_MS - 1);
  assert.equal(r.log, false);
});

test("depois de 10 minutos registra de novo", () => {
  const first = shouldLog(null, "hub", T0);
  assert.equal(shouldLog(first.next, "hub", T0 + DEDUPE_MS).log, true);
});

test("jogos diferentes nao se bloqueiam", () => {
  const first = shouldLog(null, "hub", T0);
  const r = shouldLog(first.next, "termo", T0 + 1000);
  assert.equal(r.log, true);
  assert.deepEqual(JSON.parse(r.next), { hub: T0, termo: T0 + 1000 });
});

test("valor corrompido no storage e tratado como vazio", () => {
  for (const bad of ["{", "null", "[]", '"x"', '{"hub":"ontem"}']) {
    assert.equal(shouldLog(bad, "hub", T0).log, true, bad);
  }
});

test("relogio que voltou no tempo registra", () => {
  const first = shouldLog(null, "hub", T0);
  assert.equal(shouldLog(first.next, "hub", T0 - 60_000).log, true);
});
```

- [ ] **Passo 2:** `cd web && npm test`. Esperado: FAIL, `Cannot find module './activityDedupe.ts'`.

- [ ] **Passo 3: implementação pura.** O Node não resolve import relativo sem extensão nem o alias `@/`, então a parte testada fica num arquivo sem imports. Criar `web/lib/activityDedupe.ts`:

```ts
export type ActivityGame = "hub" | "termo" | "buggle" | "drawit" | "corrida";

/** No maximo um registro por jogo a cada 10 minutos por aba. */
export const DEDUPE_MS = 10 * 60 * 1000;

function parseLast(raw: string | null): Record<string, number> {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(value)) if (typeof v === "number") out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** Decide se registra agora e devolve o novo conteudo do storage. Pura, pra testar sem navegador. */
export function shouldLog(raw: string | null, game: ActivityGame, now: number): { log: boolean; next: string } {
  const last = parseLast(raw);
  const prev = last[game];
  // relogio voltou (fuso trocado, ajuste manual): registra de novo em vez de calar por horas
  const log = prev === undefined || now - prev >= DEDUPE_MS || now < prev;
  if (log) last[game] = now;
  return { log, next: JSON.stringify(last) };
}
```

Criar `web/lib/activity.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
import { shouldLog, type ActivityGame } from "./activityDedupe";

export type { ActivityGame };

const STORAGE_KEY = "arcadeon_activity_last";
// mesma chave do Letrado anonimo, pra o servidor juntar as duas medicoes
const ANON_KEY_STORAGE = "termo_anon_key";

function anonKey(): string | null {
  try {
    let key = localStorage.getItem(ANON_KEY_STORAGE);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(ANON_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return null;
  }
}

/** Marca que a pessoa passou pelo jogo hoje. Nunca lanca erro: medicao nao pode quebrar a tela. */
export async function logActivity(game: ActivityGame): Promise<void> {
  try {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // storage bloqueado: segue sem deduplicar
    }
    const { log, next } = shouldLog(raw, game, Date.now());
    if (!log) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // idem
    }
    await createClient().rpc("log_activity", { p_game: game, p_anon_key: anonKey() });
  } catch {
    // RPC ainda nao existe ou rede caiu: ignora
  }
}
```

A deduplicação usa `sessionStorage` (por aba, como a spec pede "por sessão"); a chave anônima usa `localStorage`.

- [ ] **Passo 4:** `cd web && npm test`. Esperado: 6 testes passando.

- [ ] **Passo 5: ping no hub.** Criar `web/components/ActivityPing.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { logActivity } from "@/lib/activity";

/** Registra a visita ao hub. Espera o login resolver pra gravar com o usuario certo. */
export function ActivityPing() {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) void logActivity("hub");
  }, [loading]);
  return null;
}
```

Em `web/app/(hub)/layout.tsx`, importar e renderizar `<ActivityPing />` logo depois de `<MobileNav />`.

- [ ] **Passo 6:** `cd web && npx tsc --noEmit && npm run lint`. Esperado: sem erros.

- [ ] **Passo 7: pedidos no vault.** Acrescentar em `Comunicacao/Pedidos-ao-Servidor.md` um pedido "Fase 0: medição" com o texto da seção 4 da spec (tabela `daily_activity`, RPC `log_activity` para `anon` e `authenticated`, view `retention_cohorts` só `service_role`) e a observação: "O front já chama `log_activity` com `p_game='hub'` e `p_anon_key` = a mesma chave do Letrado anônimo. Até a RPC existir, a chamada falha em silêncio." Acrescentar um segundo pedido "Entrar com código": `GET /rooms/:code` → `{ games: Array<"buggle"|"drawit"|"corrida"> }`, código já normalizado em maiúsculas, CORS para o domínio do site, 200 com lista vazia quando não existe.
  Nos arquivos de pedidos das sessões Letrado, Buggle, Rabiscado e Corrida: "Chamar `logActivity('<slug>')` de `web/lib/activity.ts` no início de cada partida (`termo`, `buggle`, `drawit`, `corrida`)."

- [ ] **Passo 8: commit.**

```bash
git add web/lib/activityDedupe.ts web/lib/activity.ts web/lib/activity.test.ts web/components/ActivityPing.tsx "web/app/(hub)/layout.tsx"
git commit -m "feat: registra a visita ao hub para medir retencao (fase 0)"
```

---

### Task 3: padrões dos jogos como utilitários

**Arquivos:**
- Modificar: `web/app/globals.css` (bloco "Miniaturas dos jogos", hoje em torno da linha 744)
- Modificar: `web/components/GameCard.tsx`

**Interfaces:**
- Produz: classes `.pattern-termo`, `.pattern-buggle`, `.pattern-drawit`, `.pattern-corrida`, `.pattern-brand`. Cada uma pinta o fundo com `var(--pattern-color)` (padrão: a cor do jogo) e desenha o padrão por cima. Tasks 4, 5, 8 e 10 usam essas classes.

- [ ] **Passo 1: trocar o bloco CSS.** Substituir todo o bloco `/* ---------- Miniaturas dos jogos (cards da home) ---------- */` (de `.game-thumb {` até o fim de `.game-thumb[data-slug="corrida"]`) por:

```css
/* ---------- Padroes dos jogos (assinatura visual: cards, abas, vazios, OG) ---------- */
.pattern-termo,
.pattern-buggle,
.pattern-drawit,
.pattern-corrida,
.pattern-brand {
  background-color: var(--pattern-color);
}
.pattern-termo {
  --pattern-color: var(--game-termo);
  background-image: linear-gradient(rgb(255 255 255 / 0.18) 2px, transparent 2px),
    linear-gradient(90deg, rgb(255 255 255 / 0.18) 2px, transparent 2px);
  background-size: 22px 22px;
}
.pattern-buggle {
  --pattern-color: var(--game-buggle);
  background-image: radial-gradient(rgb(255 255 255 / 0.35) 2.5px, transparent 3px);
  background-size: 16px 16px;
}
.pattern-drawit {
  --pattern-color: var(--game-drawit);
  background-image: repeating-radial-gradient(circle at 15% 120%, rgb(255 255 255 / 0.2) 0 3px, transparent 3px 16px);
}
.pattern-corrida {
  --pattern-color: var(--game-corrida);
  background-image: repeating-linear-gradient(45deg, rgb(0 0 0 / 0.12) 0 10px, transparent 10px 20px);
}
/* marca: as quatro texturas juntas, pra vazios que nao sao de um jogo so */
.pattern-brand {
  --pattern-color: var(--primary);
  background-image: radial-gradient(rgb(255 255 255 / 0.22) 2px, transparent 2.5px),
    repeating-linear-gradient(45deg, rgb(0 0 0 / 0.08) 0 8px, transparent 8px 16px);
  background-size: 18px 18px, auto;
}
```

- [ ] **Passo 2: GameCard.** Em `web/components/GameCard.tsx`, trocar a div da miniatura:

```tsx
      <div
        className={`pattern-${game.slug} relative flex h-24 items-end justify-between p-3`}
        style={{ ["--pattern-color" as string]: game.accent }}
      >
```

(o `--pattern-color` inline mantém o card respeitando `game.accent`, inclusive para jogos sem classe própria).

- [ ] **Passo 3:** `grep -rn "game-thumb" web/` deve voltar vazio. Se aparecer em arquivo de jogo, não editar: abrir pedido para a sessão dona.
- [ ] **Passo 4:** `cd web && npm run build`. Esperado: build ok.
- [ ] **Passo 5:** Playwright: home em 1440 px claro e escuro; as 4 miniaturas iguais a antes.
- [ ] **Passo 6: commit.**

```bash
git add web/app/globals.css web/components/GameCard.tsx
git commit -m "refactor: padroes dos jogos viram utilitarios pattern-*"
```

---

### Task 4: carrossel sem autoplay, com abas nomeadas (item 1)

**Arquivos:**
- Modificar: `web/components/home/FeatureCarousel.tsx`
- Modificar: `web/components/home/HomeFeature.tsx` (`homeSlides`, `SlideShell`)

**Interfaces:**
- Consome: `.pattern-<slug>` da Task 3.
- Produz: `FeatureCarousel({ slides, label })` com `slides: { id: string; label: string; slug: string; content: React.ReactNode }[]`.

- [ ] **Passo 1: tirar o autoplay.** Em `FeatureCarousel.tsx`: apagar `AUTOPLAY_MS`, o estado `paused`, o `useEffect` do `setInterval` e os handlers `onMouseEnter`, `onMouseLeave`, `onFocus`, `onBlur`, `onTouchStart` da `<section>`. Atualizar o comentário do componente:

```tsx
/**
 * Carrossel de destaques da home. Os slides ficam num trilho com scroll-snap, entao o
 * arrastar no celular e nativo. Nao troca sozinho: a pessoa escolhe pelas abas ou pelas setas.
 */
```

- [ ] **Passo 2: tipo dos slides.**

```tsx
export interface FeatureSlide {
  id: string;
  /** nome curto na aba */
  label: string;
  /** jogo do slide, pra amostra do padrao na aba */
  slug: string;
  content: React.ReactNode;
}

export function FeatureCarousel({ slides, label }: { slides: FeatureSlide[]; label: string }) {
```

- [ ] **Passo 3: bolinhas viram abas.** Trocar o bloco `<div className="mt-3 flex justify-center gap-1.5">…</div>` por:

```tsx
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Escolher destaque">
            {slides.map((slide, i) => {
              const isActive = i === active;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isActive}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3 py-1.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                    isActive
                      ? "border-[var(--fg)] bg-[var(--card)] text-[var(--fg)]"
                      : "border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:border-[var(--border-hover)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span className={`pattern-${slide.slug} h-4 w-4 shrink-0 rounded-md`} aria-hidden />
                  {slide.label}
                </button>
              );
            })}
          </div>
```

- [ ] **Passo 4: dados dos slides.** Em `homeSlides()` de `HomeFeature.tsx`, adicionar `label` e `slug`:

| id | label | slug |
|---|---|---|
| letrado-diario | Letrado do dia | termo |
| letrado-modos | Outros modos | termo |
| corrida | Corrida | corrida |
| buggle | Buggle | buggle |
| drawit | Rabiscado | drawit |

- [ ] **Passo 5: eyebrow sem caixa alta.** Em `SlideShell`, trocar `className="text-xs font-bold uppercase tracking-wider"` por `className="text-sm font-bold"`. Trocar o eyebrow `"Letrado · outros modos"` por `"Outros modos do Letrado"`.

- [ ] **Passo 6:** `npx tsc --noEmit && npm run lint && npm run build`.
- [ ] **Passo 7:** Playwright 1440 e 390: as 5 abas aparecem; clicar em "Buggle" leva ao slide do Buggle; esperar 10 s e conferir que o slide não mudou; Tab até as abas, Enter troca, anel de foco visível.
- [ ] **Passo 8: commit.**

```bash
git add web/components/home/FeatureCarousel.tsx web/components/home/HomeFeature.tsx
git commit -m "feat: destaque da home sem autoplay, com abas por jogo"
```

---

### Task 5: coluna da home personalizada (item 2)

**Arquivos:**
- Criar: `web/lib/home/rank.ts`, `web/lib/home/rank.test.ts`, `web/lib/home/dailyCache.ts`, `web/lib/home/dailyCache.test.ts`, `web/components/home/HomeAside.tsx`
- Modificar: `web/components/home/HomeFeature.tsx`

**Interfaces:**
- Produz: `rankFor(rows: { username: string }[], username: string | null): number | null` (posição 1-based, `null` se fora da lista ou deslogado).
- Produz: `createOnce<T>(fetcher: () => Promise<T>): (key: string) => Promise<T>` e `getDailyStatusShared(key: string): Promise<DailyStatus>`. Chave = `user?.id ?? "anon"`. A Task 10 também usa.

- [ ] **Passo 1: testes.** Criar `web/lib/home/rank.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFor } from "./rank.ts";

const rows = [{ username: "Bia" }, { username: "caio" }, { username: "Duda" }];

test("posicao comeca em 1", () => {
  assert.equal(rankFor(rows, "Bia"), 1);
  assert.equal(rankFor(rows, "Duda"), 3);
});

test("fora da lista ou deslogado vira null", () => {
  assert.equal(rankFor(rows, "zeca"), null);
  assert.equal(rankFor(rows, null), null);
  assert.equal(rankFor([], "Bia"), null);
});

test("compara sem diferenciar maiusculas", () => {
  assert.equal(rankFor(rows, "CAIO"), 2);
});
```

Criar `web/lib/home/dailyCache.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOnce } from "./dailyCache.ts";

test("mesma chave busca uma vez so", async () => {
  let calls = 0;
  const get = createOnce(async () => ++calls);
  const [a, b] = await Promise.all([get("u1"), get("u1")]);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(calls, 1);
});

test("chave nova (login ou logout) busca de novo", async () => {
  let calls = 0;
  const get = createOnce(async () => ++calls);
  await get("anon");
  assert.equal(await get("u1"), 2);
});

test("falha nao fica presa no cache", async () => {
  let calls = 0;
  const get = createOnce(async () => {
    calls++;
    if (calls === 1) throw new Error("rede");
    return calls;
  });
  await assert.rejects(get("u1"));
  assert.equal(await get("u1"), 2);
});
```

- [ ] **Passo 2:** `npm test`. Esperado: FAIL (módulos não existem).

- [ ] **Passo 3: implementação.** `web/lib/home/rank.ts`:

```ts
/** Posicao (1 = primeiro) de quem esta logado numa lista ja ordenada. null quando nao aparece. */
export function rankFor(rows: { username: string }[], username: string | null): number | null {
  if (!username) return null;
  const target = username.toLowerCase();
  const idx = rows.findIndex((r) => r.username.toLowerCase() === target);
  return idx === -1 ? null : idx + 1;
}
```

`web/lib/home/dailyCache.ts`:

```ts
/** Guarda a ultima busca por chave; varios componentes da mesma tela dividem uma requisicao. */
export function createOnce<T>(fetcher: () => Promise<T>): (key: string) => Promise<T> {
  let lastKey: string | null = null;
  let pending: Promise<T> | null = null;
  return (key) => {
    if (key !== lastKey || !pending) {
      lastKey = key;
      pending = fetcher().catch((err) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}
```

E um arquivo separado para não puxar o Supabase nos testes, `web/lib/home/dailyStatus.ts`:

```ts
import { fetchDailyStatus, type DailyStatus } from "@/lib/termo/daily";
import { createOnce } from "./dailyCache";

/** Status do Letrado de hoje, buscado uma vez por usuario e dividido entre home e barra lateral. */
export const getDailyStatusShared: (key: string) => Promise<DailyStatus> = createOnce(fetchDailyStatus);
```

Observação: o cache vale até a chave mudar. Ao terminar uma partida, a pessoa volta ao hub por navegação de página inteira ou pelo layout do hub; se ficar velho, o dano é só um selo desatualizado até o F5. Aceitável na fase 1.

- [ ] **Passo 4:** `npm test`. Esperado: todos passando.

- [ ] **Passo 5: `LetradoDailySlide` usa o cache.** Em `HomeFeature.tsx`, trocar `fetchDailyStatus()` por `getDailyStatusShared(user?.id ?? "anon")` e o import correspondente.

- [ ] **Passo 6: componente.** Criar `web/components/home/HomeAside.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Flame, LogIn, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getDailyStatusShared } from "@/lib/home/dailyStatus";
import { rankFor } from "@/lib/home/rank";
import { LoginModal } from "@/components/LoginModal";

const CARD = "flex flex-col justify-center gap-1 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4";

/** Coluna ao lado do destaque: convite pra quem nao entrou, progresso pra quem entrou. */
export function HomeAside() {
  const { user, username, coins, loading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    getDailyStatusShared(user.id)
      .then((s) => alive && setStreak(s.currentStreak))
      .catch(() => alive && setStreak(null));
    // ranking do Letrado (1 palavra) por menos tentativas, o mesmo padrao da pagina de placares
    createClient()
      .from("termo_leaderboard")
      .select("username")
      .eq("board_count", 1)
      .order("attempts", { ascending: true })
      .order("time_seconds", { ascending: true })
      .limit(100)
      .then(({ data }) => alive && setRank(rankFor(data ?? [], username)));
    return () => {
      alive = false;
    };
  }, [loading, user, username]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1" aria-hidden>
        <div className={`${CARD} skeleton h-20`} />
        <div className={`${CARD} skeleton h-20`} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-3 self-start rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5">
        <p className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)]">Guarde seu progresso</p>
        <p className="text-sm text-[var(--fg-muted)]">
          Com uma conta você ganha moedas, troca por avatares na loja e aparece nos placares.
        </p>
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          <LogIn className="h-4 w-4" /> Entrar
        </button>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1">
      <Link href="/shop" className={`${CARD} transition hover:border-[var(--border-hover)] active:scale-[0.98]`}>
        <span className="text-xs font-medium text-[var(--fg-muted)]">Suas moedas</span>
        <span className="flex items-center gap-2 font-display text-2xl font-extrabold tabular-nums text-[var(--fg)]">
          <Coins className="h-5 w-5 text-[var(--primary)]" /> {coins}
        </span>
      </Link>
      <Link
        href="/leaderboard"
        className={`${CARD} transition hover:border-[var(--border-hover)] active:scale-[0.98]`}
      >
        <span className="text-xs font-medium text-[var(--fg-muted)]">Letrado</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-lg font-extrabold text-[var(--fg)]">
          {streak ? (
            <span className="inline-flex items-center gap-1">
              <Flame className="h-5 w-5 text-[var(--primary)]" /> {streak} {streak === 1 ? "dia" : "dias"}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-5 w-5 text-[var(--primary)]" /> {rank ? `#${rank}` : "Ver ranking"}
          </span>
        </span>
      </Link>
    </div>
  );
}
```

`.skeleton` vem da Task 9. Se esta task for feita antes, adicionar o utilitário aqui (o bloco CSS está na Task 9, passo 1) e pular esse passo lá.

- [ ] **Passo 7: HomeFeature usa o aside.** Em `HomeFeature()`, apagar o bloco `<div className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1">…</div>` e o `useAuth` que só servia a ele; renderizar `<HomeAside />` no lugar. Remover imports que ficaram sem uso (`Coins`, `Trophy`, `Link`).

- [ ] **Passo 8:** `npx tsc --noEmit && npm run lint && npm test && npm run build`.
- [ ] **Passo 9:** Playwright deslogado e logado (conta de teste do usuário, se ele logar no navegador do Playwright; senão só deslogado e anotar no relatório que o logado não foi visto).
- [ ] **Passo 10: commit.**

```bash
git add web/lib/home/rank.ts web/lib/home/rank.test.ts web/lib/home/dailyCache.ts web/lib/home/dailyCache.test.ts web/lib/home/dailyStatus.ts web/components/home/HomeAside.tsx web/components/home/HomeFeature.tsx
git commit -m "feat: coluna da home convida quem nao entrou e mostra progresso de quem entrou"
```

---

### Task 6: Letrado em cartão largo com contagem (item 3)

**Arquivos:**
- Criar: `web/lib/time.ts`, `web/lib/time.test.ts`
- Modificar: `web/components/GameCard.tsx`, `web/app/(hub)/page.tsx`

**Interfaces:**
- Produz: `msUntilBrasiliaMidnight(now: number): number` (sempre entre 1 e 86 400 000) e `formatCountdown(ms: number): string` ("5 h 12 min", "12 min", "menos de 1 min"). A Task 10 usa ambos.
- Produz: `GameCard({ game, layout?: "default" | "wide" })`.

- [ ] **Passo 1: testes.** `web/lib/time.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCountdown, msUntilBrasiliaMidnight } from "./time.ts";

const H = 3_600_000;
const M = 60_000;

test("meia-noite de Brasilia e 03:00 UTC", () => {
  // 2026-10-14 02:00 UTC = 23:00 em Brasilia: falta 1 h
  assert.equal(msUntilBrasiliaMidnight(Date.UTC(2026, 9, 14, 2, 0)), H);
});

test("logo depois da virada falta quase um dia", () => {
  assert.equal(msUntilBrasiliaMidnight(Date.UTC(2026, 9, 14, 3, 0, 1)), 24 * H - 1000);
});

test("exatamente na virada conta o dia inteiro, nunca zero", () => {
  assert.equal(msUntilBrasiliaMidnight(Date.UTC(2026, 9, 14, 3, 0)), 24 * H);
});

test("nao depende do fuso do aparelho", () => {
  // o calculo usa so o timestamp; mesmo instante, mesma resposta em qualquer pais
  const t = Date.UTC(2026, 0, 1, 15, 30);
  assert.equal(msUntilBrasiliaMidnight(t), 8 * H + 30 * M);
});

test("formato curto", () => {
  assert.equal(formatCountdown(5 * H + 12 * M + 40_000), "5 h 12 min");
  assert.equal(formatCountdown(5 * H), "5 h");
  assert.equal(formatCountdown(12 * M + 59_000), "12 min");
  assert.equal(formatCountdown(30_000), "menos de 1 min");
  assert.equal(formatCountdown(-5), "menos de 1 min");
});
```

- [ ] **Passo 2:** `npm test`. Esperado: FAIL.

- [ ] **Passo 3: implementação.** `web/lib/time.ts`:

```ts
const DAY_MS = 86_400_000;
// Brasilia e UTC-3 o ano todo desde 2019 (sem horario de verao)
const BRASILIA_OFFSET_MS = 3 * 3_600_000;

/** Quanto falta pra virar o dia do Arcadeon (meia-noite de Brasilia). Entre 1 ms e 24 h. */
export function msUntilBrasiliaMidnight(now: number): number {
  const sinceMidnight = (((now - BRASILIA_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - sinceMidnight;
}

/** "5 h 12 min", "5 h", "12 min" ou "menos de 1 min". */
export function formatCountdown(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMin < 1) return "menos de 1 min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
```

- [ ] **Passo 4:** `npm test`. Esperado: passando.

- [ ] **Passo 5: hook de contagem.** Em `web/lib/time.ts` não (é puro). Criar dentro de `GameCard.tsx`:

```tsx
function useNextWordCountdown(enabled: boolean): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setLabel(formatCountdown(msUntilBrasiliaMidnight(Date.now())));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [enabled]);
  return label;
}
```

(o texto só aparece depois de montar, então servidor e cliente não divergem na hidratação).

- [ ] **Passo 6: layout largo.** Em `GameCard`, aceitar `layout = "default"`. Quando `layout === "wide"`:
  - o container interno vira `flex-col sm:flex-row`;
  - a miniatura passa a `h-28 sm:h-auto sm:w-56` e mostra o ícone maior (`h-14 w-14`, ícone `h-8 w-8`);
  - para `game.slug === "termo"`, abaixo da descrição aparece `<p className="text-sm font-bold" style={{ color: game.accent }}>Nova palavra em {label}</p>` quando `label` existe.

- [ ] **Passo 7: home.** Em `app/(hub)/page.tsx`, na seção "Jogar sozinho":

```tsx
        <div className={`grid grid-cols-1 gap-4 ${solo.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
          {solo.map((game) => (
            <GameCard key={game.slug} game={game} layout={solo.length === 1 ? "wide" : "default"} />
          ))}
        </div>
```

- [ ] **Passo 8:** `npx tsc --noEmit && npm run lint && npm run build`; Playwright 1440 e 390.
- [ ] **Passo 9: commit.**

```bash
git add web/lib/time.ts web/lib/time.test.ts web/components/GameCard.tsx "web/app/(hub)/page.tsx"
git commit -m "feat: Letrado em cartao largo com contagem ate a proxima palavra"
```

---

### Task 7: placares com hierarquia e vazio útil (item 5)

**Arquivos:**
- Modificar: `web/components/leaderboard/LeaderboardPageContent.tsx`, `web/app/(hub)/leaderboard/page.tsx`

- [ ] **Passo 1: página.** Em `leaderboard/page.tsx`: apagar o `<Link>` "Hub" e os imports `Link`, `ArrowLeft`; trocar `<h2>` por `<h1>`; trocar o `<main>` por `<main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">` e envolver o conteúdo em `<div className="mx-auto max-w-6xl">…</div>`.

- [ ] **Passo 2: três níveis.** Ler o arquivo inteiro antes. Regras:
  - Nível 1, jogo: abas grandes já existentes (manter).
  - Nível 2, modo (`variant="mode"`): manter `rounded-2xl px-4 py-2 text-sm`.
  - Nível 3, critério (`variant="category"`): deixa de ser chip colorido. Trocar `baseClass` e `activeClass` do `category` por um sublinhado:

```tsx
  const activeClass =
    variant === "mode"
      ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
      : "border-transparent border-b-[var(--fg)] text-[var(--fg)]";
  const baseClass =
    variant === "mode" ? "rounded-2xl border-2 px-4 py-2 text-sm" : "border-b-2 px-1 py-1.5 text-sm";
```

  E o inativo do `category` passa a `border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]` (o inativo atual com fundo e borda fica só para `mode`). Tirar `border-2` do `className` comum do botão (já está no `baseClass` de `mode`). O contêiner do nível 3 ganha `gap-4 border-b-2 border-[var(--border)]` para virar uma linha de abas.

- [ ] **Passo 3: caixa normal nos rótulos laterais.** Nas linhas com "Suas estatísticas", "Resultado atual" (ou equivalente) e "Como pontuar", tirar `uppercase` e `tracking-wide`, e trocar `text-xs` por `text-sm`.

- [ ] **Passo 4: estado vazio.** Adicionar a prop `emptyCta: { label: string; href: string }` em `RankingBoard` e trocar o bloco "Ninguém jogou ainda" por:

```tsx
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] px-6 py-10 text-center">
            <span className="pattern-brand h-14 w-14 rounded-2xl" aria-hidden />
            <p className="font-display text-lg font-extrabold text-[var(--fg)]">Ninguém pontuou aqui ainda</p>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">Jogue uma partida e seu nome aparece neste placar.</p>
            <EmptyCta {...emptyCta} />
          </div>
```

  com

```tsx
function EmptyCta({ label, href }: { label: string; href: string }) {
  const { navigate } = useBlockTransition();
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98]"
    >
      {label}
    </button>
  );
}
```

  (import `useBlockTransition` de `@/lib/transition/TransitionProvider`). Passar `emptyCta={{ label: "Jogar Letrado", href: "/games/termo" }}` no Letrado e `{{ label: "Criar sala na Corrida", href: "/games/corrida" }}` na Corrida.

- [ ] **Passo 5:** `?mock=1` para ver o pódio cheio; um modo vazio para ver o estado vazio. `npx tsc --noEmit && npm run lint && npm run build`; Playwright 1440 e 390, claro e escuro.
- [ ] **Passo 6: commit.**

```bash
git add web/components/leaderboard/LeaderboardPageContent.tsx "web/app/(hub)/leaderboard/page.tsx"
git commit -m "feat: placares com tres niveis e vazio que leva ao jogo"
```

---

### Task 8: padrões no cartão de compartilhamento e ícone quadrado (item 8)

**Arquivos:**
- Modificar: `web/lib/ogImage.tsx`, `web/app/manifest.ts`, `web/app/layout.tsx`
- Criar: `web/app/icon.tsx`, `web/app/apple-icon.tsx`

- [ ] **Passo 1: textura no OG.** Em `renderOgImage`, aceitar `pattern?: "termo" | "buggle" | "drawit" | "corrida"` e desenhar uma faixa à direita, dentro do `<div>` raiz, antes do conteúdo, com `position: "absolute"`, `right: 0`, `top: 0`, `bottom: 0`, `width: 360`, `opacity: 0.5` e o `backgroundImage`/`backgroundSize` equivalentes aos de `.pattern-*` (Satori aceita `linear-gradient`, `radial-gradient` e `repeating-*`). O raiz ganha `position: "relative"`. Sem `pattern`, usar a textura da marca. `renderGameOgImage` passa `pattern: slug`.
  Se o Satori recusar algum gradiente no build, trocar só aquele por `linear-gradient` simples e anotar no commit.

- [ ] **Passo 2: ícone.** `web/app/icon.tsx`:

```tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// O logo e largo (1312x904); aqui vira um quadrado escuro com o logo centralizado.
export default async function Icon() {
  const buf = await readFile(join(process.cwd(), "public/Logo@4x.png"));
  const src = `data:image/png;base64,${buf.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0b16", borderRadius: 112 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={380} height={262} alt="" />
      </div>
    ),
    size,
  );
}
```

  `web/app/apple-icon.tsx`: mesmo código com `size = { width: 180, height: 180 }`, sem `borderRadius` (o iOS arredonda) e `<img width={136} height={94}>`.

- [ ] **Passo 3:** em `app/layout.tsx`, apagar o bloco `icons: {…}` do `metadata` (os arquivos `icon.tsx`/`apple-icon.tsx` passam a gerar as tags). Em `manifest.ts`: `icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }]`.
- [ ] **Passo 4:** `npm run build`; abrir `/icon`, `/apple-icon` e `/opengraph-image` e `/games/termo/opengraph-image` no Playwright e salvar prints.
- [ ] **Passo 5: commit.**

```bash
git add web/lib/ogImage.tsx web/app/manifest.ts web/app/layout.tsx web/app/icon.tsx web/app/apple-icon.tsx
git commit -m "feat: icone quadrado e textura dos jogos nos cartoes de compartilhamento"
```

---

### Task 9: loja com esqueleto e "Entre para comprar" (item 6)

**Arquivos:**
- Modificar: `web/app/globals.css`, `web/components/shop/ShopPageContent.tsx`, `web/app/(hub)/shop/page.tsx`

- [ ] **Passo 1: utilitário `.skeleton`** (pular se a Task 5 já criou). No fim de `globals.css`:

```css
/* ---------- Esqueleto de carregamento ---------- */
.skeleton {
  background: linear-gradient(90deg, var(--card) 0%, var(--bg) 50%, var(--card) 100%);
  background-size: 200% 100%;
  animation: skeletonShimmer 1.4s ease-in-out infinite;
}
@keyframes skeletonShimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
```

- [ ] **Passo 2: esqueleto.** Trocar `<p …>Carregando...</p>` por uma grade com as mesmas classes da grade real e 10 cartões:

```tsx
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" aria-busy="true" aria-label="Carregando avatares">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4">
                <span className="skeleton h-16 w-16 rounded-full" />
                <span className="skeleton h-4 w-20 rounded-md" />
                <span className="skeleton mt-2 h-8 w-24 rounded-xl" />
              </div>
            ))}
          </div>
```

  (conferir no `Avatar` o tamanho real de `size="lg"` e igualar o círculo).

- [ ] **Passo 3: botão deslogado.** No ramo `!user`, o conteúdo do botão vira:

```tsx
                      <span className="flex flex-col items-center leading-tight">
                        <span className="text-[var(--fg)]">Entre para comprar</span>
                        <PriceTag value={price} />
                      </span>
```

- [ ] **Passo 4:** em `shop/page.tsx`, `max-w-5xl` vira `max-w-6xl`.
- [ ] **Passo 5:** `ShieldShopCard` é do Letrado: se tiver `uppercase` ou botão fora do padrão, abrir pedido para a sessão Letrado, sem editar.
- [ ] **Passo 6:** `npm run build`; Playwright deslogado 1440 e 390. Para ver o esqueleto, usar `browser_run_code_unsafe` com `page.route("**/rest/v1/avatars**", r => setTimeout(() => r.continue(), 3000))` antes de navegar para `/shop` e tirar o print no primeiro segundo.
- [ ] **Passo 7: commit.**

```bash
git add web/app/globals.css web/components/shop/ShopPageContent.tsx "web/app/(hub)/shop/page.tsx"
git commit -m "feat: loja com esqueleto de carregamento e convite para entrar"
```

---

### Task 10: rodapé útil na barra lateral (item 7)

**Arquivos:**
- Criar: `web/components/SidebarDaily.tsx`
- Modificar: `web/components/Sidebar.tsx`

**Interfaces:**
- Consome: `getDailyStatusShared` (Task 5), `msUntilBrasiliaMidnight`, `formatCountdown` (Task 6), `.pattern-termo` (Task 3).

- [ ] **Passo 1: componente.**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getDailyStatusShared } from "@/lib/home/dailyStatus";
import { formatCountdown, msUntilBrasiliaMidnight } from "@/lib/time";

const MODES = [1, 2, 4] as const;

/** Progresso do Letrado de hoje e quanto falta pra palavra nova. Na fase 4 ganha os amigos online. */
export function SidebarDaily() {
  const { user, loading } = useAuth();
  const [done, setDone] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    getDailyStatusShared(user?.id ?? "anon")
      .then((s) => {
        if (!alive) return;
        setDone(MODES.filter((m) => s.modes[m] === "won" || s.modes[m] === "lost").length);
      })
      .catch(() => alive && setDone(null));
    return () => {
      alive = false;
    };
  }, [loading, user?.id]);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilBrasiliaMidnight(Date.now())));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Link
      href="/games/termo"
      className="flex flex-col gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-4 transition hover:border-[var(--border-hover)]"
    >
      <span className="flex items-center gap-2 text-sm font-extrabold text-[var(--fg)]">
        <span className="pattern-termo h-4 w-4 rounded-md" aria-hidden /> Letrado de hoje
      </span>
      {done !== null && (
        <span className="flex gap-1" aria-label={`${done} de 3 modos feitos`}>
          {MODES.map((m, i) => (
            <span key={m} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-[var(--game-termo)]" : "bg-[var(--border)]"}`} />
          ))}
        </span>
      )}
      <span className="text-xs font-medium text-[var(--fg-muted)]">
        {done === 3 ? "Dia fechado. " : ""}
        {countdown ? `Palavra nova em ${countdown}` : "Palavra nova todo dia"}
      </span>
    </Link>
  );
}
```

- [ ] **Passo 2:** em `Sidebar.tsx`, trocar o bloco do rodapé (o `div` com `Joystick`) por `<SidebarDaily />` e remover o import de `Joystick`.
- [ ] **Passo 3:** procurar `uppercase` em arquivos do hub (`components/home`, `components/leaderboard`, `components/shop`, `components/profile`, `components/Header.tsx`, `components/Sidebar.tsx`, `components/MobileNav.tsx`, `app/(hub)`). Tirar onde for rótulo; manter onde for letra de jogo. Arquivos de jogos ficam de fora (pedido para as sessões, se for o caso).
- [ ] **Passo 4:** `npx tsc --noEmit && npm run lint && npm run build`; Playwright 1440 claro e escuro.
- [ ] **Passo 5: commit.**

```bash
git add web/components/SidebarDaily.tsx web/components/Sidebar.tsx <outros arquivos do hub tocados no passo 3>
git commit -m "feat: rodape da barra lateral mostra o Letrado do dia"
```

---

### Task 11: entrar numa sala com código (item 4) — bloqueada até o Servidor

**Pré-condição:** o pedido `GET /rooms/:code` foi atendido (conferir no vault e com `curl "$NEXT_PUBLIC_BUGGLE_SERVER_URL/rooms/ABCDE"`, que deve devolver `{"games":[]}`). Se não foi, fazer só os passos 1 a 4 (módulo puro e testes), commitar e parar.

**Arquivos:**
- Criar: `web/lib/joinCode.ts`, `web/lib/joinCode.test.ts`, `web/components/home/JoinByCode.tsx`
- Modificar: `web/components/home/HomeFeature.tsx` (abaixo do carrossel, em telas largas) e `web/app/(hub)/page.tsx` (no topo da seção "Jogar com amigos")

**Interfaces:**
- Produz: `CODE_ALPHABET`, `normalizeCode(input: string): string | null`, `joinTarget(code: string, games: RoomGame[]): { kind: "go"; href: string } | { kind: "choose"; options: { game: RoomGame; href: string }[] } | { kind: "missing" }`, `type RoomGame = "buggle" | "drawit" | "corrida"`.

- [ ] **Passo 1: testes.**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { joinTarget, normalizeCode } from "./joinCode.ts";

test("normaliza caixa, espacos e hifen", () => {
  assert.equal(normalizeCode(" ab c-de "), "ABCDE");
});

test("troca letras ambiguas pelas do alfabeto das salas", () => {
  // o alfabeto nao tem O, 0, I nem 1
  assert.equal(normalizeCode("o0ib1"), null);
  assert.equal(normalizeCode("abcd2"), "ABCD2");
});

test("tamanho diferente de 5 e invalido", () => {
  assert.equal(normalizeCode("ABCD"), null);
  assert.equal(normalizeCode("ABCDEF"), null);
  assert.equal(normalizeCode(""), null);
});

test("um jogo leva direto", () => {
  assert.deepEqual(joinTarget("ABCDE", ["drawit"]), { kind: "go", href: "/games/drawit?join=ABCDE" });
});

test("mais de um jogo pede escolha", () => {
  const r = joinTarget("ABCDE", ["buggle", "corrida"]);
  assert.equal(r.kind, "choose");
  assert.deepEqual(r.kind === "choose" && r.options.map((o) => o.href), [
    "/games/buggle?join=ABCDE",
    "/games/corrida?join=ABCDE",
  ]);
});

test("nenhum jogo vira nao encontrada", () => {
  assert.deepEqual(joinTarget("ABCDE", []), { kind: "missing" });
});
```

  Decisão sobre `O`/`0`/`I`/`1`: como nenhum desses existe no alfabeto (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), não há para onde mapear com segurança (`O` poderia ser `Q` ou `D`). O código com esses caracteres é inválido e a mensagem explica: "Códigos de sala não usam O, I, 0 nem 1. Confira com quem criou a sala."

- [ ] **Passo 2:** `npm test`. Esperado: FAIL.

- [ ] **Passo 3: implementação.**

```ts
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;
export type RoomGame = "buggle" | "drawit" | "corrida";

export type JoinTarget =
  | { kind: "go"; href: string }
  | { kind: "choose"; options: { game: RoomGame; href: string }[] }
  | { kind: "missing" };

/** Limpa o que a pessoa digitou. null quando nao pode ser um codigo de sala. */
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Para onde ir, sabendo em quais jogos o codigo existe (cada jogo gera os seus, entao podem coincidir). */
export function joinTarget(code: string, games: RoomGame[]): JoinTarget {
  const options = games.map((game) => ({ game, href: `/games/${game}?join=${code}` }));
  if (options.length === 0) return { kind: "missing" };
  if (options.length === 1) return { kind: "go", href: options[0].href };
  return { kind: "choose", options };
}
```

- [ ] **Passo 4:** `npm test` passando; commit `web/lib/joinCode.ts web/lib/joinCode.test.ts` com "feat: normalizacao do codigo de sala".

- [ ] **Passo 5: componente.** `JoinByCode.tsx`: formulário com `<label>` "Entrar com código" acima de um `<input>` (`inputMode="text"`, `autoCapitalize="characters"`, `maxLength={7}`, `autoComplete="off"`), botão "Entrar". No envio: `normalizeCode`; se `null`, erro inline abaixo do campo com o texto do passo 1 quando houver `O`/`I`/`0`/`1`, senão "O código tem 5 letras ou números." Senão `fetch(\`${process.env.NEXT_PUBLIC_BUGGLE_SERVER_URL ?? "http://localhost:3001"}/rooms/${code}\`)`, com `AbortController` e limite de 5 s; erro de rede → "Não deu para buscar a sala agora. Tente de novo." Resultado `go` → `navigate(href)`; `choose` → botões com o nome de cada jogo (via `getGame(game).title`) e `pattern-<slug>`; `missing` → "Sala não encontrada. Confira o código com quem criou a sala." Botão desabilitado durante a busca, com texto "Buscando...".
- [ ] **Passo 6:** colocar o componente na home (topo da seção "Jogar com amigos").
- [ ] **Passo 7:** `npm run build`; Playwright: código inexistente, código com `O`, servidor desligado (erro de rede).
- [ ] **Passo 8: commit.**

```bash
git add web/components/home/JoinByCode.tsx "web/app/(hub)/page.tsx"
git commit -m "feat: entrar numa sala pelo codigo a partir da home"
```

---

### Task 12: verificação final e registro

- [ ] **Passo 1:** `cd web && npm test && npx tsc --noEmit && npm run lint && npm run build`. Tudo verde; colar a saída curta no relatório.
- [ ] **Passo 2:** Playwright em `npm run dev`: home, placares, loja em 1440 e 390, claro e escuro (12 prints em `.playwright-mcp/`). Navegar a home só com Tab/Enter e confirmar o foco visível em abas, cartões e botões. Emular `prefers-reduced-motion: reduce` (`browser_emulate_media`) e confirmar que o esqueleto e o carrossel ficam parados.
- [ ] **Passo 3:** skill `code-review` no diff da branch; corrigir o que for confirmado.
- [ ] **Passo 4:** Supabase MCP só leitura: `select count(*) from daily_activity` se a tabela já existir; senão anotar que a fase 0 aguarda o Servidor.
- [ ] **Passo 5:** vault: atualizar `Frontend/Handoff-Frontend.md` com o que entrou, o que está bloqueado (Task 11, fase 0 no banco) e os pedidos abertos.
- [ ] **Passo 6:** skill `superpowers:finishing-a-development-branch`.
