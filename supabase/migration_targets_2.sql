-- Etapa 2 — Metas (targets) mensais por categoria
-- Rode UMA vez no SQL Editor do Supabase (sem selecionar nada). Pode rodar de
-- novo sem duplicar nada. Depois, publique o app novo no GitHub.
--
-- A meta é o quanto você QUER colocar na categoria por mês. Ela é separada do
-- "orçado" (Assigned), que as coberturas de estouro alteram; a meta nunca muda
-- por causa de coberturas.

create table if not exists category_targets (
  category_id uuid primary key references categories(id) on delete cascade,
  monthly_amount numeric(12, 2) not null check (monthly_amount > 0),
  updated_at timestamptz not null default now()
);

alter table category_targets enable row level security;

drop policy if exists "somente familia" on category_targets;
create policy "somente familia" on category_targets
  for all
  using (auth.uid() = any (array['6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid]))
  with check (auth.uid() = any (array['6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid]));

-- Semente: orçado ORIGINAL de setembro/2026 (antes das coberturas de estouro),
-- reconstruído como: orçado atual + emprestou − recebeu. Só categorias de
-- despesa com valor maior que zero. Não sobrescreve metas já existentes.
insert into category_targets (category_id, monthly_amount)
select e.category_id,
       e.budgeted_amount + coalesce(adj.delta, 0)
  from budget_entries e
  join categories c on c.id = e.category_id
  left join (
    select category_id, sum(delta) as delta
      from (
        select from_category_id as category_id, amount as delta
          from overspend_moves where month = '2026-09-01'
        union all
        select to_category_id as category_id, -amount as delta
          from overspend_moves where month = '2026-09-01'
      ) m
     group by category_id
  ) adj on adj.category_id = e.category_id
 where e.month = '2026-09-01'
   and not c.is_income
   and not c.is_card_payment
   and e.budgeted_amount + coalesce(adj.delta, 0) > 0
on conflict (category_id) do nothing;

-- Conferência: quantas metas existem e quanto somam
select count(*) as metas, coalesce(sum(monthly_amount), 0) as soma_mensal
  from category_targets;
