-- Etapa 1B — Entradas, renda fora das categorias, Pagamento do cartão
-- Rode DEPOIS da etapa 1A, UMA vez, no SQL Editor do Supabase (sem selecionar
-- nada). Pode rodar de novo sem duplicar nada.
--
-- IMPORTANTE: logo depois de rodar, publique o app novo no GitHub. Entre uma
-- coisa e outra, evite lançar transações (o app antigo não conhece "Entrada").

-- 1) Tipo do lançamento: gasto ou entrada
alter table transactions add column if not exists kind text not null default 'expense';

alter table transactions drop constraint if exists transactions_kind_check;
alter table transactions add constraint transactions_kind_check
  check (kind in ('expense', 'income'));

-- 2) Entrada e gasto de caixinha não têm categoria
alter table transactions alter column category_id drop not null;

-- 3) Transações antigas de categorias de renda viram "Entrada" sem categoria
update transactions
   set kind = 'income', category_id = null
 where category_id in (select id from categories where is_income);

alter table transactions drop constraint if exists transactions_income_no_category;
alter table transactions add constraint transactions_income_no_category
  check (kind <> 'income' or category_id is null);

-- 4) Marca a categoria especial de Pagamento do cartão
alter table categories add column if not exists is_card_payment boolean not null default false;

do $$
declare
  v_group uuid;
  v_after int;
begin
  if exists (select 1 from categories where is_card_payment) then
    raise notice 'Categoria de Pagamento do cartão já existe; pulando.';
    return;
  end if;

  select sort_order into v_after
    from category_groups where name = 'Immediate Obligations' limit 1;
  if v_after is null then
    select coalesce(max(sort_order), 0) into v_after from category_groups;
  end if;

  update category_groups set sort_order = sort_order + 1 where sort_order > v_after;

  insert into category_groups (name, sort_order)
  values ('Cartão de crédito', v_after + 1)
  returning id into v_group;

  insert into categories (group_id, name, sort_order, is_income, is_card_payment)
  values (v_group, '💳 Pagamento do cartão', 0, false, true);
end $$;

-- Conferência: quantas entradas foram convertidas e a categoria criada
select
  (select count(*) from transactions where kind = 'income') as entradas,
  (select count(*) from transactions where kind = 'expense' and category_id is null) as gastos_sem_categoria,
  (select name from categories where is_card_payment limit 1) as categoria_cartao;
