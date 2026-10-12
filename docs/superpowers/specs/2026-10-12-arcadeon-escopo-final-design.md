# Arcadeon: escopo final (visual, economia, loja, social)

Data: 2026-10-12 · Autor: sessão Frontend · Status: aguardando revisão do usuário

Referências de decisão:
- Proposta visual aprovada (8 itens): https://claude.ai/artifact/VWxeqtUaFQPS7Rs2egdx6C
- Escopo final com as escolhas: https://claude.ai/artifact/6D7PPxJSXqxuj6PPbTiYft

## 1. Objetivo

Fazer as pessoas voltarem ao Arcadeon todo dia e trazerem amigos. Em 12/10/2026 havia 9 contas, e só 2 jogaram o Letrado nos últimos 7 dias. Dos 4 jogos, só o Letrado dá moedas. Buggle, Rabiscado e Corrida não deixam registro de quem jogou.

Critérios de sucesso:
- A retenção D1 e D7 passa a ser medida (fase 0) e é acompanhada a cada fase.
- Jogar qualquer um dos 4 jogos rende algo que fica guardado: moedas, missão ou sequência.
- A loja tem avatares que as pessoas querem exibir, e nenhum avatar de emoji.
- Um usuário logado consegue adicionar um amigo, ver o que ele está fazendo e chamá-lo para uma sala em até 3 cliques.

## 2. Decisões do usuário (2026-10-12)

| Tema | Decisão |
|---|---|
| Ordem | Fase 0 (medir), depois visual, economia, loja, social |
| Sala de espera | Conta como **Online**, com o nome do jogo; a partida em andamento conta como **Jogando** |
| Status | Visível só para amigos, com a opção "aparecer offline" |
| Moedas em grupo | Por partida, limite de 60 por dia por usuário; a partida precisa terminar com 2 ou mais jogadores logados |
| Avatares | Todos os de emoji saem. Entra uma coleção própria gerada por IA, com guia de estilo único (apêndice A) |

## 3. Donos de cada parte

Segue o protocolo do vault (`Comunicacao/Protocolo.md`). Ninguém edita o território do outro, e os pedidos vão para `Pedidos-ao-Servidor.md`.

| Dono | Território neste escopo |
|---|---|
| **Frontend** | Telas do hub, `web/lib/{activity,presence,social,economy}.ts`, componentes novos, imagens em `web/public/avatars/`, página de créditos |
| **Servidor** | Tabelas, RLS, RPCs, Realtime, endpoint de busca de sala, pagamento de moedas no Node |
| **Buggle / Rabiscado** | Evento `identify` no socket, chamadas de atividade, status e missão, botão "Adicionar amigo" no fim da partida |
| **Corrida** | Chamadas de atividade, status e missão; botão "Adicionar amigo" |
| **Letrado** | Atividade e missão no diário, sequência integrada aos escudos, resultado dos amigos no Letrado |

## 4. Fase 0: medir

**Objetivo:** saber quem volta no dia seguinte e na semana seguinte, em qualquer jogo.

- **Tabela `daily_activity`:**
  - Colunas: `user_id` uuid nulo, `anon_key` text nulo, `day` date (dia de Brasília, mesma regra de `termo_today()`), `game` text (`hub` | `termo` | `buggle` | `drawit` | `corrida`), `count` int, `first_at` e `last_at`.
  - Um registro por (pessoa, dia, jogo).
  - Restrição: `user_id` ou `anon_key` precisa estar preenchido.
- **RPC `log_activity(p_game text, p_anon_key text)`:**
  - Pode ser chamada por `anon` e por `authenticated`.
  - Faz upsert e incrementa `count`.
  - Ignora `p_anon_key` quando há login.
- **Helper `web/lib/activity.ts` → `logActivity(game)`:**
  - Chave anônima no `localStorage`, a mesma usada pelo Letrado anônimo.
  - Deduplicação por sessão: no máximo uma chamada por jogo a cada 10 minutos.
  - O hub chama `logActivity("hub")` no layout. Cada jogo chama no início da partida.
