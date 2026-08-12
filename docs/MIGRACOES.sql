-- ============================================================================
-- MIGRAÇÕES — Site CAV
-- ----------------------------------------------------------------------------
-- Ver docs/PLANO-DE-AJUSTES.md para o contexto de cada decisão (D*) e
-- problema (P*) citado nos comentários.
--
-- REGRAS:
--   • Cada bloco é de uma FASE do plano.
--   • Nada é aplicado até estar revisado e liberado.
--   • Todo bloco é idempotente — rodar duas vezes não quebra.
--   • Ao final de cada bloco há o ROLLBACK correspondente, comentado.
--
-- HISTÓRICO DE APLICAÇÃO
--   Fase 1 .... [x] aplicada e verificada em 12/08/2026
--   Fase 2 .... [x] aplicada e verificada em 12/08/2026
--   Limpeza ... [x] `drop column descricao` aplicado em 12/08/2026
--   Fase 1.5 .. [x] constraint dos 30 caracteres validada em 12/08/2026
--   Fase 3 .... [x] aplicada e verificada em 12/08/2026 (blocos 3.1-3.8 e 3.9)
--   Fase 5 .... [x] aplicada e verificada em 12/08/2026
--   Fase 8 .... [ ] nao aplicada — aguardando revisao
--
-- COMO RODAR: um bloco de cada vez (FASE 1, depois FASE 2), conferindo o
-- resultado entre eles. O editor do Supabase executa a selecao inteira como
-- uma transacao — um comando que falha desfaz todos os anteriores.
-- ============================================================================


-- ============================================================================
-- VERIFICAÇÕES (não são migração — rodar e me mandar o resultado)
-- ============================================================================

-- V1 — confirma que a Fase 1 entrou por inteiro
-- select column_name
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'aulas'
--    and column_name in ('conteudo_ministrado','chamada_fechada_em','descricao');
-- Esperado: conteudo_ministrado e chamada_fechada_em presentes, descricao AUSENTE.

-- V2 — regra de exclusão de TODAS as FKs do schema (P18/P19)
-- select tc.table_name, tc.constraint_name, kcu.column_name,
--        ccu.table_name as referencia, rc.delete_rule
--   from information_schema.table_constraints tc
--   join information_schema.key_column_usage kcu
--     on kcu.constraint_name = tc.constraint_name
--   join information_schema.constraint_column_usage ccu
--     on ccu.constraint_name = tc.constraint_name
--   join information_schema.referential_constraints rc
--     on rc.constraint_name = tc.constraint_name
--  where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
--  order by tc.table_name, tc.constraint_name;
-- Interessa em especial: professores.id -> auth.users.id

-- V3 — DIAGNOSTICO: o que de fato entrou no banco
-- Le direto do catalogo, sem passar pelo cache do PostgREST.
-- select table_name, column_name
--   from information_schema.columns
--  where table_schema = 'public'
--    and ( (table_name = 'aulas'       and column_name in ('conteudo_ministrado','chamada_fechada_em','descricao'))
--       or (table_name = 'professores' and column_name in ('user_id','ativo'))
--       or (table_name = 'disciplinas' and column_name  = 'ativa') )
--  order by table_name, column_name;
--
-- Esperado depois das fases 1 e 2:
--   aulas.chamada_fechada_em, aulas.conteudo_ministrado,
--   disciplinas.ativa, professores.ativo, professores.user_id
--   e NENHUMA linha de aulas.descricao

-- V4 — quem depende de aulas.descricao (se o DROP COLUMN falhar)
-- select dependent_ns.nspname as schema, dependent_view.relname as objeto
--   from pg_depend d
--   join pg_rewrite r          on r.oid = d.objid
--   join pg_class dependent_view on dependent_view.oid = r.ev_class
--   join pg_namespace dependent_ns on dependent_ns.oid = dependent_view.relnamespace
--   join pg_class source_table on source_table.oid = d.refobjid
--   join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
--  where source_table.relname = 'aulas' and a.attname = 'descricao';


-- ============================================================================
-- FASE 1 — Integridade da chamada e diário de sala
-- Cobre: P2, P3, P4 (código), D4, D5, D6, D7, D22
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Campos novos em `aulas`
-- ----------------------------------------------------------------------------
alter table public.aulas
  add column if not exists conteudo_ministrado text,
  add column if not exists chamada_fechada_em  timestamptz;

-- NOTA: o `drop column descricao` (D32) FOI MOVIDO para a fase de limpezas.
-- Motivo: o editor SQL roda o bloco como uma transacao unica. Se o DROP falhar
-- (por exemplo, se alguma policy ou view depender da coluna), tudo que vem
-- depois e desfeito. Apagar a coluna e cosmetico e nao pode bloquear o que e
-- funcional. Ver bloco LIMPEZAS no fim do arquivo.

