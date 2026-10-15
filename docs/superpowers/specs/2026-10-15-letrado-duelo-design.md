# Letrado — Duelo (design)

Data: 2026-10-15 · Dono: sessão Letrado

## Objetivo

Duas pessoas logadas jogam o Letrado ao vivo, uma contra a outra, com as mesmas palavras, em qualquer modo (Letrado, Duplo, Quádruplo). Vence quem resolver todos os tabuleiros primeiro. Se ninguém resolver, vence quem chegou mais perto. O resultado fica salvo e vira um placar histórico contra aquele amigo.

### Decisões do usuário

- Corrida ao vivo: os dois jogam ao mesmo tempo, e quem resolver primeiro pelo relógio vence na hora.
- Se ninguém resolver, conta a "melhor linha" por tabuleiro: verde vale 2, amarelo vale 1, tabuleiro resolvido vale 10. Se empatar, ganha quem terminou antes.
- O duelo começa por convite a um amigo da lista ou por link/código. Os dois precisam estar logados.
- O resultado vale placar entre amigos, sem moedas.
- Abordagem A: funções no Supabase (RPCs) + Realtime. O `server/` (socket.io) não é tocado.

### Fora do escopo

- Moedas, ranking global de duelo, conquistas de duelo.
- Duelo com mais de 2 pessoas.
- Dicas, modo difícil, Contra o Tempo e Vilão dentro do duelo.
- Revanche automática. A tela final pode ter só "Novo duelo", que cria outra sala e convida o mesmo amigo.

## Regras

- **Palavras**: o banco sorteia `board_count` palavras distintas de `termo_words` quando a sala é criada. O cliente só vê as palavras quando o duelo termina.
- **Tentativas**: `board_count + 5`, igual ao Diário. Cada jogador tem as suas.
- **Palpite válido**: o formato é checado no banco (`^[a-z]{5}$`). O dicionário é checado no cliente, igual ao Diário.
- **Fim imediato**: quando um jogador resolve todos os tabuleiros, o duelo termina para os dois e esse jogador vence. O relógio que conta é `now()` do banco, dentro da transação, com a linha da sala travada (`for update`). Assim dois "resolveu" quase juntos não geram dois vencedores.
- **Ninguém resolveu**: quando o segundo jogador esgota as tentativas, o banco calcula a pontuação de cada um.
  - Para cada tabuleiro: 10 se resolvido; senão, o máximo, entre todas as linhas, de `2·verdes + amarelos`.
  - A pontuação total é a soma dos tabuleiros. A maior vence. Se empatar, vence quem terminou as tentativas primeiro.
  - Um jogador que acabou as tentativas espera o outro, vendo o progresso dele.
- **Abandono**:
  - "Desistir" encerra o duelo e o rival vence.
  - Cada jogador manda um sinal de vida a cada 15 s (`last_seen_at`). Se o rival ficar 60 s sem sinal, o jogador presente pode pedir a vitória, e o banco confere o tempo.
  - Na sala de espera, a sala expira se ficar 15 minutos sem começar.
- **Placar**: só conta duelo `finished` com vencedor. Abandono conta como vitória.

## Banco (migration `2026101503xxxx_termo_duelo.sql`)

### Tabelas

`termo_duels`: a sala. Os dois participantes podem ler (RLS); ninguém escreve direto.

| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| code | text unique | 5 letras `^[A-HJ-NP-Z2-9]{5}$`, mesmo formato dos outros jogos |
| board_count | int | 1, 2 ou 4 |
| host_id | uuid | quem criou |
| guest_id | uuid null | quem entrou |
| status | text | `waiting` → `playing` → `finished` (ou `expired`) |
| created_at, started_at, finished_at | timestamptz | `started_at` = início, já somada a contagem de 3 s |
| winner_id | uuid null | |
| end_reason | text null | `solved`, `closest`, `forfeit`, `abandoned` |

`termo_duel_words` (duel_id pk, words text[]): sem policy nenhuma. Só as funções `security definer` leem.

`termo_duel_players` (duel_id, user_id, pk composta): os dois participantes podem ler.

| coluna | nota |
|---|---|
| patterns | `text[]`, um item por palpite: as cores de cada tabuleiro, como `"CPAAA"` por tabuleiro, separadas por `\|`. Nunca as letras. É o que o rival vê. |
| solved | `int[]`, o índice do palpite que resolveu cada tabuleiro (`null` se não resolveu) |
| finished_at, score | preenchidos quando o jogador acaba |
| last_seen_at | sinal de vida |

`termo_duel_guesses` (duel_id, user_id, guesses text[]): sem policy. As letras dos palpites ficam só no banco até o fim.

Realtime: `termo_duels` e `termo_duel_players` entram na `supabase_realtime`. A RLS filtra o que cada um recebe.

### Funções (todas `security definer`, `set search_path = ''`, só `authenticated`)

