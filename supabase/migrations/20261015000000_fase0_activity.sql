-- Fase 0: medicao de retencao (spec 2026-10-12, secao 4)

create table public.daily_activity (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  anon_key text,
  day date not null default public.termo_today(),
  game text not null check (game in ('hub', 'termo', 'buggle', 'drawit', 'corrida')),
  count integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  constraint daily_activity_who check (user_id is not null or anon_key is not null)
);

create unique index daily_activity_user_key on public.daily_activity (user_id, day, game) where user_id is not null;
create unique index daily_activity_anon_key on public.daily_activity (anon_key, day, game) where user_id is null;
create index daily_activity_day on public.daily_activity (day);

alter table public.daily_activity enable row level security;
revoke all on public.daily_activity from anon, authenticated;

create or replace function public.log_activity(p_game text, p_anon_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_game is null or p_game not in ('hub', 'termo', 'buggle', 'drawit', 'corrida') then
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

revoke execute on function public.log_activity(text, text) from public;
grant execute on function public.log_activity(text, text) to anon, authenticated;

-- uma pessoa = conta ou chave anonima (quem entra na conta depois vira pessoa nova)
create view public.retention_cohorts
with (security_invoker = true)
as
with people as (
  select coalesce(user_id::text, 'anon:' || anon_key) as who, day
  from public.daily_activity
  group by 1, 2
),
firsts as (
  select who, min(day) as first_day from people group by who
)
select
  f.first_day,
  count(*)::int as total,
  count(*) filter (where exists (select 1 from people p where p.who = f.who and p.day = f.first_day + 1))::int as returned_d1,
  count(*) filter (where exists (select 1 from people p where p.who = f.who and p.day = f.first_day + 7))::int as returned_d7,
  count(*) filter (where exists (select 1 from people p where p.who = f.who and p.day between f.first_day + 1 and f.first_day + 7))::int as returned_within_7d
from firsts f
group by f.first_day
order by f.first_day desc;

revoke all on public.retention_cohorts from public, anon, authenticated;
grant select on public.retention_cohorts to service_role;
