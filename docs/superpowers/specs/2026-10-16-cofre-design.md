# Jogo da memória do Arcadeon: "Cofre" (nome provisório) — design aprovado 2026-10-16

## Contexto

O Arcadeon vai ganhar um quinto jogo, um jogo da memória. Esta sessão cuida dele de ponta a ponta: servidor, banco e tela.

A base é o jogo da memória clássico. Os twists entram como opções que o dono da sala liga ou desliga ao criar a partida, e só existem no multiplayer. A exceção é o Diário, que sempre usa o tabuleiro móvel para ser um desafio novo.

O tema é um assalto: você abre um cofre e os pares são o espólio. Fica adulto sem mudar as regras. A arte das cartas você gera no GPT; os prompts estão no fim do plano.

### O que mudou desde a v1 (seu feedback)
- As regras são as do clássico. Tabuleiro móvel e cartas especiais viraram opções da sala.
- Na primeira fase entra só um especial, o **Coringa**. Ele é um par que vale **3 pontos**; não é mais "igual a qualquer carta". Os outros 5 especiais foram para o backlog e ainda vão ser revisados.
- Pontuação: par normal vale 1 ponto e par de Coringa vale 3. Se os pontos empatarem, vence quem achou mais pares.
- Sala totalmente customizável.
- O Diário sempre usa o tabuleiro móvel.
- A arquitetura do multiplayer foi aprovada e continua igual à da v1.

## Regras

### Base (clássico)
- Todas as cartas começam viradas para baixo. Na sua vez, você vira duas.
- Se formarem par, você fica com ele e joga de novo. Se não formarem, as duas voltam e a vez passa.
- O jogo acaba quando todos os pares saírem. Os pares formados saem do tabuleiro e deixam um espaço vazio no lugar.

### Pontuação (multiplayer)
- Par normal: **1 ponto**. Par de Coringa: **3 pontos**.
- Vence quem tiver mais pontos.
- 1º desempate: quem achou mais pares (você definiu).
- 2º desempate: quem errou menos (minha sugestão). Se ainda empatar, a vitória é dividida.

### Opções que o dono escolhe ao criar a sala
| Opção | Valores | Padrão |
|---|---|---|
| Tamanho do tabuleiro | 4×4 (8 pares), 6×4 (12), 6×5 (15), 6×6 (18) | 6×4 |
| Máximo de jogadores | 2 a 8 | 4 |
| Tempo de turno | 8 / 12 / 20 s / sem limite | 12 s |
| Tabuleiro móvel | ligado / desligado | desligado |
| Coringa | ligado / desligado | desligado |
| Espiada inicial *(minha sugestão)* | ligado / desligado (todas as cartas aparecem por 3 s no começo) | desligado |

- **Máximo de jogadores:** você ainda estava entre 4 e 8. A sugestão é deixar o dono escolher até 8, com 4 de padrão. O jogo é por turnos, então 8 pessoas num 4×4 fica parado demais. Para evitar isso, a tela de criação recomenda um tamanho maior quando passar de 5 jogadores.
- **Tempo de turno:** quem estoura o tempo perde a vez. Sem isso, um jogador parado trava a sala.
- **Tabuleiro móvel:** depois de cada erro, duas cartas escondidas trocam de lugar com uma animação de deslize de cerca de 0,6 s, à vista de todos. O código já fica preparado para entrarem novos modos como novas opções nessa mesma lista.
- **Coringa:** troca um dos pares normais por um par de Coringas, então o total de cartas não muda. Ele se acha como qualquer outro par: virando as duas cartas na mesma jogada.

## Modos

1. **Salas multiplayer** (código e QR, como os outros jogos), com as opções acima.
2. **Diário ("Golpe do dia"):** o mesmo tabuleiro para todo mundo, 6×4, **sempre com tabuleiro móvel** e sem Coringa. Uma tentativa por dia, com placar e streak iguais aos do Letrado. A nota é `jogadas × 10 + segundos`, e quem tiver a menor fica na frente. O dia vira à meia-noite de Brasília, pela `termo_today()`.
3. **Treino** *(minha sugestão, mantido da v1)*: solo, local, sem ranking, com tamanho e tabuleiro móvel à escolha. Serve para treinar antes do Diário. Corto se você não quiser.

## Arquitetura (aprovada na v1)

