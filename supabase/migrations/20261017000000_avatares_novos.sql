-- 27 avatares novos (imagens em web/public/avatars), Astronauta herda a conquista da Estrela,
-- a remoção de Robô, Raposa e Estrela está em 20261017010000_remover_avatares_antigos

insert into public.avatars (name, emoji, bg_color, price_coins, image_url, unlock_achievement_id)
select v.name, v.emoji, v.bg_color, v.price_coins, v.image_url, v.unlock_achievement_id
from (values
  ('Explorador', '🧭', '#0284C7', 30, '/avatars/explorador.webp', null::uuid),
  ('Pilota', '✈️', '#0284C7', 30, '/avatars/pilota.webp', null),
  ('Cientista', '🧪', '#DB2777', 30, '/avatars/cientista.webp', null),
  ('Atleta', '🏅', '#2563EB', 30, '/avatars/atleta.webp', null),
  ('Artista', '🖌️', '#0F766E', 30, '/avatars/artista.webp', null),
  ('Astronauta', '🚀', '#4F46E5', null, '/avatars/astronauta.webp', '8b34cbe3-c093-423d-be6b-66fe56ae04a3'),
  ('Cavaleiro', '⚔️', '#B45309', 35, '/avatars/cavaleiro.webp', null),
  ('Mago', '🧙', '#D97706', 40, '/avatars/mago.webp', null),
  ('Lobo', '🐺', '#0891B2', 40, '/avatars/lobo.webp', null),
  ('Gato Ninja', '🐱', '#A78BFA', 40, '/avatars/gato-ninja.webp', null),
  ('Fantasma', '👻', '#7C3AED', 40, '/avatars/fantasma.webp', null),
  ('Pirata', '🏴‍☠️', '#0EA5E9', 45, '/avatars/pirata.webp', null),
  ('Cacheada', '🌟', '#7C3AED', 50, '/avatars/cacheada.webp', null),
  ('Detetive', '🔍', '#0E7490', 50, '/avatars/detetive.webp', null),
  ('DJ', '🎧', '#0EA5E9', 50, '/avatars/dj.webp', null),
  ('Kunoichi', '🥷', '#FDE047', 55, '/avatars/kunoichi.webp', null),
  ('Sereia', '🧜‍♀️', '#BE185D', 55, '/avatars/sereia.webp', null),
  ('Hacker', '💻', '#F59E0B', 55, '/avatars/hacker.webp', null),
  ('Samurai Raposa', '⛩️', '#1E3A8A', 60, '/avatars/samurai-raposa.webp', null),
  ('Guerreira Viking', '🛡️', '#0369A1', 60, '/avatars/viking.webp', null),
  ('Vampiro', '🧛', '#475569', 60, '/avatars/vampiro.webp', null),
  ('Bruxa', '🧙‍♀️', '#F59E0B', 60, '/avatars/bruxa.webp', null),
  ('Capoeirista', '🥋', '#15803D', 80, '/avatars/capoeirista.webp', null),
  ('Ciborgue', '🦾', '#7C3AED', 90, '/avatars/ciborgue.webp', null),
  ('Fada Sombria', '🦇', '#14B8A6', 90, '/avatars/fada-sombria.webp', null),
  ('Dragão Chinês', '🐉', '#6D28D9', 90, '/avatars/dragao-chines.webp', null),
  ('Rainha do Gelo', '❄️', '#1E3A8A', 100, '/avatars/rainha-do-gelo.webp', null)
) as v(name, emoji, bg_color, price_coins, image_url, unlock_achievement_id)
where not exists (select 1 from public.avatars a where a.name = v.name);

-- quem já tem a conquista ganha o Astronauta agora (antes vinha a Estrela)
insert into public.user_avatars (user_id, avatar_id, acquired_via)
select ua.user_id, av.id, 'achievement'
from public.user_achievements ua
join public.avatars av on av.unlock_achievement_id = ua.achievement_id
where av.name = 'Astronauta'
on conflict do nothing;

-- convite de Duelo do Letrado pela lista de amigos
alter table public.game_invites drop constraint game_invites_game_check;
alter table public.game_invites add constraint game_invites_game_check
  check (game in ('termo', 'buggle', 'drawit', 'corrida'));

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
  if p_game not in ('termo', 'buggle', 'drawit', 'corrida') or v_room !~ '^[A-HJ-NP-Z2-9]{5}$' then
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
