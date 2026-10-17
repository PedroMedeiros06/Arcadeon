-- saem Robô, Raposa e Estrela; quem tinha perde, sem reembolso (decisão do usuário em 2026-10-17)

-- quem estava com um dos 3 equipado volta pro padrão
update public.profiles set equipped_avatar_id = null
where equipped_avatar_id in (
  '69185a3c-5e87-4e5a-bcd8-54546f171ee7',
  '81074d70-5255-46af-a64e-bc3033006eb4',
  '6b5ba036-011f-4cae-b1b8-54e31fdbfee2'
);

delete from public.user_avatars
where avatar_id in (
  '69185a3c-5e87-4e5a-bcd8-54546f171ee7',
  '81074d70-5255-46af-a64e-bc3033006eb4',
  '6b5ba036-011f-4cae-b1b8-54e31fdbfee2'
);

delete from public.avatars
where id in (
  '69185a3c-5e87-4e5a-bcd8-54546f171ee7',
  '81074d70-5255-46af-a64e-bc3033006eb4',
  '6b5ba036-011f-4cae-b1b8-54e31fdbfee2'
);