- **View `retention_cohorts`:** só `service_role`. Por dia de primeira visita, mostra o total e quantos voltaram em D1 e em D7. É consultada pelo MCP do Supabase; não tem tela.

**Teste:** abrir o hub e iniciar uma partida de cada jogo, com e sem login, e conferir os registros.

## 5. Fase 1: visual

Os 8 itens do artifact "Arcadeon de cara nova", sem mudança de escopo:

1. O destaque da home para de avançar sozinho. As bolinhas viram abas com o nome e o padrão de cada jogo.
2. A coluna da home fica personalizada: convite para quem está deslogado; moedas, sequência e posição no ranking para quem está logado. Na fase 2 ela ganha as missões.
3. O Letrado vira um cartão largo quando for o único jogo em "Jogar sozinho".
4. Entrar numa sala com código:
   - Precisa do endpoint `GET /rooms/:code`, que devolve `{ games: Array<"buggle"|"drawit"|"corrida"> }`. Os códigos são gerados separadamente em cada namespace, então podem coincidir.
   - Se o código existir em um jogo, o site navega para `/games/<jogo>?join=CÓDIGO`.
   - Se existir em mais de um, a pessoa escolhe o jogo.
   - Se não existir em nenhum, aparece "Sala não encontrada. Confira o código com quem criou a sala."
5. Placares com três níveis visuais: jogo, modo e critério. O estado vazio ganha explicação e botão para jogar. Sai o botão "← Hub".
6. Loja com esqueleto no carregamento, botão "Entre para comprar" e largura máxima igual à dos placares.
7. Rótulos em caixa normal. O rodapé da barra lateral mostra o progresso do dia; na fase 4, mostra os amigos online.
8. Os padrões dos jogos viram utilitários CSS (`.pattern-<jogo>`) e passam a aparecer no cartão de compartilhamento, num ícone quadrado do app e nos vazios.

**Teste:**
- `next build`.
- Prints em 1440 px e 390 px, nos temas claro e escuro.
- Navegar só pelo teclado, com o foco visível.
- Ativar `prefers-reduced-motion` e conferir que nada se move.

## 6. Fase 2: economia

### 6.1 Livro de moedas

- **Tabela `coin_ledger`:**
  - Colunas: `id`, `user_id`, `day`, `amount`, `source` (`match` | `mission` | `streak` | `purchase` | `refund` | `termo`), `game` nulo, `ref` text nulo, `created_at`.
  - Toda mudança de saldo passa por ela, e `profiles.coins` continua sendo a soma.
  - A partir daqui, as RPCs que já existem (`purchase_avatar`, `termo_daily_guess` e as outras) também gravam no livro.

### 6.2 Moedas por partida em grupo

- **RPC `award_match_coins(p_user_id, p_game, p_placement, p_logged_players, p_match_id)`:** só `service_role`, chamada pelo servidor Node no fim da partida.
- **Valores:** 5 por terminar a partida, mais 5 por ficar entre os 3 primeiros, mais 10 pelo 1º lugar. O máximo é 20 por partida.
- **Limite:** 60 por dia por usuário, somando os três jogos em grupo. Acima disso a RPC grava 0, sem erro.
- **Condição:** pelo menos 2 jogadores logados no fim da partida (`p_logged_players >= 2`).
- **`p_match_id`:** evita pagar duas vezes a mesma partida.
- **Pré-requisito no Buggle e no Rabiscado:** o evento `identify { accessToken }`, igual ao do `/race`, verificado no servidor.
- **Na tela de resultado:** "+15 moedas" ao lado do próprio nome. Ao bater o limite, aparece "Limite de moedas de hoje atingido".

### 6.3 Missões do dia

- **Tabelas:**
  - `mission_templates`: `id`, `game`, `kind`, `target`, `reward`, `text`.
  - `user_daily_missions`: `user_id`, `day`, `template_id`, `progress`, `completed_at`.
- **Sorteio:** 3 missões por dia, feito na primeira chamada de `get_daily_missions()` (`authenticated`). Pelo menos 2 jogos diferentes, sempre com uma missão "fácil".
- **Progresso:**
  - `mission_progress(p_user_id, p_kind, p_amount)`: só `service_role`, chamada pelo Node.
  - O Letrado incrementa dentro das próprias RPCs.