-- Documenta o significado de cada coluna. `chamada_aberta` tem o nome
-- invertido (P6) e só será renomeada na fase 10, para não quebrar o app agora.
comment on column public.aulas.conteudo_ministrado is
  'Conteudo efetivamente ministrado. Preenchido SO pelo professor ao fechar a chamada. Minimo 30 caracteres (D4).';
comment on column public.aulas.data_aula is
  'Data PLANEJADA pelo cronograma. NUNCA sobrescrita ao fechar a chamada (D7).';
comment on column public.aulas.chamada_fechada_em is
  'Data/hora em que a chamada foi efetivamente fechada (D7).';
comment on column public.aulas.chamada_aberta is
  'ATENCAO: true = chamada FINALIZADA. Nome invertido, legado (P6).';


-- ----------------------------------------------------------------------------
-- 1.2 D6 — chamada fechada é definitiva: presença não muda mais
-- ----------------------------------------------------------------------------
-- Vale para INSERT, UPDATE e DELETE. A UI já impede, mas a trava tem de estar
-- no banco: o app do professor fala com o Postgres direto pela chave anon.
create or replace function public.bloqueia_presenca_apos_fechamento()
returns trigger
language plpgsql
as $$
declare
  v_fechada boolean;
begin
  select a.chamada_aberta
    into v_fechada
    from public.aulas a
   where a.id = coalesce(new.aula_id, old.aula_id);

  if coalesce(v_fechada, false) then
    raise exception
      'Chamada ja finalizada. As presencas desta aula nao podem mais ser alteradas.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_presenca_apos_fechamento on public.presencas;
create trigger trg_presenca_apos_fechamento
  before insert or update or delete on public.presencas
  for each row
  execute function public.bloqueia_presenca_apos_fechamento();


-- ----------------------------------------------------------------------------
-- 1.3 D6 — chamada finalizada não reabre
-- ----------------------------------------------------------------------------
create or replace function public.bloqueia_reabertura_chamada()
returns trigger
language plpgsql
as $$
begin
  if old.chamada_aberta and not new.chamada_aberta then
    raise exception 'Chamada finalizada nao pode ser reaberta.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reabertura_chamada on public.aulas;
create trigger trg_reabertura_chamada
  before update on public.aulas
  for each row
  execute function public.bloqueia_reabertura_chamada();


-- ----------------------------------------------------------------------------
-- 1.4 D4 — conteúdo obrigatório ao fechar
-- ----------------------------------------------------------------------------
-- Garante no banco o que a UI já valida: não dá para marcar a chamada como
-- finalizada sem um conteudo_ministrado de pelo menos 30 caracteres.
alter table public.aulas
  drop constraint if exists aulas_conteudo_obrigatorio_ao_fechar;

alter table public.aulas
  add constraint aulas_conteudo_obrigatorio_ao_fechar
  check (
    chamada_aberta = false
    or char_length(btrim(coalesce(conteudo_ministrado, ''))) >= 30
  )
  not valid;   -- `not valid` = nao rejeita as aulas ja fechadas antes desta regra

-- ----------------------------------------------------------------------------
-- 1.5 Opcional — endurecer a regra depois de limpar os dados de teste
-- ----------------------------------------------------------------------------
-- A constraint 1.4 entrou como `not valid`: vale para novas gravacoes, mas nao
-- rejeita aulas que ja estavam fechadas sem conteudo. Para exigir tambem do
-- historico, veja primeiro quantas violam:
--
--   select count(*) from public.aulas
--    where chamada_aberta
--      and char_length(btrim(coalesce(conteudo_ministrado,''))) < 30;
--
-- Se for zero (ou depois de limpar os testes), rode:
--
--   alter table public.aulas validate constraint aulas_conteudo_obrigatorio_ao_fechar;

-- ----------------------------------------------------------------------------
-- ROLLBACK DA FASE 1 (deixar comentado)
-- ----------------------------------------------------------------------------
-- drop trigger if exists trg_presenca_apos_fechamento on public.presencas;
-- drop trigger if exists trg_reabertura_chamada       on public.aulas;
-- drop function if exists public.bloqueia_presenca_apos_fechamento();
-- drop function if exists public.bloqueia_reabertura_chamada();
-- alter table public.aulas drop constraint if exists aulas_conteudo_obrigatorio_ao_fechar;
-- alter table public.aulas drop column if exists conteudo_ministrado;
-- alter table public.aulas drop column if exists chamada_fechada_em;
-- alter table public.aulas add column if not exists descricao text;  -- conteudo original perdido


-- ============================================================================
-- FASE 2 — Professor é regente, não dono
-- Cobre: P18, P19 (secao 6-B do plano). Aprovada em N14.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Separar o registro do professor do login dele
-- ----------------------------------------------------------------------------
-- Hoje `professores.id` E o `auth.users.id`: apagar o login apaga o professor
-- e, por tabela, a autoria das aulas. Passamos a ter `user_id` opcional.
--
-- IMPORTANTE: `professores.id` mantem os MESMOS valores. Assim nenhuma linha de
-- `aulas.professor_id` precisa ser reescrita — so deixa de estar amarrada ao
-- ciclo de vida da credencial.
alter table public.professores
  add column if not exists user_id uuid,
  add column if not exists ativo   boolean not null default true;

