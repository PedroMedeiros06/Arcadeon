-- Termo diario validado no servidor.
-- Antes: o cliente sorteava a palavra, avaliava os palpites e gravava resultado/placar direto
-- nas tabelas (qualquer um podia mandar attempts=1 pela API). Agora o banco guarda as palavras
-- do dia, recebe cada palpite, devolve as cores e, no fim, grava resultado, placar, sequencia e
-- moedas numa transacao so. O cliente nao escreve mais em termo_daily_results/termo_scores.

-- 1) palavras-alvo (espelho de web/public/words5_target.txt sem as ofensivas; manter em sincronia)
create table public.termo_words (
  word text primary key check (word ~ '^[a-z]{5}$')
);
alter table public.termo_words enable row level security;

-- 2) palavras sorteadas por dia/modo (geradas na primeira requisicao do dia; nunca expostas antes do fim)
create table public.termo_daily_words (
  play_date date not null,
  board_count integer not null check (board_count in (1, 2, 4)),
  words text[] not null,
  primary key (play_date, board_count)
);
alter table public.termo_daily_words enable row level security;

-- 3) partida diaria em andamento/terminada, por usuario ou por anon_key
create table public.termo_daily_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_key text,
  board_count integer not null check (board_count in (1, 2, 4)),
  play_date date not null,
  guesses text[] not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  won boolean,
  attempts integer,
  time_seconds integer,
  constraint termo_daily_games_identity check (user_id is not null or anon_key is not null)
);
create unique index termo_daily_games_user_key
  on public.termo_daily_games (user_id, board_count, play_date) where user_id is not null;
create unique index termo_daily_games_anon_key
  on public.termo_daily_games (anon_key, board_count, play_date) where user_id is null;
alter table public.termo_daily_games enable row level security;

