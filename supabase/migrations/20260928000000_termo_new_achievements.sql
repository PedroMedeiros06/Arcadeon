-- Letrado: conquistas novas. Diario (termo_daily_guess) e Contra o Tempo (termo_speed_finish_run).

insert into public.achievements (code, name, description) values
  ('termo_last_try', 'Por um Fio', 'Vença um Letrado diário na última tentativa'),
  ('termo_quick', 'Relâmpago', 'Vença o Letrado diário em até 1 minuto'),
  ('termo_duo_perfect', 'Dupla Perfeita', 'Vença o Duplo diário em 2 tentativas, sem errar nenhuma'),
  ('termo_triple_crown', 'Trinca do Dia', 'Vença o Letrado, o Duplo e o Quádruplo diários no mesmo dia'),
  ('termo_streak_100', 'Centenário', 'Alcance uma sequência de 100 dias no Letrado'),
  ('termo_wins_100', 'Dicionário Ambulante', 'Some 100 vitórias no Letrado diário, em qualquer modo'),
  ('termo_speed_10', 'Maratonista', 'Acerte 10 palavras numa partida do Contra o Tempo')
on conflict do nothing;

-- palpite do diario: igual a 20260925010000, com as conquistas novas no fim
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
    if v_solved and v_attempts = g.board_count + 5 then v_codes := array_append(v_codes, 'termo_last_try'); end if;
    if v_solved and g.board_count = 1 and v_time <= 60 then v_codes := array_append(v_codes, 'termo_quick'); end if;
    if v_solved and g.board_count = 2 and v_attempts = 2 then v_codes := array_append(v_codes, 'termo_duo_perfect'); end if;
    if v_streak >= 100 then v_codes := array_append(v_codes, 'termo_streak_100'); end if;
    if v_solved and (select count(distinct r.board_count) from public.termo_daily_results r
        where r.user_id = g.user_id and r.play_date = g.play_date and r.won) = 3 then
      v_codes := array_append(v_codes, 'termo_triple_crown');
    end if;
    if v_solved and (select coalesce(sum(s.wins), 0) from public.termo_scores s where s.user_id = g.user_id) >= 100 then
      v_codes := array_append(v_codes, 'termo_wins_100');
    end if;

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

-- Contra o Tempo: igual a 20260925010000, liberando Maratonista ao fechar a partida
create or replace function public.termo_speed_finish_run(p_run_id uuid)
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
    if r.solved >= 10 then
      insert into public.user_achievements (user_id, achievement_id)
        select r.user_id, a.id from public.achievements a where a.code = 'termo_speed_10'
        on conflict do nothing;
    end if;
  end if;
end;
$$;
