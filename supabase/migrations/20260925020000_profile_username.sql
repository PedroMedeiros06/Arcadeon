-- Troca de nome de usuario pelo perfil. A coluna username nao e editavel direto pela API
-- (ver harden_coins_and_profiles), entao a troca passa por esta funcao, que valida formato
-- e unicidade sem diferenciar maiusculas (o login por usuario usa ilike).

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

create function public.update_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_username);
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if v_name !~ '^[A-Za-z0-9_.-]{3,20}$' then
    raise exception 'Use de 3 a 20 caracteres: letras, números, ponto, hífen ou _.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.username) = lower(v_name) and p.id <> v_user_id
  ) then
    raise exception 'Esse nome de usuário já está em uso.'
      using errcode = '23505';
  end if;

  update public.profiles set username = v_name where id = v_user_id;
  return v_name;
end;
$$;

revoke execute on function public.update_username(text) from public, anon;
grant execute on function public.update_username(text) to authenticated;
