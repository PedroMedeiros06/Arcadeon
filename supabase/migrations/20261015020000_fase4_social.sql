-- Fase 4: social (spec 2026-10-12, secao 8)

-- 8.1 Amizades --------------------------------------------------------------

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  -- remocao logica: amizade desfeita ou pedido recusado ganham removed_at
  removed_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index friendships_pair on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee on public.friendships (addressee_id);
create index friendships_requester on public.friendships (requester_id, created_at);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;
create policy "friendships own" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create or replace function public._are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted' and removed_at is null
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  )
$$;

revoke execute on function public._are_friends(uuid, uuid) from public, anon, authenticated;

create or replace function public._friend_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.friendships
  where status = 'accepted' and removed_at is null and p_user_id in (requester_id, addressee_id)
$$;

revoke execute on function public._friend_count(uuid) from public, anon, authenticated;

create or replace function public._send_friend_request(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  f public.friendships%rowtype;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta pra adicionar amigos';
  end if;
  if p_target is null or not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'Usuário não encontrado';
  end if;
  if p_target = v_uid then
    raise exception 'Esse é você';
  end if;

  select * into f from public.friendships
    where least(requester_id, addressee_id) = least(v_uid, p_target)
      and greatest(requester_id, addressee_id) = greatest(v_uid, p_target)
    for update;

  if found and f.removed_at is null then
    if f.status = 'accepted' then
      raise exception 'Vocês já são amigos';
    end if;
    if f.requester_id = v_uid then
      raise exception 'Pedido já enviado';
    end if;
    if public._friend_count(v_uid) >= 200 or public._friend_count(p_target) >= 200 then
      raise exception 'Limite de 200 amigos';
    end if;
    update public.friendships set status = 'accepted', responded_at = now() where id = f.id;
    return jsonb_build_object('id', f.id, 'status', 'accepted');
  end if;

  if (select count(*) from public.friendships
      where requester_id = v_uid
        and (created_at at time zone 'America/Sao_Paulo')::date = public.termo_today()) >= 20 then
    raise exception 'Limite de 20 pedidos por dia';
  end if;
  if public._friend_count(v_uid) >= 200 then
    raise exception 'Limite de 200 amigos';
  end if;

  if found then
    update public.friendships set
      requester_id = v_uid, addressee_id = p_target, status = 'pending',
      created_at = now(), responded_at = null, removed_at = null
    where id = f.id;
    return jsonb_build_object('id', f.id, 'status', 'pending');
  end if;

  begin
    insert into public.friendships (requester_id, addressee_id) values (v_uid, p_target) returning * into f;
  exception when unique_violation then
    raise exception 'Pedido já enviado';
  end;
  return jsonb_build_object('id', f.id, 'status', 'pending');
end;
$$;

revoke execute on function public._send_friend_request(uuid) from public, anon, authenticated;

create or replace function public.send_friend_request(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_username, ''), '^\s*@', ''));
  v_target uuid;
begin
  select id into v_target from public.profiles where lower(username) = lower(v_name);
  if v_target is null then
    raise exception 'Usuário não encontrado';
  end if;
  return public._send_friend_request(v_target);
end;
$$;