update public.professores set user_id = id where user_id is null;

-- Solta o id do auth.users e prende o user_id no lugar.
-- Nao assumimos o nome da constraint: descobrimos qual FK existe sobre
-- professores(id) e apagamos essa. Se o nome fosse outro, um `drop constraint
-- if exists` nomeado nao faria nada — em silencio — e o id continuaria preso
-- ao auth.users, quebrando todo professor novo com id proprio.
do $$
declare
  r record;
begin
  for r in
    select tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on  kcu.constraint_name = tc.constraint_name
        and kcu.table_schema    = tc.table_schema
     where tc.table_schema    = 'public'
       and tc.table_name      = 'professores'
       and tc.constraint_type = 'FOREIGN KEY'
       and kcu.column_name    = 'id'
  loop
    execute format('alter table public.professores drop constraint %I', r.constraint_name);
    raise notice 'FK removida de professores(id): %', r.constraint_name;
  end loop;
end $$;

alter table public.professores drop constraint if exists professores_user_id_fkey;

create unique index if not exists professores_user_id_key
  on public.professores(user_id);

alter table public.professores
  add constraint professores_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Professores novos passam a gerar id proprio
alter table public.professores alter column id set default gen_random_uuid();

comment on column public.professores.user_id is
  'Login do professor. NULL = sem acesso (saiu do edital), mas o historico permanece.';
comment on column public.professores.ativo is
  'false = nao esta lecionando. Nunca apagar professor com historico — desativar.';


-- ----------------------------------------------------------------------------
-- 2.2 is_admin() passa a olhar user_id
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null
     and not exists (
       select 1 from public.professores p where p.user_id = auth.uid()
     );
$$;


-- ----------------------------------------------------------------------------
-- 2.3 Regras de exclusão (P18 / P19)
-- ----------------------------------------------------------------------------
-- disciplina apagada -> aulas vao junto (em vez de virarem orfas).
-- A trava 2.5 impede que isso aconteca quando ha chamada fechada.
alter table public.aulas drop constraint if exists aulas_disciplina_id_fkey;
alter table public.aulas
  add constraint aulas_disciplina_id_fkey
  foreign key (disciplina_id) references public.disciplinas(id) on delete cascade;

-- professor com aula atribuida nao pode ser apagado. Para remove-lo:
-- 1) reatribuir/desatribuir as aulas ainda abertas; 2) desativar (ativo=false).
alter table public.aulas drop constraint if exists aulas_professor_id_fkey;
alter table public.aulas
  add constraint aulas_professor_id_fkey
  foreign key (professor_id) references public.professores(id) on delete restrict;


-- ----------------------------------------------------------------------------
-- 2.4 Aula fechada nunca troca de professor
-- ----------------------------------------------------------------------------
-- Sem isto, trocar o regente de uma disciplina reescreve a autoria do diario
-- de sala das aulas ja dadas.
create or replace function public.bloqueia_troca_professor_aula_fechada()
returns trigger
language plpgsql
as $$
begin
  if old.chamada_aberta
     and new.professor_id is distinct from old.professor_id then
    raise exception
      'Aula ja fechada: o professor responsavel nao pode ser alterado.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_troca_professor_aula_fechada on public.aulas;
create trigger trg_troca_professor_aula_fechada
  before update on public.aulas
  for each row
  execute function public.bloqueia_troca_professor_aula_fechada();


-- ----------------------------------------------------------------------------
-- 2.5 Disciplina com histórico não se apaga — desativa
-- ----------------------------------------------------------------------------
alter table public.disciplinas
  add column if not exists ativa boolean not null default true;

comment on column public.disciplinas.ativa is
  'false = fora da grade. Disciplina com chamada fechada nunca e apagada.';

create or replace function public.bloqueia_exclusao_disciplina_com_historico()
returns trigger
language plpgsql
as $$
declare
  v_fechadas integer;
begin
  select count(*) into v_fechadas
    from public.aulas a
   where a.disciplina_id = old.id
     and a.chamada_aberta;

  if v_fechadas > 0 then
    raise exception
      'Esta disciplina tem % aula(s) com chamada fechada. Desative em vez de excluir.', v_fechadas
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_exclusao_disciplina on public.disciplinas;
create trigger trg_exclusao_disciplina
  before delete on public.disciplinas
  for each row
  execute function public.bloqueia_exclusao_disciplina_com_historico();


