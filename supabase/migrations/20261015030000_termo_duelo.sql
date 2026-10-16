-- Letrado: Duelo ao vivo (1x1, mesmas palavras, Letrado/Duplo/Quádruplo).
-- O banco e' a autoridade: sorteia as palavras, avalia cada palpite e decide o fim com a linha da
-- sala travada (dois "resolveu" quase juntos nao geram dois vencedores). O rival so enxerga as cores
-- (termo_duel_players, via Realtime) ate o fim; palavras e letras ficam em tabelas sem policy.
-- Design: docs/superpowers/specs/2026-10-15-letrado-duelo-design.md

-- 1) tabelas ---------------------------------------------------------------

create table public.termo_duels (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  board_count integer not null check (board_count in (1, 2, 4)),
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished', 'expired')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  winner_id uuid references public.profiles(id) on delete set null,
  end_reason text check (end_reason in ('solved', 'closest', 'forfeit', 'abandoned')),
  constraint termo_duels_two_people check (guest_id is null or guest_id <> host_id)
);
-- codigo unico so entre salas vivas (o espaco de codigos e' reaproveitado)
create unique index termo_duels_live_code on public.termo_duels (code) where status in ('waiting', 'playing');
create index termo_duels_code on public.termo_duels (code, created_at desc);
create index termo_duels_host on public.termo_duels (host_id, created_at desc);
create index termo_duels_guest on public.termo_duels (guest_id, created_at desc);

create table public.termo_duel_words (
  duel_id uuid primary key references public.termo_duels(id) on delete cascade,
  words text[] not null
);

-- o que o rival pode ver: cores de cada palpite (uma lista de codigos "CPAAA" por tabuleiro)
create table public.termo_duel_players (
  duel_id uuid not null references public.termo_duels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  patterns jsonb not null default '[]'::jsonb,
  solved_count integer not null default 0,
  finished_at timestamptz,
  score integer,
  last_seen_at timestamptz not null default now(),
  primary key (duel_id, user_id)
);

-- letras dos palpites: so as funcoes leem
create table public.termo_duel_guesses (
  duel_id uuid not null references public.termo_duels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  guesses text[] not null default '{}',
  primary key (duel_id, user_id)
);

alter table public.termo_duels enable row level security;
alter table public.termo_duel_words enable row level security;
alter table public.termo_duel_players enable row level security;
alter table public.termo_duel_guesses enable row level security;

create policy "Duel members read the duel" on public.termo_duels
  for select to authenticated
  using ((select auth.uid()) in (host_id, guest_id));

create policy "Duel members read both players" on public.termo_duel_players
  for select to authenticated
  using (exists (
    select 1 from public.termo_duels d
    where d.id = duel_id and (select auth.uid()) in (d.host_id, d.guest_id)
  ));

revoke all on public.termo_duels, public.termo_duel_words, public.termo_duel_players, public.termo_duel_guesses
  from anon, authenticated;
grant select on public.termo_duels, public.termo_duel_players to authenticated;

alter publication supabase_realtime add table public.termo_duels, public.termo_duel_players;

-- 2) regras ----------------------------------------------------------------

