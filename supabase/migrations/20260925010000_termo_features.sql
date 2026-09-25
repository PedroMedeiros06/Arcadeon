-- Letrado (Termo): modo dificil, dicas pagas, escudo de sequencia, conquistas, ranking do dia,
-- estatisticas pessoais e modo Contra o Tempo. Depende de 20260925000000_termo_server_validation.

-- 1) colunas novas
alter table public.termo_daily_games
  add column hard boolean not null default false,
  add column hints jsonb not null default '[]'::jsonb; -- [{b: tabuleiro, p: posicao 1-5, l: letra}]

alter table public.termo_daily_results
  add column hard boolean not null default false,
  add column hints_used integer not null default 0;

alter table public.profiles
  add column streak_shields integer not null default 0 check (streak_shields between 0 and 2);

-- dias sem jogar cobertos por escudo (um escudo cobre o dia pra todos os modos)
create table public.termo_shield_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.termo_shield_days enable row level security;

-- 2) conquistas do Letrado
insert into public.achievements (code, name, description) values
  ('termo_first_try', 'Na Mosca', 'Acerte o Letrado diário de primeira'),
  ('termo_streak_30', 'Mês Letrado', 'Alcance uma sequência de 30 dias no Letrado'),
  ('termo_quad_perfect', 'Quádruplo Perfeito', 'Vença o Quádruplo diário em 4 tentativas, sem errar nenhuma'),
  ('termo_hard_win', 'Sem Atalhos', 'Vença o Letrado diário no modo difícil')
on conflict do nothing;

-- conquistas antigas: nome novo do jogo (Termo -> Letrado) e acentos
update public.achievements set name = 'Primeira Vitória', description = 'Vença sua primeira partida do Letrado diário'
  where code = 'first_win';
update public.achievements set name = 'Sequência de Fogo', description = 'Alcance uma sequência de 7 dias no Letrado'
  where code = 'streak_7';

-- 3) modo dificil: cada palpite usa as dicas ja reveladas. Devolve a mensagem de erro ou null.
create function public.termo_hard_violation(p_guesses text[], p_answer text, p_guess text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  g text;
  e text;
  i integer;
  l text;
  v_need integer;
  v_have integer;
begin
  foreach g in array p_guesses loop
    e := public.termo_evaluate(g, p_answer);
    for i in 1..5 loop
      if substr(e, i, 1) = 'C' and substr(p_guess, i, 1) <> substr(g, i, 1) then
        return format('A %sª letra deve ser %s', i, upper(substr(g, i, 1)));
      end if;
    end loop;
    for l in select distinct c from unnest(string_to_array(g, null)) as c loop
      select count(*) into v_need from generate_series(1, 5) as k
        where substr(g, k, 1) = l and substr(e, k, 1) in ('C', 'P');
      v_have := length(p_guess) - length(replace(p_guess, l, ''));
      if v_have < v_need then
        return format('A palavra deve conter %s', upper(l));
      end if;
    end loop;
  end loop;
  return null;
end;
$$;

-- 4) estado da partida inclui modo dificil e dicas
create or replace function public.termo_game_state(p_game_id uuid)
returns jsonb
language plpgsql
volatile
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
    'hard', g.hard,
    'hints', g.hints,
    'answers', case when g.finished_at is not null then to_jsonb(v_answers) end
  );
end;
$$;