create or replace function public.send_friend_request_to(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select public._send_friend_request(p_user_id) $$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  f public.friendships%rowtype;
begin
  select * into f from public.friendships
    where id = p_id and addressee_id = v_uid and status = 'pending' and removed_at is null
    for update;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if p_accept then
    if public._friend_count(v_uid) >= 200 or public._friend_count(f.requester_id) >= 200 then
      raise exception 'Limite de 200 amigos';
    end if;
    update public.friendships set status = 'accepted', responded_at = now() where id = p_id;
  else
    update public.friendships set removed_at = now(), responded_at = now() where id = p_id;
  end if;
end;
$$;

create or replace function public.remove_friend(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta';
  end if;
  update public.friendships set removed_at = now()
    where removed_at is null
      and least(requester_id, addressee_id) = least(v_uid, p_user_id)
      and greatest(requester_id, addressee_id) = greatest(v_uid, p_user_id);
  update public.game_invites set status = 'expired'
    where status = 'sent'
      and ((from_id = v_uid and to_id = p_user_id) or (from_id = p_user_id and to_id = v_uid));
end;
$$;

-- 8.2 Status ----------------------------------------------------------------

create table public.user_status (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  state text not null check (state in ('online', 'playing')),
  game text check (game in ('termo', 'buggle', 'drawit', 'corrida')),
  place text not null check (place in ('hub', 'shop', 'leaderboard', 'profile', 'lobby', 'match')),
  room_code text check (room_code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  players integer check (players between 0 and 99),
  max_players integer check (max_players between 0 and 99),
  appear_offline boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_status enable row level security;
revoke all on public.user_status from anon, authenticated;
grant select on public.user_status to authenticated;
create policy "user status own or friends" on public.user_status for select to authenticated
  using (
    user_id = (select auth.uid())
    or (not appear_offline and exists (
      select 1 from public.friendships f
      where f.status = 'accepted' and f.removed_at is null
        and ((f.requester_id = user_status.user_id and f.addressee_id = (select auth.uid()))
          or (f.addressee_id = user_status.user_id and f.requester_id = (select auth.uid())))
    ))
  );

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
  if v_game is not null and v_game not in ('termo', 'buggle', 'drawit', 'corrida') then
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

create or replace function public.set_appear_offline(p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta';
  end if;
  insert into public.user_status (user_id, state, place, appear_offline)
  values (v_uid, 'online', 'profile', coalesce(p_value, false))
  on conflict (user_id) do update set appear_offline = excluded.appear_offline;
end;
$$;

create or replace function public.my_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('appear_offline', coalesce(
    (select appear_offline from public.user_status where user_id = auth.uid()), false))
$$;

create or replace function public._avatar_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('emoji', a.emoji, 'bg_color', a.bg_color, 'image_url', a.image_url)
     from public.profiles p join public.avatars a on a.id = p.equipped_avatar_id
     where p.id = p_user_id),
    jsonb_build_object('emoji', null, 'bg_color', null, 'image_url', null))
$$;

revoke execute on function public._avatar_json(uuid) from public, anon, authenticated;

create or replace function public.my_friends()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'friendship_id', f.id,
      'user_id', o.id,
      'username', o.username,
      'avatar', public._avatar_json(o.id),
      'status', f.status,
      'direction', case when f.status = 'accepted' then null
                        when f.requester_id = v_uid then 'outgoing' else 'incoming' end,
      'presence', case when f.status = 'accepted' and s.user_id is not null and not s.appear_offline then
        jsonb_build_object('state', s.state, 'place', s.place, 'game', s.game, 'room_code', s.room_code,
                           'players', s.players, 'max_players', s.max_players, 'updated_at', s.updated_at)
        end,
      'server_now', now()
    ) order by lower(o.username))
    from public.friendships f
    join public.profiles o on o.id = case when f.requester_id = v_uid then f.addressee_id else f.requester_id end
    left join public.user_status s on s.user_id = o.id
    where v_uid in (f.requester_id, f.addressee_id) and f.removed_at is null
  ), '[]'::jsonb);
end;
$$;

-- 8.3 Convites para partida -------------------------------------------------

create table public.game_invites (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('buggle', 'drawit', 'corrida')),
  room_code text not null check (room_code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'expired'))
);

create index game_invites_to on public.game_invites (to_id, status, expires_at);
create index game_invites_from on public.game_invites (from_id, to_id, game, room_code);

alter table public.game_invites enable row level security;
revoke all on public.game_invites from anon, authenticated;
grant select on public.game_invites to authenticated;
create policy "game invites recipient" on public.game_invites for select to authenticated
  using (to_id = (select auth.uid()));

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
  if p_game not in ('buggle', 'drawit', 'corrida') or v_room !~ '^[A-HJ-NP-Z2-9]{5}$' then
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

create or replace function public.respond_game_invite(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  i public.game_invites%rowtype;
begin
  select * into i from public.game_invites where id = p_id and to_id = v_uid for update;
  if not found then
    raise exception 'Convite não encontrado';
  end if;
  if i.status <> 'sent' then
    return;
  end if;
  if i.expires_at <= now() then
    update public.game_invites set status = 'expired' where id = p_id;
    if p_accept then
      raise exception 'Esse convite já venceu';
    end if;
    return;
  end if;
  update public.game_invites set status = case when p_accept then 'accepted' else 'declined' end where id = p_id;
end;
$$;

create or replace function public.my_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'game', i.game, 'room_code', i.room_code, 'expires_at', i.expires_at,
      'from', jsonb_build_object('user_id', p.id, 'username', p.username, 'avatar', public._avatar_json(p.id))
    ) order by i.created_at desc)
    from public.game_invites i join public.profiles p on p.id = i.from_id
    where i.to_id = v_uid and i.status = 'sent' and i.expires_at > now()
  ), '[]'::jsonb);
end;
$$;

-- permissoes das RPCs publicas
do $$
declare f text;
begin
  foreach f in array array[
    'public.send_friend_request(text)',
    'public.send_friend_request_to(uuid)',
    'public.respond_friend_request(uuid, boolean)',
    'public.remove_friend(uuid)',
    'public.my_friends()',
    'public.set_status(text, text, text, text, integer, integer)',
    'public.set_appear_offline(boolean)',
    'public.my_status()',
    'public.send_game_invite(uuid, text, text)',
    'public.respond_game_invite(uuid, boolean)',
    'public.my_invites()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Realtime: o front escuta postgres_changes, filtrado pela RLS de leitura
alter publication supabase_realtime add table public.friendships, public.user_status, public.game_invites;