- **Exemplos de `kind`:** `termo_win`, `draw_correct_guess`, `buggle_words`, `race_finish`, `race_with_friend` (na fase 4), `play_any`.
- **Recompensa:**
  - Cada missão paga ao completar, com crédito automático.
  - As três completas pagam um baú de +30.
  - Missões não contam no limite de 60.
- **Tela:** cartão "Missões de hoje" na coluna da home, com barra de progresso e contagem até a virada do dia.

### 6.4 Sequência do Arcadeon

- **Colunas novas em `profiles`:** `arcadeon_streak`, `arcadeon_best_streak`, `arcadeon_last_day`.
- **O que conta o dia:** terminar uma partida de qualquer jogo, incluindo o diário do Letrado. Só abrir o site não conta.
- **Calendário de 7 dias:** 10, 10, 15, 15, 20, 25 e baú de 50. Depois do 7º dia, o ciclo recomeça.
  - O resgate é feito por `claim_streak_reward()` e só funciona se o dia já contou.
- **Escudos:** o escudo de sequência que já existe protege também esta sequência. A regra fica com a sessão Letrado, dona dos escudos, em coordenação com o Servidor.
- **Tela:** calendário na coluna da home e no perfil. Nenhuma mensagem de culpa.

**Teste:**
- Simular partidas pelos scripts de simulação que já existem (`race-sim`, `draw-sim`) com 2 contas logadas.
- Conferir o limite de 60 e o bloqueio de pagamento duplo.
- Conferir a virada do dia em Brasília.

## 7. Fase 3: loja

### 7.1 Saída dos avatares de emoji

- **Coluna nova `avatars.retired boolean`.**
  - Os 8 avatares atuais de emoji ficam `retired = true` e somem da loja.
  - O Galo também sai: lembra o Heihei, de Moana (Disney). Uma versão original entra na coleção nova.
  - O Robô com capacete fica e é comprimido de 1,6 MB para menos de 60 KB.
- **Quem comprou um avatar de emoji:**
  - Recebe as moedas de volta, com `source = refund`.
  - Passa a usar um dos avatares iniciais grátis.
- **Avatares de conquista (Estrela, Fênix):** ganham arte nova no estilo da coleção e continuam presos à mesma conquista.
- **`emoji` em `PlayerAvatar`:** continua existindo como fallback para jogador anônimo nas salas.

### 7.2 Coleção nova

- **Tamanho:** cerca de 24 avatares em 4 raridades, conforme o apêndice A.
- **Iniciais:** 4 avatares grátis, liberados no cadastro.
- **Arquivos:** imagens em `web/public/avatars/<slug>.webp`, 512×512, com menos de 60 KB cada.
- **Coluna nova `avatars.rarity`:** `common` | `rare` | `epic` | `legendary`.
- **Faixas de preço:** comum 30–50, raro 80–120, épico 180–250, lendário 400+. Os lendários também podem ser liberados por conquista.

### 7.3 Cosméticos

- **Tabela `cosmetics`:**
  - Colunas: `id`, `kind` (`frame` | `title` | `name_color`), `slug`, `name`, `rarity`, `price_coins` nulo, `unlock_achievement_id` nulo, `game` nulo.
  - Posse em `user_cosmetics`.
  - Equipados em `profiles.equipped_frame_id`, `equipped_title_id` e `equipped_name_color_id`.
- **Molduras:** usam os padrões dos jogos. A moldura de cada jogo só se ganha jogando aquele jogo (missão ou conquista).
- **Títulos:** as conquistas que já existem viram títulos. Ficam liberados automaticamente quando a conquista sai.
- **Exibição:** avatar, moldura, título e cor do nome aparecem no header, nos placares, nas salas (o payload `PlayerAvatar` ganha `frame` e `title`, a cargo das sessões de jogo) e na lista de amigos.

### 7.4 Loja do dia