-- ----------------------------------------------------------------------------
-- ROLLBACK DA FASE 2 (deixar comentado)
-- ----------------------------------------------------------------------------
-- drop trigger if exists trg_troca_professor_aula_fechada on public.aulas;
-- drop trigger if exists trg_exclusao_disciplina          on public.disciplinas;
-- drop function if exists public.bloqueia_troca_professor_aula_fechada();
-- drop function if exists public.bloqueia_exclusao_disciplina_com_historico();
-- alter table public.disciplinas drop column if exists ativa;
-- alter table public.aulas drop constraint if exists aulas_disciplina_id_fkey;
-- alter table public.aulas add constraint aulas_disciplina_id_fkey
--   foreign key (disciplina_id) references public.disciplinas(id) on delete set null;
-- alter table public.aulas drop constraint if exists aulas_professor_id_fkey;
-- alter table public.aulas add constraint aulas_professor_id_fkey
--   foreign key (professor_id) references public.professores(id) on delete set null;
-- alter table public.professores drop constraint if exists professores_user_id_fkey;
-- drop index if exists public.professores_user_id_key;
-- alter table public.professores drop column if exists user_id;
-- alter table public.professores drop column if exists ativo;


-- ============================================================================
-- FASE 3 — RLS: admin e professor deixam de ser a mesma coisa
-- Cobre: P7. Depende da fase 2 (is_admin() usa professores.user_id).
-- ============================================================================
--
-- PROBLEMA: toda policy hoje usa `authenticated`, e professor E um usuario
-- autenticado. Como a chave anon e publica (vai no bundle do navegador), um
-- professor logado consegue ler e alterar TODOS os alunos, presencas e todo o
-- conteudo do site — basta chamar a API direto, sem passar pela tela.
--
-- MODELO ALVO:
--   • admin      -> acesso total (is_admin())
--   • professor  -> so o que e dele: suas aulas, as turmas dessas aulas,
--                   os alunos dessas turmas e as presencas dessas aulas
--   • anonimo    -> nada de academico; so o conteudo publico do site

-- ----------------------------------------------------------------------------
-- 3.1 Funções auxiliares
-- ----------------------------------------------------------------------------
-- Todas SECURITY DEFINER: rodam ignorando RLS. Sem isso, uma policy de `alunos`
-- que consulta `aulas` dispararia a RLS de `aulas` a cada linha — lento e
-- propenso a recursao. STABLE permite ao Postgres reaproveitar o resultado
-- dentro da mesma consulta.

create or replace function public.professor_atual()
returns uuid language sql security definer stable
set search_path = public as $$
  select p.id
    from public.professores p
   where p.user_id = auth.uid()
     and p.ativo
   limit 1;
$$;

create or replace function public.professor_leciona_turma(p_turma uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.aulas a
     where a.turma_id = p_turma
       and a.professor_id = public.professor_atual()
  );
$$;

create or replace function public.professor_leciona_disciplina(p_disciplina uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.aulas a
     where a.disciplina_id = p_disciplina
       and a.professor_id = public.professor_atual()
  );
$$;

create or replace function public.professor_dono_da_aula(p_aula uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.aulas a
     where a.id = p_aula
       and a.professor_id = public.professor_atual()
  );
$$;

create or replace function public.aula_ainda_aberta(p_aula uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.aulas a
     where a.id = p_aula
       and a.chamada_aberta = false
  );
$$;


-- ----------------------------------------------------------------------------
-- 3.2 Índices de apoio
-- ----------------------------------------------------------------------------
-- As policies filtram por estas colunas a cada linha avaliada.
create index if not exists idx_aulas_professor    on public.aulas(professor_id);
create index if not exists idx_aulas_turma        on public.aulas(turma_id);
create index if not exists idx_aulas_disciplina   on public.aulas(disciplina_id);
create index if not exists idx_alunos_turma       on public.alunos(turma_id);
create index if not exists idx_professores_user   on public.professores(user_id);


-- ----------------------------------------------------------------------------
-- 3.3 Remove as policies permissivas antigas
-- ----------------------------------------------------------------------------
drop policy if exists "Admin acesso total alunos"           on public.alunos;
drop policy if exists "Admin acesso total aulas"            on public.aulas;
drop policy if exists "Admin acesso total disciplinas"      on public.disciplinas;
drop policy if exists "Admin acesso total presencas"        on public.presencas;
drop policy if exists "Admin acesso total professores"      on public.professores;
drop policy if exists "Admin acesso total professor_turmas" on public.professor_turmas;
drop policy if exists "Admin acesso total turmas"           on public.turmas;


-- ----------------------------------------------------------------------------
-- 3.4 professores
-- ----------------------------------------------------------------------------
create policy professores_admin on public.professores
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- O professor enxerga apenas a propria linha
create policy professores_leitura_propria on public.professores
  for select to authenticated
  using (user_id = auth.uid());

