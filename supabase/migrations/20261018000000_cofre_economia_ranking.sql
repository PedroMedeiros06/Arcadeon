-- Cofre (jogo da memoria): moedas das salas online, ranking e presenca social.
-- Coloca 'cofre' em toda lista fixa de jogos e cria cofre_scores + record_cofre_result + cofre_leaderboard.
-- Quem recriar award_match_coins, log_activity, set_status ou send_game_invite precisa manter 'cofre' na lista.

-- listas de jogos nas tabelas -------------------------------------------------

alter table public.match_rewards drop constraint match_rewards_game_check;
alter table public.match_rewards add constraint match_rewards_game_check
  check (game in ('buggle', 'drawit', 'corrida', 'cofre'));

alter table public.daily_activity drop constraint daily_activity_game_check;
alter table public.daily_activity add constraint daily_activity_game_check
  check (game in ('hub', 'termo', 'buggle', 'drawit', 'corrida', 'cofre'));

alter table public.user_status drop constraint user_status_game_check;
alter table public.user_status add constraint user_status_game_check
  check (game in ('termo', 'buggle', 'drawit', 'corrida', 'cofre'));

alter table public.game_invites drop constraint game_invites_game_check;
alter table public.game_invites add constraint game_invites_game_check
  check (game in ('termo', 'buggle', 'drawit', 'corrida', 'cofre'));

-- moedas da partida -----------------------------------------------------------

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
  if p_game not in ('buggle', 'drawit', 'corrida', 'cofre') then
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

-- atividade, status e convites ------------------------------------------------

create or replace function public.log_activity(p_game text, p_anon_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_game is null or p_game not in ('hub', 'termo', 'buggle', 'drawit', 'corrida', 'cofre') then
    return;
  end if;

  if v_uid is not null then
    insert into public.daily_activity (user_id, game)
    values (v_uid, p_game)
    on conflict (user_id, day, game) where user_id is not null
    do update set count = public.daily_activity.count + 1, last_at = now();
  elsif p_anon_key is not null and length(p_anon_key) between 16 and 64 then
    insert into public.daily_activity (anon_key, game)
    values (p_anon_key, p_game)
    on conflict (anon_key, day, game) where user_id is null
    do update set count = public.daily_activity.count + 1, last_at = now();
  end if;
end;
$$;

create or replace function public.set_status(
  p_state text, p_place text, p_game text, p_room_code text, p_players integer, p_max_players integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game text := nullif(p_game, '');
  v_room text := upper(nullif(p_room_code, ''));
begin
  if v_uid is null then
    return;
  end if;
  if p_state not in ('online', 'playing')
     or p_place not in ('hub', 'shop', 'leaderboard', 'profile', 'lobby', 'match') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  if v_game is not null and v_game not in ('termo', 'buggle', 'drawit', 'corrida', 'cofre') then
    v_game := null;
  end if;
  if v_room is not null and v_room !~ '^[A-HJ-NP-Z2-9]{5}$' then
    v_room := null;
  end if;

  insert into public.user_status (user_id, state, game, place, room_code, players, max_players, updated_at)
  values (
    v_uid, p_state, v_game, p_place, v_room,
    case when p_players between 0 and 99 then p_players end,
    case when p_max_players between 0 and 99 then p_max_players end,
    now()
  )
  on conflict (user_id) do update set
    state = excluded.state, game = excluded.game, place = excluded.place, room_code = excluded.room_code,
    players = excluded.players, max_players = excluded.max_players, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.send_game_invite(p_to uuid, p_game text, p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room text := upper(btrim(coalesce(p_room_code, '')));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta pra convidar';
  end if;
  if p_game not in ('termo', 'buggle', 'drawit', 'corrida', 'cofre') or v_room !~ '^[A-HJ-NP-Z2-9]{5}$' then
    raise exception 'Sala inválida';
  end if;
  if not public._are_friends(v_uid, p_to) then
    raise exception 'Só dá pra convidar amigos';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text || p_to::text || v_room));
  if exists (
    select 1 from public.game_invites
    where from_id = v_uid and to_id = p_to and game = p_game and room_code = v_room
      and status = 'sent' and expires_at > now()
  ) then
    raise exception 'Convite já enviado pra essa sala';
  end if;

  insert into public.game_invites (from_id, to_id, game, room_code)
  values (v_uid, p_to, p_game, v_room)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;

-- ranking das salas online ----------------------------------------------------

create table public.cofre_scores (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  games_played integer not null default 0,
  wins integer not null default 0,
  pairs integer not null default 0,
  best_points integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.cofre_scores enable row level security;
revoke all on public.cofre_scores from anon, authenticated;
grant select on public.cofre_scores to anon, authenticated;
create policy "Cofre scores are viewable by everyone" on public.cofre_scores for select using (true);

create or replace function public.record_cofre_result(
  p_user_id uuid, p_won boolean, p_pairs integer, p_points integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.cofre_scores (user_id, games_played, wins, pairs, best_points)
  values (
    p_user_id, 1, case when p_won then 1 else 0 end,
    least(greatest(coalesce(p_pairs, 0), 0), 18), least(greatest(coalesce(p_points, 0), 0), 20)
  )
  on conflict (user_id) do update set
    games_played = public.cofre_scores.games_played + 1,
    wins = public.cofre_scores.wins + excluded.wins,
    pairs = public.cofre_scores.pairs + excluded.pairs,
    best_points = greatest(public.cofre_scores.best_points, excluded.best_points),
    updated_at = now();
$$;

revoke execute on function public.record_cofre_result(uuid, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.record_cofre_result(uuid, boolean, integer, integer) to service_role;

create view public.cofre_leaderboard
with (security_invoker = true) as
select
  s.user_id as id,
  p.username,
  av.emoji as avatar_emoji,
  av.bg_color as avatar_bg_color,
  av.image_url as avatar_image_url,
  s.games_played,
  s.wins,
  s.pairs,
  s.best_points,
  s.updated_at
from public.cofre_scores s
join public.profiles p on p.id = s.user_id
left join public.avatars av on av.id = p.equipped_avatar_id;

revoke all on public.cofre_leaderboard from anon, authenticated;
grant select on public.cofre_leaderboard to anon, authenticated;