-- liga/desliga o modo dificil (so no Letrado de 1 palavra e antes do primeiro palpite)
create function public.termo_daily_set_hard(p_board_count integer, p_anon_key text, p_hard boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.termo_find_or_create_game(p_board_count, p_anon_key);
begin
  update public.termo_daily_games set hard = coalesce(p_hard, false)
    where id = v_id and board_count = 1 and finished_at is null and cardinality(guesses) = 0;
  return public.termo_game_state(v_id);
end;
$$;

-- 5) dica paga: revela uma letra de um tabuleiro. So logado (custa moedas); max 2 por tabuleiro.
create function public.termo_daily_hint(p_board_count integer, p_anon_key text, p_board_index integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_price constant integer := 5;
  v_id uuid;
  g public.termo_daily_games;
  v_answer text;
  v_pos integer;
  i integer;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para usar dicas';
  end if;

  v_id := public.termo_find_or_create_game(p_board_count, p_anon_key);
  select * into g from public.termo_daily_games where id = v_id for update;
  if g.finished_at is not null then
    raise exception 'A partida já terminou';
  end if;
  if p_board_index is null or p_board_index < 0 or p_board_index >= g.board_count then
    raise exception 'invalid board index';
  end if;

  select words[p_board_index + 1] into v_answer from public.termo_daily_words
    where play_date = g.play_date and board_count = g.board_count;
  if v_answer = any(g.guesses) then
    raise exception 'Esse tabuleiro já foi resolvido';
  end if;
  if (select count(*) from jsonb_array_elements(g.hints) h where (h->>'b')::integer = p_board_index) >= 2 then
    raise exception 'Limite de 2 dicas por palavra';
  end if;

  -- primeira posicao que o jogador ainda nao acertou nem recebeu de dica
  for i in 1..5 loop
    continue when exists (select 1 from unnest(g.guesses) as x where substr(x, i, 1) = substr(v_answer, i, 1));
    continue when exists (select 1 from jsonb_array_elements(g.hints) h
      where (h->>'b')::integer = p_board_index and (h->>'p')::integer = i);
    v_pos := i;
    exit;
  end loop;
  if v_pos is null then
    raise exception 'Não há letra para revelar';
  end if;

  update public.profiles set coins = coins - v_price where id = v_uid and coins >= v_price;
  if not found then
    raise exception 'Moedas insuficientes (a dica custa % moedas)', v_price;
  end if;

  update public.termo_daily_games
    set hints = hints || jsonb_build_array(jsonb_build_object('b', p_board_index, 'p', v_pos, 'l', substr(v_answer, v_pos, 1)))
    where id = v_id;

  return public.termo_game_state(v_id) || jsonb_build_object('coins_spent', v_price);
end;
$$;

-- dica no modo Infinito: o cliente conhece a palavra; o banco so cobra
create function public.termo_spend_hint()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_coins integer;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para usar dicas';
  end if;
  update public.profiles set coins = coins - 5 where id = v_uid and coins >= 5
    returning coins into v_coins;
  if not found then
    raise exception 'Moedas insuficientes (a dica custa 5 moedas)';
  end if;
  return v_coins;
end;
$$;

-- 6) escudo de sequencia: 30 moedas, no maximo 2 guardados
create function public.buy_streak_shield()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_shields integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles
    set coins = coins - 30, streak_shields = streak_shields + 1
    where id = v_uid and coins >= 30 and streak_shields < 2
    returning streak_shields into v_shields;
  if not found then
    raise exception 'Não foi possível comprar: precisa de 30 moedas e cabe no máximo 2 escudos';
  end if;
  return v_shields;
end;
$$;