-- Necessario para marcar `senha_alterada` no primeiro acesso.
-- O trigger 3.5 impede que ele altere qualquer outro campo.
create policy professores_update_propria on public.professores
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 3.5 O professor so pode marcar a propria troca de senha
-- ----------------------------------------------------------------------------
-- RLS controla QUAIS LINHAS, nao QUAIS COLUNAS. Sem esta trava, o professor
-- poderia reativar a si mesmo (ativo=true) ou trocar o proprio nome/e-mail.
create or replace function public.professor_so_altera_senha_alterada()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.id      is distinct from old.id
  or new.user_id is distinct from old.user_id
  or new.nome    is distinct from old.nome
  or new.email   is distinct from old.email
  or new.ativo   is distinct from old.ativo then
    raise exception 'Professor so pode registrar a propria troca de senha.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_professor_so_altera_senha on public.professores;
create trigger trg_professor_so_altera_senha
  before update on public.professores
  for each row execute function public.professor_so_altera_senha_alterada();


-- ----------------------------------------------------------------------------
-- 3.6 aulas
-- ----------------------------------------------------------------------------
create policy aulas_admin on public.aulas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy aulas_professor_leitura on public.aulas
  for select to authenticated
  using (professor_id = public.professor_atual());

-- Fechar a chamada. `using` exige que a aula esteja aberta — aula fechada nao
-- pode nem ser alvo de UPDATE pelo professor.
create policy aulas_professor_fecha on public.aulas
  for update to authenticated
  using (professor_id = public.professor_atual() and chamada_aberta = false)
  with check (professor_id = public.professor_atual());


-- ----------------------------------------------------------------------------
-- 3.7 O professor so pode fechar a chamada e registrar o conteudo
-- ----------------------------------------------------------------------------
create or replace function public.professor_so_fecha_chamada()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.id            is distinct from old.id
  or new.turma_id      is distinct from old.turma_id
  or new.disciplina_id is distinct from old.disciplina_id
  or new.professor_id  is distinct from old.professor_id
  or new.numero        is distinct from old.numero
  or new.semana        is distinct from old.semana
  or new.data_aula     is distinct from old.data_aula then
    raise exception 'Professor so pode fechar a chamada e registrar o conteudo da aula.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_professor_so_fecha_chamada on public.aulas;
create trigger trg_professor_so_fecha_chamada
  before update on public.aulas
  for each row execute function public.professor_so_fecha_chamada();


-- ----------------------------------------------------------------------------
-- 3.8 turmas, disciplinas, alunos, presencas
-- ----------------------------------------------------------------------------
create policy turmas_admin on public.turmas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy turmas_professor_leitura on public.turmas
  for select to authenticated
  using (public.professor_leciona_turma(id));

create policy disciplinas_admin on public.disciplinas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy disciplinas_professor_leitura on public.disciplinas
  for select to authenticated
  using (public.professor_leciona_disciplina(id));

create policy alunos_admin on public.alunos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- O professor ve apenas os alunos das turmas em que ele tem aula
create policy alunos_professor_leitura on public.alunos
  for select to authenticated
  using (turma_id is not null and public.professor_leciona_turma(turma_id));

create policy presencas_admin on public.presencas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy presencas_professor_leitura on public.presencas
  for select to authenticated
  using (public.professor_dono_da_aula(aula_id));

create policy presencas_professor_insere on public.presencas
  for insert to authenticated
  with check (public.professor_dono_da_aula(aula_id) and public.aula_ainda_aberta(aula_id));

create policy presencas_professor_atualiza on public.presencas
  for update to authenticated
  using (public.professor_dono_da_aula(aula_id) and public.aula_ainda_aberta(aula_id))
  with check (public.professor_dono_da_aula(aula_id));

-- Tabela sem uso no codigo: fica so para admin ate decidirmos seu destino (P12)
create policy professor_turmas_admin on public.professor_turmas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ----------------------------------------------------------------------------
-- 3.9 Conteúdo do site: escrita passa a exigir admin
-- ----------------------------------------------------------------------------
-- As policies de LEITURA publica permanecem intactas — o site nao muda.
-- Aqui so trocamos "qualquer autenticado escreve" por "so admin escreve",
-- senao um professor logado consegue apagar banners e alterar o processo
-- seletivo pela API.
drop policy if exists "Authenticated write access"                                on public.arte_educadores;
drop policy if exists "Usuários autenticados podem atualizar arte educadores"     on public.arte_educadores;
drop policy if exists "Usuários autenticados podem deletar arte educadores"       on public.arte_educadores;
drop policy if exists "Usuários autenticados podem inserir arte educadores"       on public.arte_educadores;
drop policy if exists "Allow authenticated users to manage banners"               on public.banners;
drop policy if exists "Auth delete cronogramas"                                   on public.cronogramas;
drop policy if exists "Auth insert cronogramas"                                   on public.cronogramas;
drop policy if exists "Auth update cronogramas"                                   on public.cronogramas;
drop policy if exists "Allow authenticated users full access to downloads"        on public.downloads;
drop policy if exists "Allow authenticated users to manage institutional projects" on public.institutional_projects;
drop policy if exists "Authenticated write access"                                on public.oficinas;
drop policy if exists "photo_gallery_escrita_autenticada"                         on public.photo_gallery;
drop policy if exists "process_data_escrita_autenticada"                          on public.process_data;
drop policy if exists "Allow authenticated users to manage projects"              on public.projects;
drop policy if exists "Allow admin full access to bibliographies"                 on public.reference_bibliographies;
drop policy if exists "Allow admin full access to reference videos"               on public.reference_videos;
drop policy if exists "Admin atualizar resultados"                                on public.resultados_processo;
drop policy if exists "Admin deletar resultados"                                  on public.resultados_processo;
drop policy if exists "Admin inserir resultados"                                  on public.resultados_processo;