- `termo_duel_create(p_board_count)`: cria a sala com um código único e as palavras. Devolve `{ code }`. Fecha (`expired`) salas `waiting` antigas do mesmo dono.
- `termo_duel_join(p_code)`: entra como convidado. Erro se a sala está cheia, expirou ou se o dono tenta entrar na própria sala.
- `termo_duel_start(p_code)`: só o dono, só com o convidado presente. `started_at = now() + 3s`.
- `termo_duel_state(p_code)`: estado completo para quem está na sala. Inclui os meus palpites com letras, os `patterns` do rival e, se o duelo terminou, as palavras e os palpites do rival.
- `termo_duel_guess(p_code, p_guess)`: recusa palpites antes de `started_at`, depois do fim ou além das tentativas. Avalia o palpite, grava `patterns`/`solved`, aplica as regras de fim e devolve o estado.
- `termo_duel_ping(p_code)`: atualiza `last_seen_at`.
- `termo_duel_forfeit(p_code)`: desistir.
- `termo_duel_claim(p_code)`: pede a vitória por abandono (rival com mais de 60 s sem sinal).
- `termo_duel_record(p_friend)`: `{ wins, losses }` meus contra aquele amigo.

A avaliação de cores segue a mesma regra do cliente (`evaluateGuess` em `web/lib/termo/logic.ts`): verdes primeiro, depois amarelos com contagem de letras. Escrevo uma função SQL `termo_eval(guess, answer) returns text` e testo contra os mesmos casos da lógica do cliente.

### Convite (depende de outra sessão)

- `send_game_invite` só aceita `buggle|drawit|corrida`. Falta incluir `termo`.
- No cliente, `MULTIPLAYER` em `web/lib/social/rules.ts` também precisa de `termo`.
- O link do convite já é `/games/<jogo>?join=<código>`. O duelo usa o mesmo formato: `/games/termo?join=K7M2Q`.
- Peço ao Servidor e ao Frontend pelo vault (`Pedidos-ao-Servidor.md`). Até lá funciona o link/código copiado.

## Cliente

- `web/lib/termo/duel.ts`: chamadas às RPCs, parse do estado (com testes), assinatura do Realtime (`postgres_changes` em `termo_duels` e `termo_duel_players` filtrado pelo `duel_id`) com uma busca de segurança a cada 10 s (o mesmo padrão de `FriendsProvider`) e o sinal de vida a cada 15 s.
- `web/lib/termo/duelScore.ts`: a pontuação de "mais perto", só para mostrar o detalhe na tela final. A decisão é do banco. Tem teste.
- `web/components/termo/duel/`:
  - `DuelLobby.tsx`: escolher o modo, criar a sala, convidar amigo (lista de `FriendsProvider`), copiar link/código, ver quem entrou, botão Começar (dono), contagem de 3 s.
  - `DuelGame.tsx`: reaproveita `Boards`, `Keyboard`, `useWordInput` e `useFitBoards`. Em cima fica o mini-tabuleiro do rival (só cores, células pequenas, um por tabuleiro) com o nome e o avatar. Tem o botão Desistir e o aviso "Rival desconectado. Reivindicar vitória" depois de 60 s.
  - `DuelResult.tsx`: vencedor e motivo, pontuação de cada um quando o motivo é `closest`, as palavras, o placar contra o amigo e os botões "Novo duelo" / "Voltar".
- `ModeMenu`: novo cartão "Duelo" em "Outros desafios" (`ExtraMode` ganha `"duel"`). Sem login, ele abre o pedido de login.
- `TermoGame`: `?join=CODE` abre o duelo. `?desafio=` continua igual. O duelo não chama as rotinas do Diário (sequência, escudo, conquistas) e chama `logActivity("termo")` ao entrar.
- F5 no meio do duelo: o código fica em `sessionStorage` e o estado volta por `termo_duel_state`.

## Erros

- Sala inexistente, cheia ou expirada: mensagem na tela e volta para o Letrado.
- Realtime caiu: a busca de 10 s mantém tudo certo. Mostra "Reconectando…" se a RPC falhar.
- Palpite enviado depois do fim: o banco devolve o estado final e o cliente mostra o resultado.
- Os erros das RPCs viram texto em português por `rpcErrorMessage`.

## Testes

- Dry-run SQL no banco real (DO block que termina com exception, nada fica gravado), com duas contas de teste, cobrindo:
  - criar, entrar, começar;
  - palpite antes do início (recusado);
  - vitória por resolver;
  - empate de "resolveu" na mesma transação;
  - os dois esgotando, decidido por pontuação;
  - pontuação empatada, decidida pelo tempo;
  - desistência;
  - reivindicação com o rival presente (recusada) e ausente (aceita);
  - RLS: rival não lê `termo_duel_guesses` nem `termo_duel_words`;
  - placar.
- `termo_eval` versus `evaluateGuess` com os mesmos casos (letras repetidas).
- Testes de unidade (node:test, igual a `rules.test.ts`) para o parse do estado e para `duelScore`.
- Playwright com duas abas e duas contas: duelo completo no celular (390x664) nos três modos.

## Ordem de entrega

1. Migration + dry-run.
2. `duel.ts` + `duelScore.ts` com testes.
3. Lobby → jogo → resultado.
4. Teste com duas abas, commit, push.
5. Pedidos no vault (convite `termo`), notas em `03-Termo-Game.md`, subagente `letrado.md`.