-- 7) palpite do diario: + modo dificil, dicas no resultado, escudo, bonus e conquistas
create or replace function public.termo_daily_guess(p_board_count integer, p_anon_key text, p_guess text)
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
  v_msg text;
  v_prev public.termo_scores;
  v_has_prev boolean;
  v_streak integer;
  v_missing integer;
  v_shields integer;
  v_shields_used integer := 0;
  v_better boolean;
  v_coins integer := 0;
  v_codes text[] := '{}';
  v_unlocked text[];
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

  if g.hard then
    v_msg := public.termo_hard_violation(g.guesses, v_answers[1], v_guess);
    if v_msg is not null then
      raise exception '%', v_msg using hint = 'hard_mode';
    end if;
  end if;

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
      (user_id, anon_key, board_count, play_date, won, attempts, time_seconds, hard, hints_used)
    values (g.user_id, case when g.user_id is null then g.anon_key end,
            g.board_count, g.play_date, v_solved, v_attempts, v_time,
            g.hard, jsonb_array_length(g.hints))
    on conflict do nothing;

  -- placar/ranking/sequencia/moedas/conquistas so pra quem tem conta
  if g.user_id is not null then
    select * into v_prev from public.termo_scores
      where user_id = g.user_id and board_count = g.board_count
      for update;
    v_has_prev := found;

    if not v_solved then
      v_streak := 0;
    elsif not v_has_prev or v_prev.last_played_date is null or v_prev.current_streak = 0 then
      v_streak := 1;
    elsif v_prev.last_played_date >= g.play_date then
      v_streak := greatest(v_prev.current_streak, 1);
    elsif v_prev.last_played_date = g.play_date - 1 then
      v_streak := v_prev.current_streak + 1;
    else
      -- pulou dias: cada dia ainda nao coberto gasta um escudo; sem escudo suficiente, recomeca
      select count(*) into v_missing
        from generate_series(v_prev.last_played_date + 1, g.play_date - 1, interval '1 day') as d
        where not exists (select 1 from public.termo_shield_days s where s.user_id = g.user_id and s.day = d::date);
      select streak_shields into v_shields from public.profiles where id = g.user_id for update;

      if v_missing <= coalesce(v_shields, 0) then
        insert into public.termo_shield_days (user_id, day)
          select g.user_id, d::date
          from generate_series(v_prev.last_played_date + 1, g.play_date - 1, interval '1 day') as d
          on conflict do nothing;
        update public.profiles set streak_shields = streak_shields - v_missing where id = g.user_id;
        v_shields_used := v_missing;
        v_streak := v_prev.current_streak + 1;
      else
        v_streak := 1;
      end if;
    end if;

    v_better := v_solved and (not v_has_prev or v_prev.attempts is null or v_attempts < v_prev.attempts
      or (v_attempts = v_prev.attempts and v_time < v_prev.time_seconds));

    if v_has_prev then
      update public.termo_scores set
        wins = wins + v_solved::integer,
        current_streak = v_streak,
        best_streak = greatest(best_streak, v_streak),
        attempts = case when v_better then v_attempts else attempts end,
        time_seconds = case when v_better then v_time else time_seconds end,
        last_played_date = g.play_date,
        updated_at = now()
      where id = v_prev.id;
    else
      insert into public.termo_scores
          (user_id, board_count, attempts, time_seconds, wins, current_streak, best_streak, last_played_date, updated_at)
        values (g.user_id, g.board_count,
                case when v_solved then v_attempts end, case when v_solved then v_time end,
                v_solved::integer, v_streak, v_streak, g.play_date, now());
    end if;

    -- conquistas antes das moedas: award_coins_and_check_achievements libera os avatares delas
    if v_solved and g.board_count = 1 and v_attempts = 1 then v_codes := array_append(v_codes, 'termo_first_try'); end if;
    if v_streak >= 30 then v_codes := array_append(v_codes, 'termo_streak_30'); end if;
    if v_solved and g.board_count = 4 and v_attempts = 4 then v_codes := array_append(v_codes, 'termo_quad_perfect'); end if;
    if v_solved and g.hard then v_codes := array_append(v_codes, 'termo_hard_win'); end if;

    with ins as (
      insert into public.user_achievements (user_id, achievement_id)
        select g.user_id, a.id from public.achievements a where a.code = any(v_codes)
        on conflict do nothing
        returning achievement_id
    )
    select array_agg(a.name) into v_unlocked from ins join public.achievements a on a.id = ins.achievement_id;

    if v_solved then
      insert into public.termo_win_rewards (user_id, play_date, board_count)
        values (g.user_id, g.play_date, g.board_count)
        on conflict do nothing;
      if found then
        v_coins := case when g.hard then 15 else 10 end;
        perform public.award_coins_and_check_achievements(g.user_id, v_coins, 'termo_win');
      end if;
    end if;
  end if;

  return public.termo_game_state(v_id) || jsonb_build_object(
    'current_streak', v_streak,
    'coins_awarded', v_coins,
    'shields_used', v_shields_used,
    'achievements', coalesce(to_jsonb(v_unlocked), '[]'::jsonb)
  );
end;
$$;