-- dia do jogo no fuso do Brasil (antes era UTC e virava as 21h)
create function public.termo_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- mesma regra do cliente: C = lugar certo, P = em outro lugar, A = ausente (trata letra repetida)
create function public.termo_evaluate(p_guess text, p_target text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  res text[] := array['A', 'A', 'A', 'A', 'A'];
  cnt integer[] := array_fill(0, array[26]);
  i integer;
  c integer;
begin
  for i in 1..5 loop
    if substr(p_guess, i, 1) = substr(p_target, i, 1) then
      res[i] := 'C';
    else
      c := ascii(substr(p_target, i, 1)) - 96;
      cnt[c] := cnt[c] + 1;
    end if;
  end loop;
  for i in 1..5 loop
    if res[i] = 'A' then
      c := ascii(substr(p_guess, i, 1)) - 96;
      if cnt[c] > 0 then
        res[i] := 'P';
        cnt[c] := cnt[c] - 1;
      end if;
    end if;
  end loop;
  return array_to_string(res, '');
end;
$$;

-- anti-colisao do Dueto/Quarteto: no maximo 1 letra em comum e nenhuma na mesma posicao
create function public.termo_too_similar(a text, b text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    (select count(distinct l) from unnest(string_to_array(a, null)) as l where strpos(b, l) > 0) > 1
    or (select count(*) from generate_series(1, 5) as i where substr(a, i, 1) = substr(b, i, 1)) > 0
$$;

create function public.termo_pick_words(p_count integer)
returns text[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  pool text[];
  len integer;
  chosen text[] := '{}';
  w text;
  skips integer := 0;
begin
  select array_agg(word) into pool from public.termo_words;
  len := coalesce(array_length(pool, 1), 0);
  if len < p_count then
    raise exception 'termo_words vazia';
  end if;

  while coalesce(array_length(chosen, 1), 0) < p_count loop
    w := pool[1 + floor(random() * len)::integer];
    continue when w = any(chosen);
    -- valvula de escape: depois de muitas tentativas aceita palavra parecida pra nao travar
    if skips < len * 4 and exists (select 1 from unnest(chosen) as c where public.termo_too_similar(w, c)) then
      skips := skips + 1;
      continue;
    end if;
    chosen := chosen || w;
  end loop;
  return chosen;
end;
$$;

create function public.termo_get_daily_words(p_date date, p_board_count integer)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_words text[];
begin
  select words into v_words from public.termo_daily_words
    where play_date = p_date and board_count = p_board_count;
  if v_words is null then
    insert into public.termo_daily_words (play_date, board_count, words)
      values (p_date, p_board_count, public.termo_pick_words(p_board_count))
      on conflict do nothing;
    select words into v_words from public.termo_daily_words
      where play_date = p_date and board_count = p_board_count;
  end if;
  return v_words;
end;
$$;

-- acha (ou cria) a partida de hoje do jogador. Logado sem partida propria herda a partida
-- anonima do mesmo aparelho, pra nao poder jogar o diario de novo so por entrar na conta.
create function public.termo_find_or_create_game(p_board_count integer, p_anon_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := public.termo_today();
  v_id uuid;
  v_legacy record;
begin
  if p_board_count not in (1, 2, 4) then
    raise exception 'invalid board_count';
  end if;
  if v_uid is null and (p_anon_key is null or length(p_anon_key) not between 16 and 64) then
    raise exception 'anon_key required';
  end if;

  perform public.termo_get_daily_words(v_date, p_board_count);

  if v_uid is not null then
    select id into v_id from public.termo_daily_games
      where user_id = v_uid and board_count = p_board_count and play_date = v_date;
    if v_id is null and p_anon_key is not null then
      update public.termo_daily_games set user_id = v_uid
        where anon_key = p_anon_key and user_id is null
          and board_count = p_board_count and play_date = v_date
        returning id into v_id;
    end if;
  else
    select id into v_id from public.termo_daily_games
      where anon_key = p_anon_key and user_id is null
        and board_count = p_board_count and play_date = v_date;
  end if;

  if v_id is null then
    -- resultado gravado pelo cliente antigo (antes desta migracao) conta como partida terminada
    select won, attempts, time_seconds into v_legacy from public.termo_daily_results r
      where r.board_count = p_board_count and r.play_date = v_date
        and ((v_uid is not null and r.user_id = v_uid) or (v_uid is null and r.anon_key = p_anon_key))
      limit 1;

    insert into public.termo_daily_games
        (user_id, anon_key, board_count, play_date, finished_at, won, attempts, time_seconds)
      values (
        v_uid,
        case when v_uid is null then p_anon_key end,
        p_board_count,
        v_date,
        case when v_legacy.won is not null then now() end,
        v_legacy.won,
        v_legacy.attempts,
        v_legacy.time_seconds
      )
      on conflict do nothing
      returning id into v_id;

    if v_id is null then
      -- outra requisicao criou ao mesmo tempo
      select id into v_id from public.termo_daily_games
        where board_count = p_board_count and play_date = v_date
          and ((v_uid is not null and user_id = v_uid)
            or (v_uid is null and anon_key = p_anon_key and user_id is null));
    end if;
  end if;

  return v_id;
end;
$$;

-- estado da partida pro cliente. As respostas so vao junto depois que a partida termina.
create function public.termo_game_state(p_game_id uuid)
returns jsonb
language plpgsql
volatile -- stable usaria o snapshot da chamada e nao veria a partida recem-criada
security definer
set search_path = ''
as $$
declare
  g public.termo_daily_games;
  v_answers text[];
  v_evals jsonb;
begin
  select * into g from public.termo_daily_games where id = p_game_id;
  select words into v_answers from public.termo_daily_words
    where play_date = g.play_date and board_count = g.board_count;

  select coalesce(jsonb_agg(
      (select jsonb_agg(public.termo_evaluate(u.guess, t.answer) order by t.ord)
         from unnest(v_answers) with ordinality as t(answer, ord))
      order by u.ord), '[]'::jsonb)
    into v_evals
    from unnest(g.guesses) with ordinality as u(guess, ord);

  return jsonb_build_object(
    'board_count', g.board_count,
    'play_date', g.play_date,
    'max_attempts', g.board_count + 5,
    'guesses', to_jsonb(g.guesses),
    'evaluations', v_evals,
    'finished', g.finished_at is not null,
    'won', g.won,
    'attempts', g.attempts,
    'time_seconds', g.time_seconds,
    'started_at', g.started_at,
    'answers', case when g.finished_at is not null then to_jsonb(v_answers) end
  );
end;
$$;

create function public.termo_daily_state(p_board_count integer, p_anon_key text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return public.termo_game_state(public.termo_find_or_create_game(p_board_count, p_anon_key));
end;
$$;

create function public.termo_daily_guess(p_board_count integer, p_anon_key text, p_guess text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  g public.termo_daily_games;
  v_guess text := lower(p_guess);
  v_answers text[];
  v_guesses text[];
  v_solved boolean;
  v_attempts integer;
  v_time integer;
  v_streak integer;
  v_coins integer := 0;
begin
  if v_guess is null or v_guess !~ '^[a-z]{5}$' then
    raise exception 'invalid guess';
  end if;

  v_id := public.termo_find_or_create_game(p_board_count, p_anon_key);
  -- trava a linha: dois Enter seguidos (ou duas abas) nao gravam em dobro
  select * into g from public.termo_daily_games where id = v_id for update;

  if g.finished_at is not null then
    return public.termo_game_state(v_id);
  end if;

  select words into v_answers from public.termo_daily_words
    where play_date = g.play_date and board_count = g.board_count;

  v_guesses := g.guesses || v_guess;
  v_attempts := array_length(v_guesses, 1);
  v_solved := not exists (select 1 from unnest(v_answers) as a where not a = any(v_guesses));

  if not v_solved and v_attempts < g.board_count + 5 then
    update public.termo_daily_games set guesses = v_guesses where id = v_id;
    return public.termo_game_state(v_id);
  end if;

  v_time := greatest(0, floor(extract(epoch from now() - g.started_at)))::integer;

  update public.termo_daily_games
    set guesses = v_guesses, finished_at = now(), won = v_solved,
        attempts = v_attempts, time_seconds = v_time
    where id = v_id;

  insert into public.termo_daily_results
      (user_id, anon_key, board_count, play_date, won, attempts, time_seconds)
    values (g.user_id, case when g.user_id is null then g.anon_key end,
            g.board_count, g.play_date, v_solved, v_attempts, v_time)
    on conflict do nothing;

  -- placar/ranking/sequencia/moedas so pra quem tem conta
  if g.user_id is not null then
    insert into public.termo_scores as s
        (user_id, board_count, attempts, time_seconds, wins, current_streak, best_streak, last_played_date, updated_at)
      values (g.user_id, g.board_count,
              case when v_solved then v_attempts end,
              case when v_solved then v_time end,
              v_solved::integer, v_solved::integer, v_solved::integer, g.play_date, now())
      on conflict (user_id, board_count) where user_id is not null do update set
        wins = s.wins + excluded.wins,
        current_streak = case
          when not v_solved then 0
          when s.last_played_date = g.play_date - 1 then s.current_streak + 1
          when s.last_played_date = g.play_date then greatest(s.current_streak, 1)
          else 1 end,
        best_streak = greatest(s.best_streak, case
          when not v_solved then 0
          when s.last_played_date = g.play_date - 1 then s.current_streak + 1
          when s.last_played_date = g.play_date then greatest(s.current_streak, 1)
          else 1 end),
        attempts = case
          when v_solved and (s.attempts is null or v_attempts < s.attempts
            or (v_attempts = s.attempts and v_time < s.time_seconds)) then v_attempts
          else s.attempts end,
        time_seconds = case
          when v_solved and (s.attempts is null or v_attempts < s.attempts
            or (v_attempts = s.attempts and v_time < s.time_seconds)) then v_time
          else s.time_seconds end,
        last_played_date = g.play_date,
        updated_at = now()
      returning current_streak into v_streak;

    if v_solved then
      insert into public.termo_win_rewards (user_id, play_date, board_count)
        values (g.user_id, g.play_date, g.board_count)
        on conflict do nothing;
      if found then
        v_coins := 10;
        perform public.award_coins_and_check_achievements(g.user_id, v_coins, 'termo_win');
      end if;
    end if;
  end if;

  return public.termo_game_state(v_id)
    || jsonb_build_object('current_streak', v_streak, 'coins_awarded', v_coins);
end;
$$;

-- 4) permissoes: so as duas RPCs publicas; helpers internos fechados
revoke execute on function public.termo_evaluate(text, text) from public, anon, authenticated;
revoke execute on function public.termo_too_similar(text, text) from public, anon, authenticated;
revoke execute on function public.termo_pick_words(integer) from public, anon, authenticated;
revoke execute on function public.termo_get_daily_words(date, integer) from public, anon, authenticated;
revoke execute on function public.termo_find_or_create_game(integer, text) from public, anon, authenticated;
revoke execute on function public.termo_game_state(uuid) from public, anon, authenticated;
revoke execute on function public.termo_daily_state(integer, text) from public;
revoke execute on function public.termo_daily_guess(integer, text, text) from public;
grant execute on function public.termo_daily_state(integer, text) to anon, authenticated;
grant execute on function public.termo_daily_guess(integer, text, text) to anon, authenticated;

-- moedas agora saem de dentro de termo_daily_guess
drop function public.claim_termo_win_reward(integer, date);

-- 5) cliente nao escreve mais resultado/placar; resultados diarios (com anon_key) deixam de ser publicos
drop policy if exists "Anyone can insert daily result" on public.termo_daily_results;
drop policy if exists "Daily results viewable by everyone" on public.termo_daily_results;
drop policy if exists "Users can insert own score" on public.termo_scores;
drop policy if exists "Users can update own score" on public.termo_scores;
revoke insert, update, delete on public.termo_daily_results from anon, authenticated;
revoke insert, update, delete on public.termo_scores from anon, authenticated;

-- 6) placar: sem linha anonima compartilhada; quem nunca venceu fica sem tentativas/tempo
delete from public.termo_scores where user_id is null;
drop index if exists public.termo_scores_anon_board_key;
alter table public.termo_scores alter column attempts drop not null;
alter table public.termo_scores alter column time_seconds drop not null;
update public.termo_scores set attempts = null, time_seconds = null where wins = 0;

-- ranking: so contas com ao menos 1 vitoria; sequencia atual zera se passou um dia sem jogar
create or replace view public.termo_leaderboard as
  select s.id,
    coalesce(p.username, 'Arcadeon'::text) as username,
    av.emoji as avatar_emoji,
    av.bg_color as avatar_bg_color,
    av.image_url as avatar_image_url,
    s.board_count,
    s.attempts,
    s.time_seconds,
    s.wins,
    s.best_streak,
    case when s.last_played_date >= public.termo_today() - 1 then s.current_streak else 0 end as current_streak,
    s.updated_at
  from public.termo_scores s
    left join public.profiles p on p.id = s.user_id
    left join public.avatars av on av.id = p.equipped_avatar_id
  where s.user_id is not null and s.wins > 0
  order by s.attempts, s.time_seconds;

-- 7) carga das palavras
insert into public.termo_words (word) values
  ('abaco'), ('abala'), ('abalo'), ('abana'), ('abata'), ('abriu'), ('abusa'), ('abuso'), ('acaba'), ('aceno'), ('acima'), ('adaga'),
  ('adubo'), ('afoga'), ('afeta'), ('afago'), ('afeto'), ('afiar'), ('afins'), ('agora'), ('aguar'), ('ajuda'), ('ajudo'), ('alado'),
  ('alega'), ('almas'), ('altar'), ('altos'), ('aluno'), ('amado'), ('amava'), ('ambas'), ('ambos'), ('amena'), ('amiga'), ('amigo'),
  ('amora'), ('amplo'), ('andar'), ('andei'), ('aneis'), ('anexo'), ('anima'), ('anime'), ('animo'), ('antes'), ('anzol'), ('aonde'),
  ('apaga'), ('apego'), ('apelo'), ('apito'), ('apoia'), ('apura'), ('arado'), ('arara'), ('arcar'), ('areia'), ('arena'), ('aroma'),
  ('arpao'), ('artes'), ('asilo'), ('assou'), ('astro'), ('atado'), ('atlas'), ('atomo'), ('atrai'), ('atuar'), ('atual'), ('autor'),
  ('autos'), ('aviso'), ('azedo'), ('azuis'), ('alvos'), ('andou'), ('antas'), ('bacia'), ('bando'), ('banha'), ('banho'), ('barco'),
  ('barro'), ('bases'), ('batia'), ('bazar'), ('bebam'), ('bebes'), ('bebeu'), ('beira'), ('belos'), ('berro'), ('bicho'), ('bicos'),
  ('bingo'), ('bioma'), ('birra'), ('bispo'), ('blusa'), ('bocal'), ('boiar'), ('boina'), ('bolha'), ('bolso'), ('bomba'), ('bambu'),
  ('bonus'), ('bordo'), ('botao'), ('botar'), ('botas'), ('brasa'), ('breve'), ('briga'), ('brisa'), ('broca'), ('broto'), ('bruxa'),
  ('bucho'), ('burra'), ('burro'), ('barba'), ('banal'), ('banda'), ('beijo'), ('balas'), ('bolas'), ('berco'), ('bruxo'), ('caber'),
  ('cabra'), ('cacho'), ('cacto'), ('caixa'), ('calda'), ('calmo'), ('calor'), ('calva'), ('calvo'), ('campo'), ('canal'), ('canoa'),
  ('canta'), ('canto'), ('capim'), ('capta'), ('caras'), ('carga'), ('cargo'), ('carro'), ('carta'), ('casar'), ('casca'), ('casos'),
  ('casta'), ('casto'), ('cauda'), ('cavar'), ('ceder'), ('cedro'), ('cegar'), ('celas'), ('celta'), ('cento'), ('cerco'), ('casal'),
  ('citou'), ('citar'), ('crise'), ('cetro'), ('chave'), ('cheio'), ('choca'), ('choco'), ('chora'), ('choro'), ('chuva'), ('ciclo'),
  ('cidra'), ('cifra'), ('cilio'), ('cinco'), ('circo'), ('cisma'), ('cisne'), ('civil'), ('clama'), ('claro'), ('clima'), ('cloro'),
  ('coado'), ('coesa'), ('coeso'), ('coisa'), ('colar'), ('colas'), ('colhe'), ('comer'), ('comum'), ('conde'), ('conto'), ('copas'),
  ('copos'), ('coral'), ('corda'), ('corpo'), ('corre'), ('corte'), ('corvo'), ('cosmo'), ('costa'), ('cotar'), ('couro'), ('couve'),
  ('covil'), ('coxas'), ('crase'), ('credo'), ('creme'), ('crepe'), ('criar'), ('crime'), ('crina'), ('cruel'), ('cruza'), ('cruze'),
  ('cubos'), ('cueca'), ('cuias'), ('culta'), ('culto'), ('cupim'), ('curar'), ('curva'), ('curvo'), ('cuspe'), ('cravo'), ('clero'),
  ('certa'), ('crave'), ('criou'), ('casou'), ('casei'), ('dados'), ('dando'), ('dardo'), ('datar'), ('dengo'), ('densa'), ('denso'),
  ('depor'), ('deusa'), ('dever'), ('diabo'), ('dieta'), ('digna'), ('digno'), ('dilui'), ('disco'), ('dizer'), ('doado'), ('doida'),
  ('doido'), ('domar'), ('donos'), ('dorso'), ('draga'), ('ducha'), ('duelo'), ('dueto'), ('dunas'), ('dupla'), ('duplo'), ('durar'),
  ('durex'), ('dutos'), ('duzia'), ('delta'), ('droga'), ('desde'), ('drama'), ('dente'), ('durma'), ('dorme'), ('dicas'), ('ecoar'),
  ('emana'), ('enfia'), ('entoa'), ('epico'), ('ereto'), ('ervas'), ('escoa'), ('espia'), ('etapa'), ('exata'), ('exige'), ('entra'),
  ('entro'), ('entre'), ('estes'), ('entes'), ('fomos'), ('faria'), ('fauna'), ('falar'), ('fardo'), ('fazia'), ('feixe'), ('fenda'),
  ('ferir'), ('festa'), ('fetal'), ('ferro'), ('furou'), ('fatal'), ('fixar'), ('flora'), ('fluor'), ('focal'), ('folha'), ('fonte'),
  ('forca'), ('fosso'), ('frase'), ('frear'), ('frito'), ('fruto'), ('fugir'), ('fundo'), ('furar'), ('fraco'), ('fazer'), ('frita'),
  ('fugas'), ('forte'), ('forja'), ('gabar'), ('galho'), ('ganha'), ('garoa'), ('gatas'), ('gelar'), ('genro'), ('gerar'), ('gesso'),
  ('girar'), ('gordo'), ('grata'), ('grave'), ('greve'), ('grava'), ('grato'), ('gruta'), ('grito'), ('gesto'), ('grita'), ('gelos'),
  ('giros'), ('goles'), ('golpe'), ('gatos'), ('habil'), ('haver'), ('heroi'), ('hiena'), ('hinos'), ('idolo'), ('icone'), ('igual'),
  ('ilhas'), ('impor'), ('inata'), ('incha'), ('inova'), ('impar'), ('janta'), ('jogar'), ('junta'), ('junte'), ('jeito'), ('jatos'),
  ('jarro'), ('jorra'), ('junco'), ('jurar'), ('justa'), ('labia'), ('lados'), ('lagoa'), ('lance'), ('larva'), ('latas'), ('leite'),
  ('leito'), ('lenha'), ('leque'), ('libra'), ('lindo'), ('linha'), ('licao'), ('livro'), ('lobos'), ('lombo'), ('longo'), ('louco'),
  ('lugar'), ('lutar'), ('luxos'), ('linda'), ('livre'), ('litro'), ('limbo'), ('letra'), ('levam'), ('levem'), ('macho'), ('magra'),
  ('magro'), ('maior'), ('mamar'), ('manha'), ('manos'), ('marca'), ('marco'), ('marra'), ('matar'), ('meigo'), ('melar'), ('mesmo'),
  ('metro'), ('mexer'), ('miado'), ('midia'), ('milha'), ('milho'), ('mimos'), ('minar'), ('minha'), ('miojo'), ('mirar'), ('missa'),
  ('mitos'), ('moeda'), ('moita'), ('molho'), ('monte'), ('morar'), ('morto'), ('motos'), ('mudar'), ('muito'), ('multa'), ('mundo'),
  ('musgo'), ('mutuo'), ('morta'), ('morte'), ('macro'), ('micro'), ('mutua'), ('navio'), ('nadar'), ('nadou'), ('nunca'), ('neles'),
  ('nelas'), ('norte'), ('natas'), ('noite'), ('nitro'), ('notas'), ('nicho'), ('olhou'), ('olhar'), ('ordem'), ('pular'), ('prado'),
  ('pasta'), ('poder'), ('podre'), ('prato'), ('padre'), ('primo'), ('prima'), ('preta'), ('pluma'), ('porto'), ('perna'), ('preto'),
  ('praga'), ('prego'), ('prega'), ('presa'), ('preso'), ('queda'), ('quais'), ('quite'), ('quilo'), ('raios'), ('ratos'), ('retos'),
  ('retro'), ('ricos'), ('regra'), ('remos'), ('saida'), ('sagaz'), ('saido'), ('selas'), ('solta'), ('solte'), ('solto'), ('salto'),
  ('sento'), ('senta'), ('sente'), ('termo'), ('tempo'), ('treco'), ('truco'), ('trufa'), ('trote'), ('truta'), ('trato'), ('tropa'),
  ('verme'), ('virus'), ('velho'), ('velha'), ('vimos'), ('vamos'), ('vemos'), ('amago'), ('negro'), ('exito'), ('nobre'), ('senso'),
  ('etica'), ('algoz'), ('plena'), ('assim'), ('tenue'), ('sobre'), ('aquem'), ('vigor'), ('secao'), ('sutil'), ('porem'), ('sanar'),
  ('ideia'), ('audaz'), ('moral'), ('inato'), ('quica'), ('justo'), ('sonho'), ('honra'), ('torpe'), ('razao'), ('etnia'), ('futil'),
  ('lapso'), ('entao'), ('expor'), ('saber'), ('graca'), ('avido'), ('ardil'), ('pesar'), ('estar'), ('causa'), ('sendo'), ('tenaz'),
  ('ainda'), ('brado'), ('crivo'), ('temor'), ('posse'), ('apice'), ('prole'), ('corja'), ('pauta'), ('detem'), ('fugaz'), ('censo'),
  ('ansia'), ('atroz'), ('vulgo'), ('vicio'), ('saude'), ('reves'), ('valha'), ('todos'), ('pudor'), ('dogma'), ('feliz'), ('pedir'),
  ('homem'), ('juizo'), ('forma'), ('sabio'), ('legal'), ('servo'), ('certo'), ('prosa'), ('tenro'), ('desse'), ('falso'), ('posso'),
  ('cunho'), ('vendo'), ('viril'), ('ontem'), ('facil'), ('valor'), ('manso'), ('visar'), ('meiga'), ('puder'), ('serio'), ('acaso'),
  ('magoa'), ('fluir'), ('temer'), ('abrir'), ('praxe'), ('uniao'), ('obter'), ('matiz'), ('obvio'), ('pleno'), ('exodo'), ('tedio'),
  ('fluxo'), ('alibi'), ('senil'), ('ritmo'), ('havia'), ('levar'), ('enfim'), ('tomar'), ('visao'), ('genio'), ('prumo'), ('brega'),
  ('ouvir'), ('vital'), ('reles'), ('falta'), ('bravo'), ('calma'), ('favor'), ('outro'), ('vivaz'), ('tecer'), ('reter'), ('terra'),
  ('tendo'), ('ameno'), ('viver'), ('valia'), ('laico'), ('unico'), ('passo'), ('nocao'), ('achar'), ('carma'), ('possa'), ('rever'),
  ('papel'), ('nossa'), ('pobre'), ('facam'), ('farsa'), ('dubio'), ('ativo'), ('fator'), ('obito'), ('selar'), ('lider'), ('sinto'),
  ('leigo'), ('cisao'), ('sonso'), ('cesta'), ('deter'), ('ciume'), ('vazio'), ('gente'), ('haste'), ('tende'), ('adiar'), ('revel'),
  ('ficar'), ('humor'), ('ideal'), ('sulco'), ('ponto'), ('arduo'), ('labor'), ('exato'), ('senao'), ('terno'), ('tanto'), ('hiato'),
  ('capaz'), ('debil'), ('relva'), ('otica'), ('jovem'), ('tenra'), ('cocar'), ('raiva'), ('pouco'), ('vacuo'), ('cacar'), ('sonsa'),
  ('imune'), ('apoio'), ('velar'), ('serie'), ('algum'), ('xeque'), ('farao'), ('feito'), ('horda'), ('fusao'), ('trama'), ('sorte'),
  ('lazer'), ('verso'), ('torco'), ('chata'), ('rigor'), ('massa'), ('prece'), ('pegar'), ('seita'), ('signo'), ('mocao'), ('plano'),
  ('vetor'), ('praia'), ('saiba'), ('adeus'), ('docil'), ('peste'), ('houve'), ('alias'), ('arido'), ('setor'), ('ardor'), ('peixe'),
  ('parte'), ('visse'), ('rezar'), ('meses'), ('salvo'), ('risco'), ('vulto'), ('beata'), ('junto'), ('vasto'), ('otimo'), ('morro'),
  ('grupo'), ('estao'), ('seria'), ('sinal'), ('reger'), ('lenda'), ('conta'), ('segue'), ('serao'), ('opcao'), ('oxala'), ('chulo'),
  ('verbo'), ('rapaz'), ('motim'), ('vilao'), ('nacao'), ('brava'), ('treta'), ('texto'), ('parar'), ('tirar'), ('indio'), ('traga'),
  ('puxar'), ('reino'), ('tenso'), ('gerir'), ('prazo'), ('filho'), ('atrio'), ('tosco'), ('norma'), ('prova'), ('exame'), ('epoca'),
  ('voraz'), ('acesa'), ('ligar'), ('fatos'), ('nosso'), ('copia'), ('aviao'), ('quase'), ('magia'), ('dessa'), ('longe'), ('afora'),
  ('nivel'), ('oasis'), ('mente'), ('pompa'), ('sexta'), ('lidar'), ('perda'), ('tocar'), ('sumir'), ('parca'), ('tinha'), ('vezes'),
  ('porta'), ('firme'), ('bater'), ('opaco'), ('faixa'), ('virao'), ('salve'), ('sabia'), ('turva'), ('irmao'), ('besta'), ('trupe'),
  ('elite'), ('exijo'), ('deixa'), ('pardo'), ('pique'), ('curso'), ('viria'), ('macio'), ('desta'), ('etico'), ('pagao'), ('ficha'),
  ('chato'), ('posto'), ('menos'), ('radio'), ('judeu'), ('video'), ('culpa'), ('supor'), ('verba'), ('zelar'), ('lapis'), ('gosto'),
  ('retem'), ('suave'), ('extra'), ('agudo'), ('torso'), ('baixo'), ('vosso'), ('vinha'), ('peito'), ('turma'), ('podio'), ('ruina'),
  ('passa'), ('sitio'), ('orfao'), ('traco'), ('piada'), ('avida'), ('turvo'), ('louca'), ('pilar'), ('chama'), ('forem'), ('pisar'),
  ('acoes'), ('refem'), ('mesma'), ('poeta'), ('brabo'), ('acola'), ('finda'), ('museu'), ('local'), ('medir'), ('optar'), ('surja'),
  ('busca'), ('teste'), ('tento'), ('poema'), ('rouca'), ('rumor'), ('folga'), ('geral'), ('paira'), ('pedra'), ('boato'), ('idoso'),
  ('feudo'), ('feroz'), ('rubro'), ('pacto'), ('volta'), ('monge'), ('ateia'), ('movel'), ('acude'), ('daqui'), ('tetra'), ('ponha'),
  ('natal'), ('benca'), ('ebano'), ('manga'), ('falha'), ('verde'), ('vigia'), ('saldo'), ('itens'), ('tribo'), ('grama'), ('vetar'),
  ('pasmo'), ('tarde'), ('forum'), ('letal'), ('unica'), ('rival'), ('chefe'), ('troca'), ('amada'), ('roupa'), ('vento'), ('penta'),
  ('ornar'), ('venha'), ('uteis'), ('plebe'), ('nuvem'), ('sarau'), ('orgao'), ('tchau'), ('pinho'), ('nesse'), ('virar'), ('vazao'),
  ('jejum'), ('finjo'), ('axila'), ('magna'), ('perto'), ('farta'), ('rocha'), ('giria'), ('tiver'), ('legua'), ('bruta'), ('bruto'),
  ('todas'), ('deste'), ('tutor'), ('traje'), ('renda'), ('assar'), ('pomar'), ('perco'), ('viram'), ('guria'), ('porte'), ('tenha'),
  ('surto'), ('nessa'), ('vadio'), ('santo'), ('feita'), ('rural'), ('ambar'), ('danca'), ('nesta'), ('verao'), ('canso'), ('odiar'),
  ('fossa'), ('vista'), ('mamae'), ('vedar'), ('laudo'), ('recem'), ('pavor'), ('cheia'), ('negar'), ('irado'), ('chula'), ('bolsa'),
  ('cerca'), ('salmo'), ('cinto'), ('visto'), ('coroa'), ('vagar'), ('molde'), ('horto'), ('inves'), ('ruido'), ('lesao'), ('largo'),
  ('paiol'), ('sotao'), ('simio'), ('penso'), ('final'), ('trago'), ('deram'), ('pasma'), ('vasta'), ('dubia'), ('troco'), ('ardis'),
  ('podar'), ('olhos'), ('piche'), ('umido'), ('frota'), ('folia'), ('preco'), ('neste'), ('ileso'), ('audio'), ('outra'), ('resto'),
  ('manto'), ('disso'), ('redor'), ('farol'), ('monta'), ('seiva'), ('chaga'), ('mover'), ('misto'), ('falsa'), ('limpo'), ('vazia'),
  ('nariz'), ('veloz'), ('barao'), ('album'), ('louro'), ('mimar'), ('sabor'), ('punha'), ('gemer'), ('porca'), ('toque'), ('arroz'),
  ('zumbi'), ('samba'), ('lucro'), ('enjoo'), ('calca'), ('venho'), ('findo'), ('rente'), ('salva'), ('subir'), ('farto'), ('baixa'),
  ('lousa'), ('pagar'), ('firma'), ('ousar'), ('xampu'), ('valer'), ('torna'), ('forro'), ('sexto'), ('repor'), ('sigla'), ('reler'),
  ('fugiu'), ('gueto'), ('sacar'), ('canil'), ('lento'), ('hifen'), ('corar'), ('vario'), ('custo'), ('focar'), ('miope'), ('mania'),
  ('versa'), ('feira'), ('sadio'), ('modal'), ('tumba'), ('socio');