do $$
declare
  t text;
begin
  foreach t in array array[
    'arte_educadores','banners','cronogramas','downloads','institutional_projects',
    'oficinas','photo_gallery','process_data','projects',
    'reference_bibliographies','reference_videos','resultados_processo'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_escrita_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_escrita_admin', t
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- ROLLBACK DA FASE 3 (deixar comentado)
-- ----------------------------------------------------------------------------
-- Devolve o acesso total a qualquer autenticado — so em emergencia.
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['alunos','aulas','disciplinas','presencas','professores','professor_turmas','turmas'] loop
--     execute format('drop policy if exists %I on public.%I', t || '_admin', t);
--     execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'Admin acesso total ' || t, t);
--   end loop;
-- end $$;
-- drop trigger if exists trg_professor_so_altera_senha  on public.professores;
-- drop trigger if exists trg_professor_so_fecha_chamada on public.aulas;


-- ============================================================================
-- FASE 5 — Gabarito do processo seletivo
-- Cobre: pedido 10, D31. Depende da fase 3 (usa is_admin()).
-- ============================================================================
--
-- O gabarito aparece no topo de /area-do-candidato quando a pagina esta em
-- modo "resultados" — o mesmo botao que o coordenador ja usa para virar a
-- pagina de Processo Seletivo para Resultados.
--
-- `resposta` e TEXTO, nao uma letra: a maioria e "C", mas algumas questoes
-- podem ter resposta por extenso (D31).
-- `curso` e opcional: em branco vale para Animacao e Cine/TV (N12).