- **RPC `get_daily_shop()`:** devolve 4 itens escolhidos de forma determinística pelo dia. Um deles tem 20% de desconto.
- Itens lendários aparecem no máximo uma vez por semana.
- Tudo volta a rodar; nenhum item some para sempre.
- **Compra:** `purchase_item(p_kind, p_id)` substitui e generaliza `purchase_avatar`.

### 7.5 Créditos

Página `/creditos` com as ferramentas e fontes de arte, e as licenças que pedirem atribuição.

**Teste:**
- Comprar, equipar e conferir a exibição nos 4 jogos.
- Conferir o reembolso de quem tinha avatar de emoji.
- Conferir a rotação da loja de um dia para o outro.

## 8. Fase 4: social

### 8.1 Amizades

- **Tabela `friendships`:**
  - Colunas: `id`, `requester_id`, `addressee_id`, `status` (`pending` | `accepted`), `created_at`, `responded_at`.
  - O par é único sem importar a ordem.
- **RPCs (`authenticated`):**
  - `send_friend_request(p_username)`.
  - `respond_friend_request(p_id, p_accept)`.
  - `remove_friend(p_user_id)`.
  - `my_friends()`: devolve o perfil, o status e o cosmético equipado de cada amigo.
- **Três jeitos de adicionar:**
  1. Busca por nome de usuário.
  2. Botão "Adicionar" ao lado de cada jogador logado na tela de resultado. Para isso, o payload do jogador ganha um `userId` público quando ele está identificado.
  3. Link pessoal `/amigo/<username>`. Sem login, a pessoa cria a conta e o pedido sai em seguida.
- **Limites:** 200 amigos por pessoa e 20 pedidos pendentes enviados por dia.

### 8.2 Status

- **Tabela `user_status`:**
  - Colunas: `user_id` (chave primária), `state` (`online` | `playing`), `game` nulo, `place` (`hub` | `shop` | `leaderboard` | `profile` | `lobby` | `match`), `room_code` nulo, `appear_offline` boolean, `updated_at`.
- **RPC `set_status(...)`:** chamada pelo helper `web/lib/presence.ts`.
  - É chamada a cada troca de página e a cada 30 s com a aba visível.
  - Para quando a aba fica oculta.
- **Offline:** é derivado de `updated_at` mais velho que 2 min. Não existe estado gravado como "offline".
- **RLS:** a leitura é permitida só para amigos aceitos e só quando `appear_offline = false`. Os amigos recebem as mudanças por `postgres_changes` filtrado.
- **Textos:**
  - "Jogando Rabiscado · 3 de 8 na sala".
  - "Online · na sala de espera da Corrida".
  - "Online · na loja".
  - "Offline · visto há 2 h".
- **Sessões de jogo:** chamam `setStatus({ state: "online", place: "lobby", game, roomCode })` ao entrar na sala de espera, `setStatus({ state: "playing", place: "match", game, roomCode })` no início da partida e voltam para lobby ao terminar.
- **Botão "Entrar":** aparece no amigo que está em uma sala de espera ou partida. Abre `/games/<jogo>?join=<roomCode>`. Se a partida já começou e o jogo não aceita entrada no meio, vale o `join-error` que já existe.

### 8.3 Convites para partida

- **Tabela `game_invites`:**
  - Colunas: `id`, `from_id`, `to_id`, `game`, `room_code`, `created_at`, `expires_at` (+10 min), `status` (`sent` | `accepted` | `declined` | `expired`).
- **RLS:**
  - Só pode enviar para um amigo aceito.
  - Só o destinatário lê.
  - Limite de 1 convite por amigo por sala.
- **Entrega:** por `postgres_changes`. Aparece um aviso em qualquer página com "Entrar na sala" e "Agora não".
- **Sino no header:** junta pedidos de amizade e convites que chegaram com a aba fechada e ainda não expiraram.
- **Botão "Convidar amigos" na sala de espera:** abre a lista de amigos online. Fica a cargo das sessões de jogo, usando um componente que eu entrego.

### 8.4 Amigos no Letrado

Ao terminar o diário, a pessoa vê o resultado dos amigos (tentativas, tempo, sem revelar a palavra). Fica a cargo da sessão Letrado, lendo `my_friends()`.

