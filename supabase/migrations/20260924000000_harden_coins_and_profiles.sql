-- 1) profiles: cliente so pode trocar o avatar equipado (e so por um que possui).
--    coins/username/id/created_at deixam de ser editaveis pela API.
revoke insert, update on public.profiles from anon, authenticated;
grant update (equipped_avatar_id) on public.profiles to authenticated;

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "profiles update own equip" on public.profiles;
create policy "profiles update own equip" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      equipped_avatar_id is null
      or exists (
        select 1 from public.user_avatars ua
        where ua.user_id = auth.uid() and ua.avatar_id = equipped_avatar_id
      )
    )
  );

-- 2) moedas por vitoria no Termo: valor fixo decidido no banco, uma vez por dia/modo,
--    e so se existir resultado diario vencido. Substitui a chamada direta com p_amount.
create table public.termo_win_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  play_date date not null,
  board_count integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, play_date, board_count)
);
alter table public.termo_win_rewards enable row level security;
-- sem policies: so a funcao abaixo (security definer) escreve

create function public.claim_termo_win_reward(p_board_count integer, p_play_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount constant integer := 10;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- play_date vem do cliente (fuso local): aceita so ontem/hoje/amanha
  if p_play_date not between current_date - 1 and current_date + 1 then
    return 0;
  end if;

  if not exists (
    select 1 from public.termo_daily_results r
    where r.user_id = v_user_id and r.board_count = p_board_count
      and r.play_date = p_play_date and r.won
  ) then
    return 0;
  end if;

  insert into public.termo_win_rewards (user_id, play_date, board_count)
  values (v_user_id, p_play_date, p_board_count)
  on conflict do nothing;
  if not found then
    return 0;
  end if;

  perform public.award_coins_and_check_achievements(v_user_id, v_amount, 'termo_win');
  return v_amount;
end;
$$;

revoke execute on function public.claim_termo_win_reward(integer, date) from public, anon;
grant execute on function public.claim_termo_win_reward(integer, date) to authenticated;

-- 3) funcoes internas deixam de ser chamaveis pela API
revoke execute on function public.award_coins_and_check_achievements(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.purchase_avatar(uuid) from public, anon;
grant execute on function public.purchase_avatar(uuid) to authenticated;
