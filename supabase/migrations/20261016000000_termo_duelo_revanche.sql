-- Duelo: revanche. Antes "Novo duelo" criava uma sala solta e o rival nao ficava sabendo; tinha que
-- sair e entrar pelo codigo novo. Agora a sala terminada aponta pra revanche (rematch_id): quem pede
-- cria a sala nova, o rival ve o pedido na tela de resultado (Realtime na sala velha) e, ao aceitar,
-- entra e o duelo ja comeca.

alter table public.termo_duels
  add column if not exists rematch_id uuid references public.termo_duels(id) on delete set null;

-- estado da sala do ponto de vista de p_uid (igual ao anterior + 'rematch')
create or replace function public.termo_duel_json(p_duel_id uuid, p_uid uuid)
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
  v_rematch jsonb;
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

  if d.rematch_id is not null then
    select jsonb_build_object('code', r.code, 'host_id', r.host_id,
        -- sala de espera velha demais ja nao aceita ninguem
        'status', case when r.status = 'waiting' and r.created_at < now() - interval '15 minutes'
                       then 'expired' else r.status end)
      into v_rematch
      from public.termo_duels r
      where r.id = d.rematch_id;
  end if;

  return jsonb_build_object(
    'id', d.id, 'code', d.code, 'board_count', d.board_count, 'max_attempts', d.board_count + 5,
    'status', d.status, 'host_id', d.host_id, 'guest_id', d.guest_id,
    'created_at', d.created_at, 'started_at', d.started_at, 'finished_at', d.finished_at,
    'winner_id', d.winner_id, 'end_reason', d.end_reason, 'now', now(),
    'me', v_me, 'opponent', v_rival, 'rematch', v_rematch,
    'words', case when v_done then (select to_jsonb(words) from public.termo_duel_words where duel_id = d.id) end
  );
end;
$$;

-- Pede ou aceita a revanche de um duelo terminado. Quem pede primeiro vira dono da sala nova (esperando);
-- o rival chamando depois entra nela e o duelo comeca na hora (contagem de 3 s).
create or replace function public.termo_duel_rematch(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  d public.termo_duels;
  r public.termo_duels;
  v_opp uuid;
  v_new jsonb;
begin
  -- trava a sala velha: os dois clicando juntos nao criam duas revanches
  d := public.termo_duel_lock(p_code);
  if d.status <> 'finished' then
    raise exception 'O duelo ainda não acabou';
  end if;
  v_opp := case when v_uid = d.host_id then d.guest_id else d.host_id end;

  if d.rematch_id is not null then
    select * into r from public.termo_duels where id = d.rematch_id for update;
    if r.id is not null then
      -- ja estou nela (pedi antes, F5) ou ela ja comecou/acabou comigo dentro
      if v_uid in (r.host_id, r.guest_id) and r.status <> 'expired' then
        return public.termo_duel_json(r.id, v_uid);
      end if;
      -- o rival pediu e ainda esta esperando: entro e comeca
      if r.status = 'waiting' and r.host_id = v_opp and r.guest_id is null
         and r.created_at >= now() - interval '15 minutes' then
        update public.termo_duels
          set guest_id = v_uid, status = 'playing', started_at = now() + interval '3 seconds'
          where id = r.id;
        insert into public.termo_duel_players (duel_id, user_id) values (r.id, v_uid)
          on conflict (duel_id, user_id) do update set patterns = '[]'::jsonb, solved_count = 0;
        insert into public.termo_duel_guesses (duel_id, user_id) values (r.id, v_uid)
          on conflict (duel_id, user_id) do update set guesses = '{}';
        update public.termo_duel_players set last_seen_at = now() where duel_id = r.id;
        return public.termo_duel_json(r.id, v_uid);
      end if;
      -- pedido antigo cancelado/expirado: cria outro abaixo
    end if;
  end if;

  v_new := public.termo_duel_create(d.board_count);
  update public.termo_duels set rematch_id = (v_new ->> 'id')::uuid where id = d.id;
  return v_new;
end;
$$;

revoke execute on function public.termo_duel_json(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.termo_duel_rematch(text) from public, anon;
grant execute on function public.termo_duel_rematch(text) to authenticated;