-- "mais perto": por tabuleiro, 10 se resolvido; senao a melhor linha (verde 2, amarelo 1)
create function public.termo_duel_score(p_patterns jsonb, p_board_count integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  total integer := 0;
  best integer;
  code text;
  b integer;
  r integer;
  v integer;
begin
  for b in 0..p_board_count - 1 loop
    best := 0;
    for r in 0..jsonb_array_length(p_patterns) - 1 loop
      code := p_patterns -> r ->> b;
      if code = 'CCCCC' then
        best := 10;
        exit;
      end if;
      v := 2 * (length(code) - length(replace(code, 'C', ''))) + (length(code) - length(replace(code, 'P', '')));
      best := greatest(best, v);
    end loop;
    total := total + best;
  end loop;
  return total;
end;
$$;

-- estado da sala do ponto de vista de p_uid
create function public.termo_duel_json(p_duel_id uuid, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.termo_duels;
  v_opp uuid;
  v_done boolean;
  v_me jsonb;
  v_rival jsonb;
begin
  select * into d from public.termo_duels where id = p_duel_id;
  v_opp := case when p_uid = d.host_id then d.guest_id else d.host_id end;
  v_done := d.status = 'finished';

  select jsonb_build_object(
      'user_id', p.user_id, 'username', pr.username, 'avatar', public._avatar_json(p.user_id),
      'guesses', to_jsonb(g.guesses), 'patterns', p.patterns, 'finished_at', p.finished_at,
      'score', p.score, 'last_seen_at', p.last_seen_at)
    into v_me
    from public.termo_duel_players p
    join public.termo_duel_guesses g on g.duel_id = p.duel_id and g.user_id = p.user_id
    join public.profiles pr on pr.id = p.user_id
    where p.duel_id = p_duel_id and p.user_id = p_uid;

  if v_opp is not null then
    select jsonb_build_object(
        'user_id', p.user_id, 'username', pr.username, 'avatar', public._avatar_json(p.user_id),
        'guesses', case when v_done then to_jsonb(g.guesses) end, 'patterns', p.patterns,
        'finished_at', p.finished_at, 'score', p.score, 'last_seen_at', p.last_seen_at)
      into v_rival
      from public.termo_duel_players p
      join public.termo_duel_guesses g on g.duel_id = p.duel_id and g.user_id = p.user_id
      join public.profiles pr on pr.id = p.user_id
      where p.duel_id = p_duel_id and p.user_id = v_opp;
  end if;

  return jsonb_build_object(
    'id', d.id, 'code', d.code, 'board_count', d.board_count, 'max_attempts', d.board_count + 5,
    'status', d.status, 'host_id', d.host_id, 'guest_id', d.guest_id,
    'created_at', d.created_at, 'started_at', d.started_at, 'finished_at', d.finished_at,
    'winner_id', d.winner_id, 'end_reason', d.end_reason, 'now', now(),
    'me', v_me, 'opponent', v_rival,
    'words', case when v_done then (select to_jsonb(words) from public.termo_duel_words where duel_id = d.id) end
  );
end;
$$;

-- fecha a sala com vencedor e grava a pontuacao dos dois (pra tela final)
create function public.termo_duel_finish(p_duel_id uuid, p_winner uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select board_count into v_count from public.termo_duels where id = p_duel_id;
  update public.termo_duel_players
    set score = public.termo_duel_score(patterns, v_count)
    where duel_id = p_duel_id;
  update public.termo_duels
    set status = 'finished', finished_at = now(), winner_id = p_winner, end_reason = p_reason
    where id = p_duel_id;
end;
$$;

-- sala viva (ou a mais recente) do codigo onde eu estou; trava a linha
create function public.termo_duel_lock(p_code text)
returns public.termo_duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.termo_duels;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta';
  end if;
  select * into d from public.termo_duels
    where code = upper(btrim(coalesce(p_code, ''))) and v_uid in (host_id, guest_id)
    order by created_at desc
    limit 1
    for update;
  if d.id is null then
    raise exception 'Duelo não encontrado';
  end if;
  return d;
end;
$$;

-- 3) RPCs ------------------------------------------------------------------

create function public.termo_duel_create(p_board_count integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta';
  end if;
  if p_board_count not in (1, 2, 4) then
    raise exception 'Modo inválido';
  end if;

  -- uma sala de espera por vez
  update public.termo_duels set status = 'expired'
    where host_id = v_uid and status = 'waiting';

  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;
    begin
      insert into public.termo_duels (code, board_count, host_id)
        values (v_code, p_board_count, v_uid)
        returning id into v_id;
      exit;
    exception when unique_violation then
      -- codigo em uso por outra sala viva: sorteia outro
    end;
  end loop;

  insert into public.termo_duel_words (duel_id, words) values (v_id, public.termo_pick_words(p_board_count));
  insert into public.termo_duel_players (duel_id, user_id) values (v_id, v_uid);
  insert into public.termo_duel_guesses (duel_id, user_id) values (v_id, v_uid);

  return public.termo_duel_json(v_id, v_uid);
end;
$$;

create function public.termo_duel_join(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  d public.termo_duels;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta';
  end if;

  -- ja estou nessa sala (F5, link aberto de novo): so devolve o estado
  select * into d from public.termo_duels
    where code = v_code and v_uid in (host_id, guest_id)
    order by created_at desc limit 1;
  if d.id is not null and d.status <> 'expired' then
    update public.termo_duel_players set last_seen_at = now() where duel_id = d.id and user_id = v_uid;
    return public.termo_duel_json(d.id, v_uid);
  end if;

  select * into d from public.termo_duels
    where code = v_code and status = 'waiting'
    for update;
  if d.id is null then
    raise exception 'Sala não encontrada';
  end if;
  if d.created_at < now() - interval '15 minutes' then
    update public.termo_duels set status = 'expired' where id = d.id;
    raise exception 'Essa sala expirou';
  end if;
  if d.guest_id is not null then
    raise exception 'Essa sala já está cheia';
  end if;

  update public.termo_duels set guest_id = v_uid where id = d.id;
  insert into public.termo_duel_players (duel_id, user_id) values (d.id, v_uid)
    on conflict (duel_id, user_id) do update set patterns = '[]'::jsonb, solved_count = 0, last_seen_at = now();
  insert into public.termo_duel_guesses (duel_id, user_id) values (d.id, v_uid)
    on conflict (duel_id, user_id) do update set guesses = '{}';
  return public.termo_duel_json(d.id, v_uid);
end;
$$;

create function public.termo_duel_start(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  d public.termo_duels;
begin
  d := public.termo_duel_lock(p_code);
  if d.host_id <> v_uid then
    raise exception 'Só quem criou a sala pode começar';
  end if;
  if d.status <> 'waiting' then
    return public.termo_duel_json(d.id, v_uid);
  end if;
  if d.guest_id is null then
    raise exception 'Espere seu rival entrar';
  end if;
  -- contagem de 3 s na tela antes de valer
  update public.termo_duels set status = 'playing', started_at = now() + interval '3 seconds' where id = d.id;
  update public.termo_duel_players set last_seen_at = now() where duel_id = d.id;
  return public.termo_duel_json(d.id, v_uid);
end;
$$;

create function public.termo_duel_state(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta';
  end if;
  select id into v_id from public.termo_duels
    where code = v_code and v_uid in (host_id, guest_id)
    order by created_at desc limit 1;
  if v_id is null then
    raise exception 'Duelo não encontrado';
  end if;
  return public.termo_duel_json(v_id, v_uid);
end;
$$;

create function public.termo_duel_guess(p_code text, p_guess text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_guess text := lower(btrim(coalesce(p_guess, '')));
  d public.termo_duels;
  v_opp uuid;
  me public.termo_duel_players;
  rival public.termo_duel_players;
  v_words text[];
  v_guesses text[];
  v_row jsonb;
  v_patterns jsonb;
  v_solved integer;
  v_my_score integer;
  v_rival_score integer;
begin
  if v_guess !~ '^[a-z]{5}$' then
    raise exception 'Palpite inválido';
  end if;

  d := public.termo_duel_lock(p_code);
  if d.status = 'waiting' or (d.status = 'playing' and now() < d.started_at) then
    raise exception 'O duelo ainda não começou';
  end if;
  if d.status <> 'playing' then
    return public.termo_duel_json(d.id, v_uid);
  end if;

  select * into me from public.termo_duel_players where duel_id = d.id and user_id = v_uid;
  if me.finished_at is not null then
    return public.termo_duel_json(d.id, v_uid);
  end if;

  select words into v_words from public.termo_duel_words where duel_id = d.id;
  select guesses || v_guess into v_guesses from public.termo_duel_guesses where duel_id = d.id and user_id = v_uid;

  select jsonb_agg(public.termo_evaluate(v_guess, t.w) order by t.ord) into v_row
    from unnest(v_words) with ordinality as t(w, ord);
  v_patterns := me.patterns || jsonb_build_array(v_row);
  select count(*) into v_solved from unnest(v_words) as w where w = any(v_guesses);

  update public.termo_duel_guesses set guesses = v_guesses where duel_id = d.id and user_id = v_uid;
  update public.termo_duel_players
    set patterns = v_patterns, solved_count = v_solved, last_seen_at = now(),
        finished_at = case when v_solved = d.board_count or array_length(v_guesses, 1) >= d.board_count + 5
                           then now() end
    where duel_id = d.id and user_id = v_uid;

  if v_solved = d.board_count then
    perform public.termo_duel_finish(d.id, v_uid, 'solved');
  elsif array_length(v_guesses, 1) >= d.board_count + 5 then
    v_opp := case when v_uid = d.host_id then d.guest_id else d.host_id end;
    select * into rival from public.termo_duel_players where duel_id = d.id and user_id = v_opp;
    -- o rival tambem ja esgotou: decide por quem chegou mais perto; empate fica com quem acabou antes
    if rival.finished_at is not null then
      v_my_score := public.termo_duel_score(v_patterns, d.board_count);
      v_rival_score := public.termo_duel_score(rival.patterns, d.board_count);
      perform public.termo_duel_finish(d.id, case when v_my_score > v_rival_score then v_uid else v_opp end, 'closest');
    end if;
  end if;

  return public.termo_duel_json(d.id, v_uid);
end;
$$;

create function public.termo_duel_ping(p_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  update public.termo_duel_players p set last_seen_at = now()
    from public.termo_duels d
    where p.duel_id = d.id and p.user_id = v_uid
      and d.code = upper(btrim(coalesce(p_code, ''))) and d.status in ('waiting', 'playing');
end;
$$;

create function public.termo_duel_forfeit(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  d public.termo_duels;
begin
  d := public.termo_duel_lock(p_code);
  if d.status = 'waiting' then
    if d.host_id = v_uid then
      update public.termo_duels set status = 'expired' where id = d.id;
    else
      -- convidado saiu antes de comecar: a sala volta a esperar (as linhas dele ficam e sao
      -- zeradas se ele voltar)
      update public.termo_duels set guest_id = null where id = d.id;
      return null;
    end if;
  elsif d.status = 'playing' then
    perform public.termo_duel_finish(d.id, case when v_uid = d.host_id then d.guest_id else d.host_id end, 'forfeit');
  end if;
  return public.termo_duel_json(d.id, v_uid);
end;
$$;

create function public.termo_duel_claim(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  d public.termo_duels;
  v_seen timestamptz;
begin
  d := public.termo_duel_lock(p_code);
  if d.status <> 'playing' then
    return public.termo_duel_json(d.id, v_uid);
  end if;
  select last_seen_at into v_seen from public.termo_duel_players
    where duel_id = d.id and user_id = case when v_uid = d.host_id then d.guest_id else d.host_id end;
  if v_seen > now() - interval '60 seconds' then
    raise exception 'Seu rival ainda está no jogo';
  end if;
  perform public.termo_duel_finish(d.id, v_uid, 'abandoned');
  return public.termo_duel_json(d.id, v_uid);
end;
$$;

-- placar historico contra um amigo
create function public.termo_duel_record(p_friend uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'wins', count(*) filter (where winner_id = auth.uid()),
    'losses', count(*) filter (where winner_id = p_friend))
  from public.termo_duels
  where status = 'finished'
    and ((host_id = auth.uid() and guest_id = p_friend) or (host_id = p_friend and guest_id = auth.uid()))
$$;

-- 4) permissoes ------------------------------------------------------------

revoke execute on function public.termo_duel_score(jsonb, integer) from public, anon, authenticated;
revoke execute on function public.termo_duel_json(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.termo_duel_finish(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.termo_duel_lock(text) from public, anon, authenticated;

revoke execute on function public.termo_duel_create(integer) from public, anon;
revoke execute on function public.termo_duel_join(text) from public, anon;
revoke execute on function public.termo_duel_start(text) from public, anon;
revoke execute on function public.termo_duel_state(text) from public, anon;
revoke execute on function public.termo_duel_guess(text, text) from public, anon;
revoke execute on function public.termo_duel_ping(text) from public, anon;
revoke execute on function public.termo_duel_forfeit(text) from public, anon;
revoke execute on function public.termo_duel_claim(text) from public, anon;
revoke execute on function public.termo_duel_record(uuid) from public, anon;

grant execute on function public.termo_duel_create(integer) to authenticated;
grant execute on function public.termo_duel_join(text) to authenticated;
grant execute on function public.termo_duel_start(text) to authenticated;
grant execute on function public.termo_duel_state(text) to authenticated;
grant execute on function public.termo_duel_guess(text, text) to authenticated;
grant execute on function public.termo_duel_ping(text) to authenticated;
grant execute on function public.termo_duel_forfeit(text) to authenticated;
grant execute on function public.termo_duel_claim(text) to authenticated;
grant execute on function public.termo_duel_record(uuid) to authenticated;
