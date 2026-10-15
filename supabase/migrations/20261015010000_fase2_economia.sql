-- Fase 2: economia (spec 2026-10-12, secao 6)

-- 6.1 Livro de moedas -------------------------------------------------------

create table public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default public.termo_today(),
  amount integer not null,
  source text not null check (source in ('match', 'mission', 'streak', 'purchase', 'refund', 'termo', 'opening')),
  game text,
  ref text,
  created_at timestamptz not null default now()
);

create index coin_ledger_user_day on public.coin_ledger (user_id, day);

alter table public.coin_ledger enable row level security;
revoke all on public.coin_ledger from anon, authenticated;
grant select on public.coin_ledger to authenticated;
create policy "coin ledger own" on public.coin_ledger for select to authenticated using (user_id = (select auth.uid()));

-- saldo de abertura: a soma do livro passa a bater com profiles.coins
insert into public.coin_ledger (user_id, amount, source, ref)
select id, coins, 'opening', 'saldo antes do livro' from public.profiles where coins <> 0;

-- Toda mudanca de profiles.coins vira linha no livro. Quem nao marca a origem
-- (as RPCs do Letrado) cai em 'termo'.
create or replace function public.coin_ledger_on_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.coins is distinct from old.coins then
    insert into public.coin_ledger (user_id, amount, source, game, ref)
    values (
      new.id,
      new.coins - old.coins,
      coalesce(nullif(current_setting('arcadeon.coin_source', true), ''), 'termo'),
      nullif(current_setting('arcadeon.coin_game', true), ''),
      nullif(current_setting('arcadeon.coin_ref', true), '')
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.coin_ledger_on_change() from public, anon, authenticated;

create trigger profiles_coin_ledger
after update of coins on public.profiles
for each row execute function public.coin_ledger_on_change();

-- Credita/debita marcando a origem no livro. Devolve o saldo novo.
create or replace function public._coin_change(p_user_id uuid, p_amount integer, p_source text, p_game text, p_ref text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coins integer;
begin
  perform set_config('arcadeon.coin_source', p_source, true);
  perform set_config('arcadeon.coin_game', coalesce(p_game, ''), true);
  perform set_config('arcadeon.coin_ref', coalesce(p_ref, ''), true);
  update public.profiles set coins = coins + p_amount where id = p_user_id returning coins into v_coins;
  perform set_config('arcadeon.coin_source', '', true);
  perform set_config('arcadeon.coin_game', '', true);
  perform set_config('arcadeon.coin_ref', '', true);
  return v_coins;
end;
$$;

revoke execute on function public._coin_change(uuid, integer, text, text, text) from public, anon, authenticated;

create or replace function public.purchase_avatar(p_avatar_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_price int;
  v_coins int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select price_coins into v_price from public.avatars where id = p_avatar_id;
  if v_price is null then
    raise exception 'avatar not purchasable';
  end if;

  select coins into v_coins from public.profiles where id = v_user_id for update;
  if v_coins < v_price then
    raise exception 'insufficient coins';
  end if;

  if exists (select 1 from public.user_avatars where user_id = v_user_id and avatar_id = p_avatar_id) then
    raise exception 'already owned';
  end if;

  perform public._coin_change(v_user_id, -v_price, 'purchase', null, 'avatar:' || p_avatar_id);
  insert into public.user_avatars (user_id, avatar_id, acquired_via) values (v_user_id, p_avatar_id, 'purchase');
end;
$$;

-- 6.4 Sequencia do Arcadeon -------------------------------------------------

alter table public.profiles
  add column arcadeon_streak integer not null default 0,
  add column arcadeon_best_streak integer not null default 0,
  add column arcadeon_last_day date,
  add column arcadeon_cycle_day integer not null default 0 check (arcadeon_cycle_day between 0 and 7),
  add column arcadeon_claimed_day date;

create or replace function public._arcadeon_rewards()
returns integer[]
language sql
immutable
set search_path = ''
as $$ select array[10, 10, 15, 15, 20, 25, 50] $$;

-- A sequencia segue se o ultimo dia foi ontem, ou se todos os dias pulados
-- foram cobertos por escudo do Letrado (termo_shield_days).
create or replace function public._arcadeon_alive(p_user_id uuid, p_last_day date, p_today date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_last_day is not null and (
    p_last_day >= p_today - 1
    or not exists (
      select 1
      from generate_series(p_last_day + 1, p_today - 1, interval '1 day') g(d)
      where not exists (
        select 1 from public.termo_shield_days s where s.user_id = p_user_id and s.day = g.d::date
      )
    )
  )
$$;

revoke execute on function public._arcadeon_alive(uuid, date, date) from public, anon, authenticated;

create or replace function public._arcadeon_count_day(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.termo_today();
  p public.profiles%rowtype;
begin
  select * into p from public.profiles where id = p_user_id for update;
  if not found or p.arcadeon_last_day = v_today then
    return;
  end if;

  if public._arcadeon_alive(p_user_id, p.arcadeon_last_day, v_today) then
    p.arcadeon_streak := p.arcadeon_streak + 1;
    p.arcadeon_cycle_day := p.arcadeon_cycle_day % 7 + 1;
  else
    p.arcadeon_streak := 1;
    p.arcadeon_cycle_day := 1;
  end if;

  update public.profiles set
    arcadeon_streak = p.arcadeon_streak,
    arcadeon_best_streak = greatest(arcadeon_best_streak, p.arcadeon_streak),
    arcadeon_cycle_day = p.arcadeon_cycle_day,
    arcadeon_last_day = v_today
  where id = p_user_id;
end;
$$;

revoke execute on function public._arcadeon_count_day(uuid) from public, anon, authenticated;

create or replace function public.get_arcadeon_streak()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.termo_today();
  p public.profiles%rowtype;
  v_alive boolean;
  v_counted boolean;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta pra ver a sequência';
  end if;
  select * into p from public.profiles where id = v_uid;
  if not found then
    return null;
  end if;

  v_counted := p.arcadeon_last_day = v_today;
  v_alive := public._arcadeon_alive(v_uid, p.arcadeon_last_day, v_today);

  return jsonb_build_object(
    'streak', case when v_alive then p.arcadeon_streak else 0 end,
    'best_streak', p.arcadeon_best_streak,
    'counted_today', coalesce(v_counted, false),
    'cycle_day', case
      when v_counted then p.arcadeon_cycle_day
      when v_alive then p.arcadeon_cycle_day % 7 + 1
      else 1 end,
    'claimed_today', coalesce(p.arcadeon_claimed_day = v_today, false),
    'rewards', to_jsonb(public._arcadeon_rewards())
  );
end;
$$;

create or replace function public.claim_streak_reward()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.termo_today();
  p public.profiles%rowtype;
  v_reward integer;
  v_coins integer;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta pra resgatar';
  end if;
  select * into p from public.profiles where id = v_uid for update;
  if p.arcadeon_last_day is distinct from v_today then
    raise exception 'Termine uma partida hoje pra liberar a recompensa';
  end if;
  if p.arcadeon_claimed_day = v_today then
    raise exception 'A recompensa de hoje já foi resgatada';
  end if;

  v_reward := (public._arcadeon_rewards())[p.arcadeon_cycle_day];
  update public.profiles set arcadeon_claimed_day = v_today where id = v_uid;
  v_coins := public._coin_change(v_uid, v_reward, 'streak', null, 'ciclo:' || p.arcadeon_cycle_day);
  return jsonb_build_object('coins_awarded', v_reward, 'coins', v_coins);
end;
$$;

revoke execute on function public.get_arcadeon_streak() from public, anon;
revoke execute on function public.claim_streak_reward() from public, anon;
grant execute on function public.get_arcadeon_streak() to authenticated;
grant execute on function public.claim_streak_reward() to authenticated;

-- 6.3 Missoes do dia --------------------------------------------------------

create table public.mission_templates (
  id uuid primary key default gen_random_uuid(),
  game text check (game in ('termo', 'buggle', 'drawit', 'corrida')),
  kind text not null,
  target integer not null check (target > 0),
  reward integer not null check (reward >= 0),
  text text not null,
  easy boolean not null default false,
  active boolean not null default true
);

alter table public.mission_templates enable row level security;
revoke all on public.mission_templates from anon, authenticated;
grant select on public.mission_templates to anon, authenticated;
create policy "mission templates public" on public.mission_templates for select using (true);

insert into public.mission_templates (game, kind, target, reward, text, easy) values
  ('termo',   'termo_win',          1,  10, 'Vença 1 Letrado diário', true),
  ('termo',   'termo_win',          2,  20, 'Vença 2 Letrados diários (qualquer modo)', false),
  ('drawit',  'draw_correct_guess', 3,  10, 'Acerte 3 desenhos no Rabiscado', true),
  ('drawit',  'draw_correct_guess', 8,  20, 'Acerte 8 desenhos no Rabiscado', false),
  ('buggle',  'buggle_words',       15, 10, 'Encontre 15 palavras no Buggle', true),
  ('buggle',  'buggle_words',       40, 20, 'Encontre 40 palavras no Buggle', false),
  ('corrida', 'race_finish',        1,  10, 'Termine 1 partida da Corrida', true),
  ('corrida', 'race_finish',        3,  20, 'Termine 3 partidas da Corrida', false),
  (null,      'play_any',           1,  5,  'Termine 1 partida de qualquer jogo', true),
  (null,      'play_any',           3,  15, 'Termine 3 partidas de qualquer jogo', false);

create table public.user_daily_missions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  template_id uuid not null references public.mission_templates(id),
  progress integer not null default 0,
  completed_at timestamptz,
  primary key (user_id, day, template_id)
);

create table public.user_daily_chests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  reward integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.user_daily_missions enable row level security;
alter table public.user_daily_chests enable row level security;
revoke all on public.user_daily_missions from anon, authenticated;
revoke all on public.user_daily_chests from anon, authenticated;
grant select on public.user_daily_missions, public.user_daily_chests to authenticated;
create policy "daily missions own" on public.user_daily_missions for select to authenticated using (user_id = (select auth.uid()));
create policy "daily chests own" on public.user_daily_chests for select to authenticated using (user_id = (select auth.uid()));

create or replace function public._mission_chest_reward()
returns integer
language sql
immutable
set search_path = ''
as $$ select 30 $$;

-- Sorteia as 3 missoes do dia: uma facil, pelo menos 2 jogos diferentes, sem repetir tipo.
create or replace function public._ensure_daily_missions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.termo_today();
  a public.mission_templates%rowtype;
  b public.mission_templates%rowtype;
  c public.mission_templates%rowtype;
begin
  if exists (select 1 from public.user_daily_missions where user_id = p_user_id and day = v_today) then
    return;
  end if;
  perform 1 from public.profiles where id = p_user_id for update;
  if not found or exists (select 1 from public.user_daily_missions where user_id = p_user_id and day = v_today) then
    return;
  end if;

  select * into a from public.mission_templates where active and easy order by random() limit 1;
  select * into b from public.mission_templates
    where active and kind <> a.kind and coalesce(game, 'any') <> coalesce(a.game, 'any')
    order by random() limit 1;
  select * into c from public.mission_templates
    where active and kind not in (a.kind, b.kind)
    order by random() limit 1;

  insert into public.user_daily_missions (user_id, day, template_id)
  select p_user_id, v_today, t from unnest(array[a.id, b.id, c.id]) t where t is not null;
end;
$$;

revoke execute on function public._ensure_daily_missions(uuid) from public, anon, authenticated;

create or replace function public._mission_progress(p_user_id uuid, p_kind text, p_amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.termo_today();
  r record;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    return;
  end if;
  perform public._ensure_daily_missions(p_user_id);

  for r in
    update public.user_daily_missions m
      set progress = least(t.target, m.progress + p_amount),
          completed_at = case when m.progress + p_amount >= t.target then now() end
    from public.mission_templates t
    where m.template_id = t.id and m.user_id = p_user_id and m.day = v_today
      and m.completed_at is null and t.kind = p_kind
    returning t.id, t.reward, m.completed_at
  loop
    if r.completed_at is not null and r.reward > 0 then
      perform public._coin_change(p_user_id, r.reward, 'mission', null, 'missao:' || r.id);
    end if;
  end loop;

  if not exists (
       select 1 from public.user_daily_missions
       where user_id = p_user_id and day = v_today and completed_at is null)
     and exists (select 1 from public.user_daily_missions where user_id = p_user_id and day = v_today)
  then
    insert into public.user_daily_chests (user_id, day, reward)
    values (p_user_id, v_today, public._mission_chest_reward())
    on conflict do nothing;
    if found then
      perform public._coin_change(p_user_id, public._mission_chest_reward(), 'mission', null, 'bau');
    end if;
  end if;
end;
$$;

revoke execute on function public._mission_progress(uuid, text, integer) from public, anon, authenticated;

create or replace function public.mission_progress(p_user_id uuid, p_kind text, p_amount integer)
returns void
language sql
security definer
set search_path = ''
as $$ select public._mission_progress(p_user_id, p_kind, p_amount) $$;

revoke execute on function public.mission_progress(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.mission_progress(uuid, text, integer) to service_role;

create or replace function public.get_daily_missions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.termo_today();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta pra ver as missões';
  end if;
  perform public._ensure_daily_missions(v_uid);

  return jsonb_build_object(
    'day', v_today,
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'game', t.game, 'kind', t.kind, 'text', t.text,
        'target', t.target, 'progress', m.progress, 'reward', t.reward, 'completed_at', m.completed_at
      ) order by t.easy desc, t.target)
      from public.user_daily_missions m join public.mission_templates t on t.id = m.template_id
      where m.user_id = v_uid and m.day = v_today
    ), '[]'::jsonb),
    'chest', jsonb_build_object(
      'reward', public._mission_chest_reward(),
      'claimed', exists (select 1 from public.user_daily_chests where user_id = v_uid and day = v_today)
    )
  );
end;
$$;

revoke execute on function public.get_daily_missions() from public, anon;
grant execute on function public.get_daily_missions() to authenticated;

-- 6.2 Moedas por partida em grupo -------------------------------------------

create table public.match_rewards (
  match_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('buggle', 'drawit', 'corrida')),
  day date not null default public.termo_today(),
  placement integer not null,
  logged_players integer not null,
  awarded integer not null,
  capped boolean not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index match_rewards_user_day on public.match_rewards (user_id, day);
alter table public.match_rewards enable row level security;
revoke all on public.match_rewards from anon, authenticated;

create or replace function public.award_match_coins(
  p_user_id uuid, p_game text, p_placement integer, p_logged_players integer, p_match_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.termo_today();
  v_prev public.match_rewards%rowtype;
  v_base integer := 0;
  v_paid integer;
  v_awarded integer := 0;
  v_capped boolean := false;
  v_coins integer;
begin
  if p_game not in ('buggle', 'drawit', 'corrida') then
    raise exception 'jogo inválido: %', p_game;
  end if;
  if p_match_id is null or length(p_match_id) = 0 or length(p_match_id) > 120 then
    raise exception 'p_match_id inválido';
  end if;

  select coins into v_coins from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'usuário não encontrado';
  end if;

  select * into v_prev from public.match_rewards where match_id = p_match_id and user_id = p_user_id;
  if found then
    return jsonb_build_object('awarded', v_prev.awarded, 'capped', v_prev.capped, 'coins', v_coins);
  end if;

  if coalesce(p_logged_players, 0) >= 2 and coalesce(p_placement, 0) >= 1 then
    v_base := 5
      + case when p_placement <= 3 then 5 else 0 end
      + case when p_placement = 1 then 10 else 0 end;
    select coalesce(sum(awarded), 0) into v_paid
      from public.match_rewards where user_id = p_user_id and day = v_today;
    v_awarded := least(v_base, greatest(60 - v_paid, 0));
    v_capped := v_awarded < v_base;
  end if;

  insert into public.match_rewards (match_id, user_id, game, placement, logged_players, awarded, capped)
  values (p_match_id, p_user_id, p_game, coalesce(p_placement, 0), coalesce(p_logged_players, 0), v_awarded, v_capped);

  if v_awarded > 0 then
    v_coins := public._coin_change(p_user_id, v_awarded, 'match', p_game, p_match_id);
  end if;

  perform public._arcadeon_count_day(p_user_id);
  perform public._mission_progress(p_user_id, 'play_any', 1);

  select coins into v_coins from public.profiles where id = p_user_id;
  return jsonb_build_object('awarded', v_awarded, 'capped', v_capped, 'coins', v_coins);
end;
$$;

revoke execute on function public.award_match_coins(uuid, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.award_match_coins(uuid, text, integer, integer, text) to service_role;

-- Letrado: terminar o diario ou o Contra o Tempo conta o dia e as missoes ----

create or replace function public.termo_daily_finished_economy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and new.finished_at is not null and old.finished_at is null then
    perform public._arcadeon_count_day(new.user_id);
    perform public._mission_progress(new.user_id, 'play_any', 1);
    if new.won then
      perform public._mission_progress(new.user_id, 'termo_win', 1);
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.termo_daily_finished_economy() from public, anon, authenticated;

create trigger termo_daily_games_economy
after update of finished_at on public.termo_daily_games
for each row execute function public.termo_daily_finished_economy();

create or replace function public.termo_speed_finished_economy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and new.finished and not old.finished then
    perform public._arcadeon_count_day(new.user_id);
    perform public._mission_progress(new.user_id, 'play_any', 1);
  end if;
  return new;
end;
$$;

revoke execute on function public.termo_speed_finished_economy() from public, anon, authenticated;

create trigger termo_speed_runs_economy
after update of finished on public.termo_speed_runs
for each row execute function public.termo_speed_finished_economy();