**Teste:**
- Usar 2 contas em 2 navegadores: pedido, aceite, status nos 3 estados, aparecer offline, convite aceito e expirado.
- Tentar burlar a RLS lendo o status de quem não é amigo.

## 9. Fora do escopo

- Chat entre amigos, porque exige moderação e denúncia.
- Notificação por push fora do site.
- Compra de moedas com dinheiro.
- Caixas com prêmio aleatório.
- Itens que somem para sempre.
- Status para quem joga sem conta.

## 10. Riscos

- **Fazenda de moedas:** duas contas da mesma pessoa numa sala. O limite diário reduz o problema. Detecção mais forte fica para depois, se a fase 0 mostrar abuso.
- **Render no plano grátis dorme:** a primeira partida do dia demora a abrir. Não afeta status nem convites, que ficam no Supabase.
- **Avatares gerados por IA:** cada personagem precisa ser original. Nada de personagem, marca ou estilo identificável de terceiros.

## Apêndice A: guia de estilo dos avatares

A base é o "Robô com capacete", o avatar atual mais forte visualmente.

**Regras de estilo**
- Mascote em estilo vetorial de e-sports, contorno preto grosso e sombreamento em 2 ou 3 tons chapados.
- Busto centralizado, olhando para a frente ou em 3/4, ocupando cerca de 75% do quadro.
- Fundo de cor sólida, que muda por raridade: comum em tons suaves; raro em azul (`#1c8fd6`); épico em roxo da marca (`#7c5cff`); lendário em laranja-ouro (`#e58a0c`) com brilho leve.
- 1:1, 1024×1024. Sem texto, sem logo, sem moldura.
- Expressão marcante, porque o avatar aparece a 40 px. A silhueta precisa ser legível em tamanho pequeno.

**Modelo de prompt**
> esports mascot logo style avatar, bust portrait of {PERSONAGEM}, {DETALHE}, bold thick black outline, flat cel shading with 3 tones, vibrant colors, centered, facing viewer, solid {COR} background, square 1:1, clean vector illustration, no text, no logo, no border, original character

**Lista proposta**

| Raridade | Personagem | Detalhe |
|---|---|---|
| Inicial (grátis) | Raposa gamer | fone de ouvido, sorriso confiante |
| Inicial (grátis) | Gato astronauta | capacete com visor aberto |
| Inicial (grátis) | Capivara tranquila | óculos escuros, calma total |
| Inicial (grátis) | Robô simpático | antena e olhos de LED verdes |
| Comum | Coruja estudiosa | óculos redondos, livro |
| Comum | Sapo skatista | boné virado |
| Comum | Pinguim detetive | chapéu e lupa |
| Comum | Panda dorminhoco | gorro de dormir |
| Comum | Tucano DJ | fones neon e toca-discos |
| Comum | Galo de briga (original) | crista vermelha, olhar desafiador |
| Raro | Lobo da noite | olhos azuis brilhando |
| Raro | Polvo pintor | pincéis nos tentáculos (Rabiscado) |
| Raro | Onça pintada | marcas douradas, olhar feroz |
| Raro | Tubarão piloto | óculos de aviador (Corrida) |
| Raro | Mago das letras | chapéu com letras flutuando (Letrado) |
| Raro | Abelha das palavras | favo com letras (Buggle) |
| Épico | Samurai raposa | armadura e katana nas costas |
| Épico | Ninja panda | máscara e faixa roxa |
| Épico | Caveira mexicana | flores e cores vivas |
| Épico | Ciborgue leão | metade metálica |
| Lendário | Dragão de cristal | escamas translúcidas |
| Lendário | Fênix (mesma conquista que libera a Fênix hoje) | chamas vivas |
| Lendário | Estrela cadente (mesma conquista que libera a Estrela hoje) | rastro brilhante |
| Lendário | Robô com capacete (atual) | mantido |

**Entrega:**
- O usuário gera as imagens na ferramenta que preferir.
- A sessão Frontend recorta, converte para `.webp`, comprime e cadastra o pedido de inserção no catálogo.
- O usuário aprova a arte antes de ela entrar na loja.