-- 8) estatisticas pessoais por modo (logado: conta; anonimo: aparelho)
create function public.termo_my_stats(p_anon_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb := '{}'::jsonb;
  v_bc integer;
  v_played integer;
  v_wins integer;
  v_dist jsonb;
  s public.termo_scores;
begin
  if v_uid is null and p_anon_key is null then
    return v_result;
  end if;

  foreach v_bc in array array[1, 2, 4] loop
    select count(*), count(*) filter (where won) into v_played, v_wins
      from public.termo_daily_results r
      where r.board_count = v_bc
        and ((v_uid is not null and r.user_id = v_uid) or (v_uid is null and r.anon_key = p_anon_key));

    select jsonb_agg(
        (select count(*) from public.termo_daily_results r
          where r.board_count = v_bc and r.won and r.attempts = n
            and ((v_uid is not null and r.user_id = v_uid) or (v_uid is null and r.anon_key = p_anon_key)))
        order by n)
      into v_dist
      from generate_series(1, v_bc + 5) as n;

    s := null;
    if v_uid is not null then
      select * into s from public.termo_scores where user_id = v_uid and board_count = v_bc;
    end if;

    v_result := v_result || jsonb_build_object(v_bc::text, jsonb_build_object(
      'played', v_played,
      'wins', v_wins,
      'distribution', v_dist,
      -- mesma regra do ranking: zera se passou dia sem jogar e sem escudo que cubra
      'current_streak', case when s.id is null then null
        else coalesce((select l.current_streak from public.termo_leaderboard l where l.id = s.id), 0) end,
      'best_streak', s.best_streak
    ));
  end loop;

  if v_uid is not null then
    v_result := v_result || jsonb_build_object(
      'shields', (select streak_shields from public.profiles where id = v_uid),
      'speed_best', (select best from public.termo_speed_scores where user_id = v_uid)
    );
  end if;
  return v_result;
end;
$$;

-- 9) ranking do dia: vitorias de hoje, quem usou dica fica depois de quem nao usou
create view public.termo_daily_leaderboard as
  select r.id,
    coalesce(p.username, 'Arcadeon'::text) as username,
    av.emoji as avatar_emoji,
    av.bg_color as avatar_bg_color,
    av.image_url as avatar_image_url,
    r.board_count,
    r.attempts,
    r.time_seconds,
    r.hard,
    r.hints_used
  from public.termo_daily_results r
    join public.profiles p on p.id = r.user_id
    left join public.avatars av on av.id = p.equipped_avatar_id
  where r.won and r.play_date = public.termo_today()
  order by (r.hints_used > 0), r.attempts, r.time_seconds;

-- ranking geral: sequencia segue viva se os dias sem jogar cabem nos escudos guardados
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
    case
      when s.last_played_date >= public.termo_today() - 1 then s.current_streak
      when (public.termo_today() - 1 - s.last_played_date)
           - (select count(*) from public.termo_shield_days d
                where d.user_id = s.user_id and d.day > s.last_played_date)
           <= p.streak_shields then s.current_streak
      else 0
    end as current_streak,
    s.updated_at
  from public.termo_scores s
    left join public.profiles p on p.id = s.user_id
    left join public.avatars av on av.id = p.equipped_avatar_id
  where s.user_id is not null and s.wins > 0
  order by s.attempts, s.time_seconds;

-- 10) Contra o Tempo: 3 minutos, uma palavra por vez, 6 tentativas cada; conta quantas acertou
create table public.termo_speed_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_key text,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  word text not null,
  guesses text[] not null default '{}',
  history jsonb not null default '[]'::jsonb, -- [{word, solved}]
  solved integer not null default 0,
  finished boolean not null default false,
  constraint termo_speed_runs_identity check (user_id is not null or anon_key is not null)
);
alter table public.termo_speed_runs enable row level security;

create table public.termo_speed_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  best integer not null,
  runs integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.termo_speed_scores enable row level security;

create function public.termo_speed_new_word(p_exclude text[])
returns text
language sql
volatile
set search_path = ''
as $$
  select word from public.termo_words where not (word = any(p_exclude)) order by random() limit 1
$$;