### Multiplayer: Socket.io, namespace `/cofre`, servidor autoritativo
Copiar o padrão da Corrida (`server/src/raceRooms.ts` e `raceSocket.ts`):
- Mapas `rooms` e `socketToRoom`.
- Um timer por sala com `timerToken` (`scheduleRoomTimer`/`clearRoomTimer`).
- Um snapshot único, `room-updated`, com `serverNow` e `phaseEndsAt`.
- `throttled` a 150 ms por evento, `asObject`, `hostRoom`, e `identify` com `identifySeq` e `verifyAccessToken`.
- `sanitizeName` e `sanitizeAvatar` copiados de `raceRooms.ts:148-153`, e `generateCode` copiado.

As opções da sala ficam num objeto `config` validado por um `sanitizeConfig`. O dono só pode mudar no lobby, e o máximo de jogadores não pode ficar abaixo de quantos já estão na sala.

**Anti-trapaça:**
- O snapshot nunca leva a face de uma carta escondida. Só saem as faces das cartas viradas agora e dos pares já formados.
- As trocas do tabuleiro móvel saem só como índices `{a, b}`.
- Na espiada inicial, as faces são enviadas por um `emit` com prazo e escondidas pelo cliente quando o prazo acaba. Essa é a única exceção, e é proposital.

**Arquivos novos:**
- `server/src/cofreEngine.ts`: regras puras (virar, par, troca, pontuação, desempate), sem I/O, para dar para testar.
- `server/src/cofreRooms.ts`: salas, fases e config.
- `server/src/cofreSocket.ts`: os eventos do socket.
- `server/src/cofreStats.ts`: moedas e ranking.
- `server/scripts/cofre-sim.ts`: simulador de 2 a 8 bots.

**Mudança em arquivo compartilhado:** `server/src/index.ts` ganha `registerCofreNamespace(io)` e o `hasCofreRoom` na rota `/rooms/:code`.

### Diário: RPCs no Supabase, como o Letrado (`web/lib/termo/daily.ts`)
- RPCs: `cofre_daily_state(p_anon_key)`, `cofre_daily_flip(p_anon_key, p_index)` (devolve a face, se deu par e as trocas) e `cofre_daily_finish`.
- O tempo é medido no servidor.
- A disposição do dia fica no banco.
- A animação de virar, de cerca de 300 ms, esconde a ida e volta ao servidor.
- Economia e missões entram por trigger em `finished_at`, como `termo_daily_finished_economy`.

### Banco (migrations `YYYYMMDDHHMMSS_cofre_*.sql`, sempre com dry-run antes)
- Tabelas `cofre_daily_boards` e `cofre_daily_games`, as RPCs do Diário e as views `cofre_daily_leaderboard` e `cofre_leaderboard` (vitórias no multiplayer).
- RPC `record_cofre_result`.
- Incluir `'cofre'` na lista de jogos permitidos de `award_match_coins` (`20261015010000_fase2_economia.sql:487`).

### Front (Next 16 / React 19; antes de codar, ler `web/node_modules/next/dist/docs/`)
**Arquivos novos:**
- `web/app/games/cofre/page.tsx` e `opengraph-image.tsx`
- `web/components/cofre/`:
  - `CofreGame`
  - `Board`
  - `Card`: virada 3D em rotateY, com a moldura e o fundo da carta em CSS
  - `CreateRoomForm`: a tela com todas as opções
  - `RoomWaiting`
  - `Results`: pontos, pares e o Coringa destacado
  - `DailyScreen`
  - `PracticeScreen`
  - `Tutorial`
- `web/lib/cofre/`: `socket.ts`, `sound.ts` (Web Audio, como `race/sound.ts`), `types.ts` (espelho do snapshot) e `daily.ts`

**Reaproveitar sem editar:** `RoundCountdown`, `JoinNameModal`, `AvatarEditModal`, `Avatar`, `GameHeader`, `useLeaveGuard`, `MatchCoins`, `InviteFriendsButton` e `QRCodeSVG`.

**Arquivos compartilhados, com mudança mínima em bloco próprio:**
- `web/lib/games.ts`
- `web/lib/seo.ts`
- `globals.css`: `--game-cofre`, o bloco `[data-game]`, o pattern e os keyframes `cofre-*` com reduced motion
- `gameIcons.tsx`
- `GAME_ART` em `GameCard.tsx` e `HomeFeature.tsx`
- `LeaderboardPageContent.tsx`
- `web/lib/joinCode.ts`

### Organização da sessão
Criar `.claude/agents/cofre.md`, a nota do vault `10-Cofre-Game.md` e o bloco do jogo em `Servidor/Contratos.md`. O servidor de teste roda na porta **3301**.