create table if not exists public.gabaritos (
  id         uuid primary key default gen_random_uuid(),
  semestre   text not null,
  curso      text,
  titulo     text,
  observacao text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gabarito_itens (
  id          uuid primary key default gen_random_uuid(),
  gabarito_id uuid not null references public.gabaritos(id) on delete cascade,
  numero      integer not null check (numero > 0),
  resposta    text not null,
  constraint gabarito_itens_unicos unique (gabarito_id, numero)
);

create index if not exists idx_gabarito_itens_gabarito
  on public.gabarito_itens(gabarito_id);

comment on column public.gabaritos.curso is
  'NULL = vale para todos os cursos. Preenchido = so aquele curso.';
comment on column public.gabarito_itens.resposta is
  'Texto livre: normalmente uma letra, mas aceita resposta por extenso.';

-- ----------------------------------------------------------------------------
-- RLS — leitura publica so do que esta ativo; escrita so admin
-- ----------------------------------------------------------------------------
alter table public.gabaritos      enable row level security;
alter table public.gabarito_itens enable row level security;

drop policy if exists gabaritos_leitura_publica on public.gabaritos;
create policy gabaritos_leitura_publica on public.gabaritos
  for select to public using (is_active);

drop policy if exists gabaritos_admin on public.gabaritos;
create policy gabaritos_admin on public.gabaritos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Item de gabarito em rascunho (is_active = false) nao pode vazar
drop policy if exists gabarito_itens_leitura_publica on public.gabarito_itens;
create policy gabarito_itens_leitura_publica on public.gabarito_itens
  for select to public using (
    exists (
      select 1 from public.gabaritos g
       where g.id = gabarito_id and g.is_active
    )
  );

drop policy if exists gabarito_itens_admin on public.gabarito_itens;
create policy gabarito_itens_admin on public.gabarito_itens
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- ROLLBACK DA FASE 5 (deixar comentado)
-- ----------------------------------------------------------------------------
-- drop table if exists public.gabarito_itens;
-- drop table if exists public.gabaritos;


-- ============================================================================
-- FASE 8 — Grupos, notas e banca
-- Cobre: D15, D16, D18, D19, D20, D21. Depende das fases 2 e 3.
-- ============================================================================
--
-- MODELO
--
--   nota do professor .... por (aluno, disciplina, turma). Mesma chave que as
--                          aulas ja usam. Cada professor lanca a da SUA
--                          disciplina, entao o aluno tem varias por semestre.
--
--   nota da banca ........ do GRUPO, nao do aluno. Grupo e uma equipe dentro
--                          da turma (ex.: 5 alunos que fazem um filme juntos)
--                          e todos os integrantes recebem a mesma nota.
--
--   nota final ........... NAO e armazenada. E (professor + banca) / 2,
--                          calculada na view. Guardar o resultado criaria um
--                          valor que envelhece sozinho quando qualquer uma das
--                          duas partes mudar.
--
-- Por que o grupo e chaveado por `semestre_do_curso` (1..3) e nao pelo
-- semestre do calendario: a turma atravessa tres semestres e forma grupos
-- novos em cada um. `semestre_do_curso` e a mesma chave que `disciplinas` usa,
-- entao juntar nota do professor com nota da banca fica direto.


-- ----------------------------------------------------------------------------
-- 8.1 Grupos da banca
-- ----------------------------------------------------------------------------
create table if not exists public.grupos (
  id                uuid primary key default gen_random_uuid(),
  turma_id          uuid not null references public.turmas(id) on delete cascade,
  semestre_do_curso integer not null check (semestre_do_curso between 1 and 3),
  nome              text not null,
  nota_banca        numeric(4,2) check (nota_banca >= 0 and nota_banca <= 10),
  observacao        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint grupos_nome_unico_na_turma unique (turma_id, semestre_do_curso, nome)
);

comment on table  public.grupos is
  'Equipe de alunos dentro de uma turma, num semestre do curso. A banca avalia o grupo.';
comment on column public.grupos.nota_banca is
  'Lancada pelo coordenador. NULL = banca ainda nao avaliou. Vale para todos os integrantes (D19/D21).';

create index if not exists idx_grupos_turma on public.grupos(turma_id, semestre_do_curso);


-- ----------------------------------------------------------------------------
-- 8.2 Integrantes do grupo
-- ----------------------------------------------------------------------------
create table if not exists public.grupo_alunos (
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  primary key (grupo_id, aluno_id)
);

create index if not exists idx_grupo_alunos_aluno on public.grupo_alunos(aluno_id);

-- Um aluno so pode estar em UM grupo por turma/semestre. A chave primaria
-- acima impede repetir no mesmo grupo, mas nao impede entrar em dois grupos
-- diferentes do mesmo semestre — o que tornaria a nota da banca ambigua.
create or replace function public.impede_aluno_em_dois_grupos()
returns trigger
language plpgsql
as $$
declare
  v_turma    uuid;
  v_semestre integer;
  v_conflito text;
begin
  select g.turma_id, g.semestre_do_curso
    into v_turma, v_semestre
    from public.grupos g
   where g.id = new.grupo_id;

  select g.nome into v_conflito
    from public.grupo_alunos ga
    join public.grupos g on g.id = ga.grupo_id
   where ga.aluno_id = new.aluno_id
     and ga.grupo_id <> new.grupo_id
     and g.turma_id = v_turma
     and g.semestre_do_curso = v_semestre
   limit 1;

  if v_conflito is not null then
    raise exception
      'Este aluno ja esta no grupo "%" nesta turma e semestre. Remova-o de la antes.', v_conflito
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_aluno_em_um_grupo on public.grupo_alunos;
create trigger trg_aluno_em_um_grupo
  before insert or update on public.grupo_alunos
  for each row execute function public.impede_aluno_em_dois_grupos();


-- ----------------------------------------------------------------------------
-- 8.3 Nota do professor, por disciplina
-- ----------------------------------------------------------------------------
create table if not exists public.notas_disciplina (
  id            uuid primary key default gen_random_uuid(),
  aluno_id      uuid not null references public.alunos(id)      on delete cascade,
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  turma_id      uuid not null references public.turmas(id)      on delete cascade,
  nota          numeric(4,2) not null check (nota >= 0 and nota <= 10),
  observacao    text,
  -- Quem lancou. Fica NULL se o professor for removido, sem apagar a nota.
  lancada_por   uuid references public.professores(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint notas_disciplina_unica unique (aluno_id, disciplina_id, turma_id)
);

comment on table public.notas_disciplina is
  'Nota que o professor da disciplina atribui ao aluno. Um aluno tem uma por disciplina cursada (D18).';

create index if not exists idx_notas_aluno      on public.notas_disciplina(aluno_id);
create index if not exists idx_notas_disciplina on public.notas_disciplina(disciplina_id, turma_id);


-- ----------------------------------------------------------------------------
-- 8.4 Quem leciona o que — para o RLS das notas
-- ----------------------------------------------------------------------------
-- As funcoes da fase 3 respondem "esta aula e minha?". Aqui a pergunta e
-- "eu leciono esta disciplina NESTA turma?", que e o escopo da nota.
create or replace function public.professor_leciona_disciplina_na_turma(
  p_disciplina uuid,
  p_turma uuid
)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.aulas a
     where a.disciplina_id = p_disciplina
       and a.turma_id      = p_turma
       and a.professor_id  = public.professor_atual()
  );
$$;


-- ----------------------------------------------------------------------------
-- 8.5 RLS
-- ----------------------------------------------------------------------------
alter table public.grupos           enable row level security;
alter table public.grupo_alunos     enable row level security;
alter table public.notas_disciplina enable row level security;

-- Grupos e nota da banca: so o coordenador.
drop policy if exists grupos_admin on public.grupos;
create policy grupos_admin on public.grupos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists grupo_alunos_admin on public.grupo_alunos;
create policy grupo_alunos_admin on public.grupo_alunos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notas: coordenador ve tudo; professor so a disciplina que ele leciona
-- naquela turma.
drop policy if exists notas_admin on public.notas_disciplina;
create policy notas_admin on public.notas_disciplina
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists notas_professor_leitura on public.notas_disciplina;
create policy notas_professor_leitura on public.notas_disciplina
  for select to authenticated
  using (public.professor_leciona_disciplina_na_turma(disciplina_id, turma_id));

drop policy if exists notas_professor_lanca on public.notas_disciplina;
create policy notas_professor_lanca on public.notas_disciplina
  for insert to authenticated
  with check (public.professor_leciona_disciplina_na_turma(disciplina_id, turma_id));

drop policy if exists notas_professor_corrige on public.notas_disciplina;
create policy notas_professor_corrige on public.notas_disciplina
  for update to authenticated
  using (public.professor_leciona_disciplina_na_turma(disciplina_id, turma_id))
  with check (public.professor_leciona_disciplina_na_turma(disciplina_id, turma_id));


-- ----------------------------------------------------------------------------
-- 8.6 View de desempenho — nota final e presenca calculadas
-- ----------------------------------------------------------------------------
-- `security_invoker = true` faz o RLS das tabelas de baixo valer para quem
-- consulta. Sem isso a view rodaria com os privilegios do dono e vazaria os
-- dados de todos os alunos para qualquer professor.
--
-- Tudo que pode faltar vira NULL em vez de zero: aluno sem banca, disciplina
-- sem aula dada. Zero seria uma afirmacao errada — "tirou zero", "faltou a
-- tudo" — quando o correto e "ainda nao se sabe".
drop view if exists public.vw_desempenho_aluno;
create view public.vw_desempenho_aluno
with (security_invoker = true) as
select
  n.aluno_id,
  al.nome                       as aluno,
  n.turma_id,
  n.disciplina_id,
  d.nome                        as disciplina,
  d.semestre_do_curso,
  n.nota                        as nota_professor,
  g.nota_banca,
  case
    when g.nota_banca is null then null
    else round((n.nota + g.nota_banca) / 2, 2)
  end                           as nota_final,
  pres.aulas_dadas,
  pres.presencas,
  case
    when pres.aulas_dadas is null or pres.aulas_dadas = 0 then null
    else round(pres.presencas * 100.0 / pres.aulas_dadas, 1)
  end                           as percentual_presenca
from public.notas_disciplina n
join public.alunos      al on al.id = n.aluno_id
join public.disciplinas d  on d.id  = n.disciplina_id
left join public.grupos g
  on  g.turma_id          = n.turma_id
  and g.semestre_do_curso = d.semestre_do_curso
  and exists (
    select 1 from public.grupo_alunos ga
     where ga.grupo_id = g.id and ga.aluno_id = n.aluno_id
  )
left join lateral (
  select
    count(*)                                          as aulas_dadas,
    count(*) filter (where p.presente)                as presencas
  from public.aulas a
  left join public.presencas p
    on p.aula_id = a.id and p.aluno_id = n.aluno_id
  where a.turma_id      = n.turma_id
    and a.disciplina_id = n.disciplina_id
    and a.chamada_aberta          -- so aula efetivamente dada (D16)
) pres on true;

comment on view public.vw_desempenho_aluno is
  'Nota final e frequencia por aluno/disciplina. NULL significa indeterminado, nunca zero. A regra de aprovacao (>=6 e >=70%) fica na aplicacao, nao aqui, para poder mudar sem migracao.';


-- ----------------------------------------------------------------------------
-- ROLLBACK DA FASE 8 (deixar comentado)
-- ----------------------------------------------------------------------------
-- drop view  if exists public.vw_desempenho_aluno;
-- drop table if exists public.notas_disciplina;
-- drop trigger if exists trg_aluno_em_um_grupo on public.grupo_alunos;
-- drop function if exists public.impede_aluno_em_dois_grupos();
-- drop table if exists public.grupo_alunos;
-- drop table if exists public.grupos;
-- drop function if exists public.professor_leciona_disciplina_na_turma(uuid, uuid);


-- ============================================================================
-- LIMPEZAS — rodar SEPARADO das fases funcionais
-- ----------------------------------------------------------------------------
-- Rodar cada comando ISOLADAMENTE. Se um falhar, ele nao derruba os outros.
-- ============================================================================

-- D32 / P16 — `descricao` era preenchida pelo coordenador. Como o diario de
-- sala e responsabilidade exclusiva do professor (D5), a coluna ficou sem dono.
-- Seguro apagar: os dados academicos ainda sao de teste (D30).
-- Se falhar por dependencia, rode a V4 acima para descobrir quem depende dela.
--
--   alter table public.aulas drop column if exists descricao;
