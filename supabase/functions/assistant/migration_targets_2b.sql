-- Etapa 2b — Tipo de meta: "Separar mais" ou "Completar até"
-- Rode UMA vez no SQL Editor do Supabase (sem selecionar nada), DEPOIS da
-- migration_targets_2.sql. Pode rodar de novo sem problema.
--
--   set_aside = separar mais R$X por mês (ignora a sobra; é o padrão)
--   refill    = completar até R$X disponíveis (a sobra do mês anterior conta)

alter table category_targets
  add column if not exists target_type text not null default 'set_aside';

alter table category_targets drop constraint if exists category_targets_type_check;
alter table category_targets add constraint category_targets_type_check
  check (target_type in ('set_aside', 'refill'));

-- Conferência: todas as metas existentes ficam como "separar mais"
select target_type, count(*) as metas from category_targets group by target_type;
