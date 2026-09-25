-- funcoes pagas (moedas) sao so pra quem tem conta; o Supabase concede execute ao anon por padrao
revoke execute on function public.termo_daily_hint(integer, text, integer) from anon;
revoke execute on function public.termo_spend_hint() from anon;
revoke execute on function public.buy_streak_shield() from anon;
