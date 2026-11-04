-- Letrado: mais palavras-resposta e o Diario sem repetir palavra recente.
-- Antes eram 1110 respostas sorteadas ao acaso todo dia (7 por dia somando os 3 modos), entao quem joga
-- sempre ja conhecia quase todas. Entram 845 palavras comuns (as mesmas acrescentadas em
-- web/public/words5_target.txt) e o sorteio do Diario passa a pular as palavras dos ultimos 180 dias.

insert into public.termo_words (word)
select trim(w) from unnest(string_to_array(replace(
'abade,abafa,abafo,abrem,abres,abria,acabo,acata,aceso,achei,achou,acido,acudo,adega,adoro,adota,afina,agido,ag
ita,aguia,ajude,alamo,alcar,alhos,aliar,aloja,aluga,alugo,ampla,andam,andas,anjos,anoes,anota,antro,anual,apar
a,arame,arcas,arcos,arfar,armas,assei,atras,atriz,aulas,avaro,aveia,avela,bafos,bagos,baias,balao,balde,balsa,
bamba,banca,banco,barca,bardo,bares,barra,batom,bebem,bebia,becos,belas,belga,benta,bicas,bloco,boate,bodas,bo
des,boias,bolar,boldo,bolos,bombo,bonde,borda,borra,bossa,braco,bruma,bucal,bufar,bulbo,bules,burla,buzio,caba
l,cabia,cabos,cacau,cafes,caiam,cajus,calar,caldo,calos,camas,canas,canja,cansa,canse,cante,capas,capuz,cardo,
carne,caros,carpa,casas,casco,caspa,cavas,cegas,cegos,cenas,ceras,cerne,cetim,chale,chame,chamo,chaos,chapa,ch
ega,chego,chiar,chuta,cinta,cisco,clara,clone,clube,cobra,cobre,cocos,combo,comem,comeu,comia,coros,corri,corr
o,corta,corto,cotas,covas,cozer,cuida,cuido,cujos,cunha,curas,curta,curto,damas,datas,dedal,dedos,delas,deles,
demao,desce,dique,disse,ditar,dizem,dizia,dobra,dobro,doces,donas,dores,dormi,dosar,doses,dotar,dotes,duros,ei
xos,elfos,ergue,errar,erros,esqui,estou,euros,exala,exibe,facas,faces,fados,falam,falas,falei,falou,famas,fard
a,farpa,farra,fases,fatia,favas,fazem,fazes,febre,fecha,fecho,feios,femea,fenos,feras,feria,fetos,fiado,fiapo,
fibra,ficam,ficas,ficou,fieis,figos,filas,filme,finos,finta,fisco,fisga,fitas,fobia,focas,fogao,fogem,fogos,fo
ice,foram,forno,fosco,fotos,frade,frevo,frios,fruta,fugia,fumar,fumos,funda,funil,furia,furor,furos,fusos,fuzi
l,galas,galos,ganhe,ganho,ganso,garca,garfo,garra,gasto,gazes,geada,gemas,gemeo,gibis,globo,gnomo,goela,golas,
golfe,gomas,gomos,gongo,gorro,gosta,gotas,grade,grana,graxa,grego,grilo,gripe,grota,gruas,grude,guiar,gumes,he
lio,horas,horta,hotel,iates,idade,imita,irada,irmas,isola,jacas,jarra,jaula,jegue,jogam,jogas,jogos,jogou,joia
s,juiza,julho,junho,juros,labio,lacos,lagos,lajes,lamas,lanca,laque,lares,larga,lasca,latao,latim,lavam,lavar,
lavas,lavei,lavou,leais,lebre,lemos,lenco,lenta,leoes,lerdo,lesma,leste,levas,levei,leves,levou,licor,ligam,li
gas,ligou,limao,limas,lince,lirio,lisas,lista,lixar,lixos,lobas,loira,loiro,lojas,lomba,lonas,longa,lotes,lour
a,lulas,lunar,lutam,lutas,lutei,lutou,luvas,luzes,luzir,macas,madre,magos,maios,malas,malha,malte,mamao,manco,
manda,mando,manta,mapas,mares,matam,matas,matei,mates,matos,matou,mecha,medos,meias,meios,melao,menor,menta,me
nus,mesas,metal,metas,micos,minas,miudo,modas,moela,molas,moles,monto,morda,morei,morna,morno,morou,morre,morr
i,mosca,mosto,motel,motor,mudam,mudas,mudei,mudos,mudou,mulas,mural,murro,nabos,nadam,nadas,nadei,naipe,narra,
nasal,naval,naves,negra,nervo,netos,nevoa,ninar,ninho,noiva,noivo,nojos,nomes,notar,novas,novos,nozes,nucas,nu
los,obeso,obras,ocaso,ocupa,odios,oeste,oleos,olham,olhei,ombro,ondas,opera,orcas,orlas,ossos,ostra,ouros,ovai
s,ovnis,oxido,pagam,pagas,pagos,pagou,palco,palha,palma,pampa,panda,panos,papai,papas,param,paras,parei,pares,
parou,parti,parto,passe,patas,patio,patos,pausa,pavao,pavio,pazes,pecar,pecas,pedal,pegam,pegas,pegou,pelas,pe
les,pelos,pelve,penal,penas,pensa,pente,pequi,peras,perde,perdi,perus,pesca,pesei,pesos,pesou,pezao,piano,pica
r,picos,pilha,pinta,pipas,pirao,pires,pisca,pisei,pisou,pista,placa,pneus,podem,podes,podia,polos,polpa,polvo,
pomba,pombo,ponta,ponte,porao,porco,posar,potes,potro,poupa,praca,prata,pudim,pulam,pulei,pulga,pulou,pulso,pu
nho,punir,puros,quero,quina,quota,rabos,racas,racha,radar,raias,ralos,ramos,rampa,rapto,rasgo,rasos,raspa,rast
o,reais,recuo,redes,regar,remar,retas,reuso,rezas,rifas,rimar,rimas,rindo,rinha,risos,ritos,robos,rodar,rodas,
rodos,rolar,rolha,rolos,rombo,rosas,rosca,rosto,rotas,roubo,rubis,rudes,rugas,rugir,ruins,rumos,russo,sabao,sa
bem,sabes,sacas,sacos,safra,sagui,salas,salsa,santa,sapos,sarna,sauna,seara,secar,secos,sedas,sedes,segui,seio
s,selos,selva,senha,senti,seres,serra,serve,servi,sinos,sobra,socar,socos,sodio,sofas,sofre,sofri,sofro,sogra,
sogro,solar,solda,soldo,solos,somar,somem,somos,sonda,sonha,sopas,sopro,sorri,sorvo,soube,subia,subiu,sucos,su
jar,sujei,sujos,sujou,sumia,sumiu,sumos,super,surdo,surfe,susto,tabua,tabus,tacos,talao,talco,talho,talos,tamp
a,tampo,tanga,tango,tapar,tapas,tarja,tatus,taxas,teias,teimo,telao,telas,telha,temas,temos,tenda,tenho,tenis,
tenor,tensa,tenta,terca,terco,teria,teses,testa,tetos,tiara,tigre,times,tinas,tinta,tipos,tiram,tiras,tirei,ti
rou,titio,tocam,tocas,tocha,tocou,toldo,tolos,tombo,tonel,tonta,tonto,topar,topos,torno,torre,torta,torto,tosa
r,tosse,total,touca,touro,traca,trapo,trava,trens,trevo,treze,trigo,tripa,trono,tubas,tubos,tufao,tumor,tunel,
turba,turno,uivar,uivos,ultra,unhas,untar,urgir,urnas,urubu,usada,usado,usava,usina,usual,utero,vacas,vagao,va
gas,vagem,vagos,vaiar,valas,vales,valsa,vapor,varal,varas,varia,vasos,vazar,veado,veias,velas,vence,venci,vend
a,vende,vendi,veras,veria,vespa,vidas,vidro,vigas,vilas,vindo,vinho,vinil,vinte,viola,viral,viras,virei,virou,
visor,viuva,vivas,vivem,vivia,vivos,voces,votam,votar,votei,votos,votou,vozes,xales,zebra,zelos,zerar,zinco,zo
nas,zonzo',
E'
', ''), ',')) as w
on conflict do nothing;

-- p_exclude: palavras que o sorteio deve evitar. Se sobrar pouca coisa, ignora a lista pra nao travar.
drop function if exists public.termo_pick_words(integer);
create function public.termo_pick_words(p_count integer, p_exclude text[] default '{}')
returns text[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  pool text[];
  len integer;
  chosen text[] := '{}';
  w text;
  skips integer := 0;
begin
  select array_agg(word) into pool from public.termo_words where not (word = any(p_exclude));
  if coalesce(array_length(pool, 1), 0) < p_count * 50 then
    select array_agg(word) into pool from public.termo_words;
  end if;
  len := coalesce(array_length(pool, 1), 0);
  if len < p_count then
    raise exception 'termo_words vazia';
  end if;

  while coalesce(array_length(chosen, 1), 0) < p_count loop
    w := pool[1 + floor(random() * len)::integer];
    continue when w = any(chosen);
    -- valvula de escape: depois de muitas tentativas aceita palavra parecida pra nao travar
    if skips < len * 4 and exists (select 1 from unnest(chosen) as c where public.termo_too_similar(w, c)) then
      skips := skips + 1;
      continue;
    end if;
    chosen := chosen || w;
  end loop;
  return chosen;
end;
$$;

create or replace function public.termo_get_daily_words(p_date date, p_board_count integer)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_words text[];
  v_recent text[];
begin
  select words into v_words from public.termo_daily_words
    where play_date = p_date and board_count = p_board_count;
  if v_words is null then
    -- palavras que ja sairam no Diario (qualquer modo) nos ultimos 180 dias
    select coalesce(array_agg(distinct w), '{}') into v_recent
      from public.termo_daily_words d, unnest(d.words) as w
      where d.play_date > p_date - 180 and d.play_date <= p_date;
    insert into public.termo_daily_words (play_date, board_count, words)
      values (p_date, p_board_count, public.termo_pick_words(p_board_count, v_recent))
      on conflict do nothing;
    select words into v_words from public.termo_daily_words
      where play_date = p_date and board_count = p_board_count;
  end if;
  return v_words;
end;
$$;

revoke execute on function public.termo_pick_words(integer, text[]) from public, anon, authenticated;
revoke execute on function public.termo_get_daily_words(date, integer) from public, anon, authenticated;