create function public.termo_speed_state(p_run_id uuid, p_last jsonb default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.termo_speed_runs;
begin
  select * into r from public.termo_speed_runs where id = p_run_id;
  return jsonb_build_object(
    'run_id', r.id,
    'ends_at', r.ends_at,
    'server_now', now(),
    'finished', r.finished,
    'solved', r.solved,
    'guesses', to_jsonb(r.guesses),
    'evaluations', coalesce((select jsonb_agg(jsonb_build_array(public.termo_evaluate(x.guess, r.word)) order by x.ord)
      from unnest(r.guesses) with ordinality as x(guess, ord)), '[]'::jsonb),
    'history', r.history,
    'last', p_last
  );
end;
$$;

create function public.termo_speed_finish_run(p_run_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.termo_speed_runs;
begin
  update public.termo_speed_runs set finished = true
    where id = p_run_id and not finished
    returning * into r;
  if found and r.user_id is not null then
    insert into public.termo_speed_scores as s (user_id, best, runs)
      values (r.user_id, r.solved, 1)
      on conflict (user_id) do update
        set best = greatest(s.best, excluded.best), runs = s.runs + 1, updated_at = now();
  end if;
end;
$$;

create function public.termo_speed_start(p_anon_key text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null and (p_anon_key is null or length(p_anon_key) not between 16 and 64) then
    raise exception 'anon_key required';
  end if;
  insert into public.termo_speed_runs (user_id, anon_key, ends_at, word)
    values (v_uid, case when v_uid is null then p_anon_key end, now() + interval '180 seconds',
            public.termo_speed_new_word('{}'))
    returning id into v_id;
  return public.termo_speed_state(v_id);
end;
$$;

create function public.termo_speed_guess(p_run_id uuid, p_anon_key text, p_guess text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r public.termo_speed_runs;
  v_guess text := lower(p_guess);
  v_code text;
  v_last jsonb;
  v_used text[];
begin
  select * into r from public.termo_speed_runs
    where id = p_run_id
      and ((v_uid is not null and user_id = v_uid) or (user_id is null and anon_key = p_anon_key))
    for update;
  if not found then
    raise exception 'run not found';
  end if;
  if r.finished then
    return public.termo_speed_state(r.id);
  end if;
  -- 2s de folga pra latencia; depois disso o tempo acabou
  if now() > r.ends_at + interval '2 seconds' then
    perform public.termo_speed_finish_run(r.id);
    return public.termo_speed_state(r.id);
  end if;
  if v_guess is null or v_guess !~ '^[a-z]{5}$' then
    raise exception 'invalid guess';
  end if;

  v_code := public.termo_evaluate(v_guess, r.word);
  v_last := jsonb_build_object('guess', v_guess, 'code', v_code);

  if v_guess = r.word or cardinality(r.guesses) + 1 >= 6 then
    -- palavra encerrada (acertou ou gastou as 6): revela e sorteia a proxima
    select array_agg(h->>'word') || r.word into v_used from jsonb_array_elements(r.history) h;
    v_last := v_last || jsonb_build_object('word', r.word, 'solved', v_guess = r.word);
    update public.termo_speed_runs set
      solved = solved + (v_guess = r.word)::integer,
      history = history || jsonb_build_array(jsonb_build_object('word', r.word, 'solved', v_guess = r.word)),
      guesses = '{}',
      word = public.termo_speed_new_word(coalesce(v_used, array[r.word]))
    where id = r.id;
  else
    update public.termo_speed_runs set guesses = guesses || v_guess where id = r.id;
  end if;

  return public.termo_speed_state(r.id, v_last);
end;
$$;

create function public.termo_speed_finish(p_run_id uuid, p_anon_key text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.termo_speed_runs
      where id = p_run_id
        and ((v_uid is not null and user_id = v_uid) or (user_id is null and anon_key = p_anon_key))) then
    raise exception 'run not found';
  end if;
  perform public.termo_speed_finish_run(p_run_id);
  return public.termo_speed_state(p_run_id);
end;
$$;

create view public.termo_speed_leaderboard as
  select s.user_id as id,
    coalesce(p.username, 'Arcadeon'::text) as username,
    av.emoji as avatar_emoji,
    av.bg_color as avatar_bg_color,
    av.image_url as avatar_image_url,
    s.best,
    s.runs
  from public.termo_speed_scores s
    join public.profiles p on p.id = s.user_id
    left join public.avatars av on av.id = p.equipped_avatar_id
  where s.best > 0
  order by s.best desc, s.updated_at;

-- 11) permissoes
revoke execute on function public.termo_hard_violation(text[], text, text) from public, anon, authenticated;
revoke execute on function public.termo_speed_new_word(text[]) from public, anon, authenticated;
revoke execute on function public.termo_speed_state(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.termo_speed_finish_run(uuid) from public, anon, authenticated;

revoke execute on function public.termo_daily_set_hard(integer, text, boolean) from public;
revoke execute on function public.termo_daily_hint(integer, text, integer) from public;
revoke execute on function public.termo_spend_hint() from public;
revoke execute on function public.buy_streak_shield() from public;
revoke execute on function public.termo_my_stats(text) from public;
revoke execute on function public.termo_speed_start(text) from public;
revoke execute on function public.termo_speed_guess(uuid, text, text) from public;
revoke execute on function public.termo_speed_finish(uuid, text) from public;

grant execute on function public.termo_daily_set_hard(integer, text, boolean) to anon, authenticated;
grant execute on function public.termo_my_stats(text) to anon, authenticated;
grant execute on function public.termo_speed_start(text) to anon, authenticated;
grant execute on function public.termo_speed_guess(uuid, text, text) to anon, authenticated;
grant execute on function public.termo_speed_finish(uuid, text) to anon, authenticated;
grant execute on function public.termo_daily_hint(integer, text, integer) to authenticated;
grant execute on function public.termo_spend_hint() to authenticated;
grant execute on function public.buy_streak_shield() to authenticated;

grant select on public.termo_daily_leaderboard, public.termo_speed_leaderboard to anon, authenticated;

-- 12) status do Diario pro card da home (pedido do Frontend, P3): so leitura, nao cria partida
create function public.termo_daily_status(p_anon_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.termo_today();
  v_modes jsonb := '{}'::jsonb;
  v_bc integer;
  g public.termo_daily_games;
  v_legacy boolean;
  v_state text;
begin
  foreach v_bc in array array[1, 2, 4] loop
    g := null;
    -- partida da conta; sem ela, a do aparelho (que a conta herdaria ao jogar)
    if v_uid is not null then
      select * into g from public.termo_daily_games
        where user_id = v_uid and board_count = v_bc and play_date = v_today;
    end if;
    if g.id is null and p_anon_key is not null then
      select * into g from public.termo_daily_games
        where anon_key = p_anon_key and user_id is null and board_count = v_bc and play_date = v_today;
    end if;

    if g.id is not null then
      v_state := case
        when g.finished_at is null then (case when cardinality(g.guesses) = 0 then 'not_started' else 'playing' end)
        when g.won then 'won'
        else 'lost' end;
    else
      -- resultado gravado pelo cliente antigo, antes do fluxo validado
      select won into v_legacy from public.termo_daily_results r
        where r.board_count = v_bc and r.play_date = v_today
          and ((v_uid is not null and r.user_id = v_uid) or (v_uid is null and r.anon_key = p_anon_key))
        limit 1;
      v_state := case when v_legacy is null then 'not_started' when v_legacy then 'won' else 'lost' end;
      v_legacy := null;
    end if;
    v_modes := v_modes || jsonb_build_object(v_bc::text, v_state);
  end loop;

  return jsonb_build_object(
    'play_date', v_today,
    'modes', v_modes,
    'current_streak', case when v_uid is null then null else
      coalesce((select l.current_streak from public.termo_leaderboard l
        join public.termo_scores s on s.id = l.id
        where s.user_id = v_uid and s.board_count = 1), 0) end
  );
end;
$$;

revoke execute on function public.termo_daily_status(text) from public;
grant execute on function public.termo_daily_status(text) to anon, authenticated;