## Fases de entrega
1. **Núcleo:** engine com testes, carta e tabuleiro com animações, Treino local, registro no hub e arte das cartas.
2. **Multiplayer:** namespace `/cofre`, criação de sala com todas as opções, tabuleiro móvel, Coringa, pontuação e desempate, moedas, `cofre_leaderboard` e simulador.
3. **Diário:** migrations, RPCs, placar no estilo do Letrado e streak, sempre com tabuleiro móvel.
4. **Acabamento:** sons, tutorial, celular e imagem OG.


## Verificação
- `node --test` na engine. Cobrir: par, erro, trocas, par de Coringa valendo 3, os dois desempates, fim de jogo, e garantir que nenhuma face escondida aparece no snapshot.
- `cofre-sim.ts` contra o servidor na porta 3301, com 2 a 8 bots e todas as combinações de opções, até sair `TUDO OK`.
- `tsc`, `eslint` e `next build` no `web/` e no `server/`.
- Diário: dry-run da migration, depois chamadas às RPCs (anônimo e logado) e conferência do placar.
- Teste visual com Playwright no desktop e no celular, nos temas claro e escuro.

## Backlog (para revisar depois)
- Os outros especiais: Alarme, Raio-x, Fumaça, Algemas e Luva.
- Disputa simultânea: cada um joga no seu tabuleiro com a mesma disposição.
- Baralhos extras como item da loja.

---

## Prompts para a arte das cartas (GPT, uma imagem por carta)

**Como usar:** cole o bloco ESTILO e depois a linha da carta. Gere todas no mesmo chat para manter a consistência. As faces saem em 1024×1024 com fundo transparente; a moldura fica por conta do CSS.

**ESTILO (colar sempre antes):**
> Premium stylized 3D render of a single object, centered, filling about 70% of the frame, slight 3/4 angle, glossy materials with realistic reflections, dramatic low-key studio lighting with a cool teal rim light and a warm gold key light, soft contact shadow under the object, mature heist-movie mood, high-end mobile game collectible look, very clean silhouette readable at small size, vivid distinct main color, transparent background, no text, no letters, no numbers, no logo, no frame, no border, no hands, no people. 1024x1024 PNG.

**Espólio (18 faces; o 6×6 usa todas):**
1. `diamante`: a large brilliant-cut diamond, icy white-blue sparkle
2. `barra-ouro`: a stamped gold bullion bar, rich yellow gold
3. `relogio`: an open antique pocket watch with chain, polished brass
4. `coroa`: a royal crown with red velvet and gold points
5. `perolas`: a coiled pearl necklace, creamy white pearls
6. `chave`: an ornate antique skeleton key, dark bronze
7. `rubi`: a cushion-cut ruby gemstone, deep crimson
8. `dobrao`: an old pirate gold doubloon coin, worn edges
9. `calice`: a jeweled golden chalice
10. `anel`: a platinum ring with a big emerald, bright green
11. `dragao-jade`: a small carved jade dragon statuette, translucent green-teal
12. `ovo-imperial`: an ornate jeweled imperial egg, royal blue enamel with gold lattice
13. `maleta`: an open black briefcase full of banknote stacks
14. `quadro`: a tiny ornate gold-framed oil painting of a landscape
15. `ficha`: a stack of purple and gold casino chips
16. `bussola`: a brass navigator's compass, open lid
17. `safira`: an oval sapphire, deep electric blue
18. `mascara`: a black and gold venetian masquerade mask

**Coringa (1 face; colar o ESTILO e trocar o objeto):**
- `coringa`: an ornate golden jester crown with three bells and inlaid rainbow gemstones, surrounded by a glowing magenta and gold aura with tiny sparkles, legendary rarity feel, clearly more precious than any other treasure

**Verso da carta (1024×1536, sem transparência):**
> Back of a premium playing card, full-bleed, dark gunmetal steel vault door texture, a central circular combination dial in brushed steel with engraved tick marks, subtle teal and gold accent lines in an art-deco geometric pattern, symmetrical, no text, no letters, no numbers, no logo. 1024x1536.

**Arte da vitrine do hub (`web/public/games/cofre.png`, mesmo estilo das outras):**
> Three vault-style playing cards fanned out, one flipping to reveal a diamond, with gold bars and a pearl necklace spilling out, glossy colorful 3D render like a premium mobile game icon, transparent background, no text.

Os arquivos vão em `web/public/games/cofre/cards/<nome>.png`, e o verso em `.../back.png`.
