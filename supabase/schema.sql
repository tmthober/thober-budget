-- Orçamento familiar — schema inicial (MVP)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase.

create extension if not exists "pgcrypto";

-- Grupos de categorias (Immediate Obligations, Variable Expenses, etc.)
create table category_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null
);

-- Categorias individuais
create table categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references category_groups(id) on delete cascade,
  name text not null,
  sort_order int not null,
  is_income boolean not null default false
);

-- Valor orçado (atribuído) por categoria, por mês
create table budget_entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  month date not null, -- sempre o primeiro dia do mês, ex: 2026-09-01
  budgeted_amount numeric(12, 2) not null default 0,
  unique (category_id, month)
);

-- Lançamentos (substitui a aba "Actuals" da planilha)
create table transactions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  date date not null,
  amount numeric(12, 2) not null, -- positivo = despesa, negativo = estorno; renda entra na categoria is_income
  note text,
  created_at timestamptz not null default now()
);

-- Row Level Security: qualquer usuário autenticado (você e sua esposa) pode ler/escrever tudo.
-- Isso é suficiente para um app privado de uso familiar com 2 contas.
alter table category_groups enable row level security;
alter table categories enable row level security;
alter table budget_entries enable row level security;
alter table transactions enable row level security;

create policy "authenticated read/write" on category_groups
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write" on categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write" on budget_entries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write" on transactions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- Seed: grupos e categorias reais, extraídos da planilha do usuário
-- ---------------------------------------------------------------------

insert into category_groups (name, sort_order) values
  ('Income', 0),
  ('Immediate Obligations', 1),
  ('Variable Expenses', 2),
  ('True Expenses', 3),
  ('Long-term Savings', 4),
  ('Wish Farm', 5);

-- Income
insert into categories (group_id, name, sort_order, is_income)
select id, '💰 Renda', 0, true from category_groups where name = 'Income';

-- Immediate Obligations
insert into categories (group_id, name, sort_order)
select category_groups.id, t.name, t.ord from category_groups, (values
  ('🏠 Condomínio', 0), ('💡 Energia', 1), ('🏛️ INSS', 2), ('🏛️ MEI', 3),
  ('🌐 Internet', 4), ('📱 Celular', 5), ('🛒 Supermercado - Need', 6),
  ('🛒 Supermercado - Want', 7), ('👦 Lucas - Needs', 8), ('👧 Ceci - Needs', 9),
  ('💊 Farmácia - Remédios fixos', 10), ('🧳 Gás', 11), ('🗺️ Transporte - Ônibus', 12),
  ('🗺️ Transporte - Uber', 13), ('🗺️ Transporte - Gasolina', 14),
  ('🗺️ Transporte - Seguro carro', 15), ('🤲 Generosidade', 16), ('♻️ Assinaturas', 17)
) as t(name, ord)
where category_groups.name = 'Immediate Obligations';

-- Variable Expenses
insert into categories (group_id, name, sort_order)
select category_groups.id, t.name, t.ord from category_groups, (values
  ('🍔 Alimentação - Restaurante', 0), ('🍔 Alimentação - Ifood', 1),
  ('💰 Spending Money - Tim', 2), ('💰 Spending Money - Dai', 3), ('💖 Dates', 4),
  ('🛋️ Decoração/Casa', 5), ('👧 Ceci - Mesada', 6), ('☕ Ministério', 7),
  ('🐙 Impressão 3D', 8)
) as t(name, ord)
where category_groups.name = 'Variable Expenses';

-- True Expenses
insert into categories (group_id, name, sort_order)
select category_groups.id, t.name, t.ord from category_groups, (values
  ('🗺️ Transporte - Manutenção', 0), ('💊 Farmácia - Remédio', 1),
  ('💊 Farmácia - Outros', 2), ('🎁 Presentes', 3), ('🎄 Eventos', 4),
  ('📚 Educação', 5), ('👕 Vestuário', 6), ('🗺️ Transporte - IPVA', 7),
  ('💉 Contas médicas', 8), ('🏠 Casa - Manutenção', 9),
  ('✏️ Escola - Material escolar', 10), ('🎂 Aniversários', 11),
  ('✏️ Escola - Extras', 12), ('💸 Assinaturas anuais', 13)
) as t(name, ord)
where category_groups.name = 'True Expenses';

-- Long-term Savings
insert into categories (group_id, name, sort_order)
select category_groups.id, t.name, t.ord from category_groups, (values
  ('🚨 Fundo de emergência', 0), ('✈️ Viagem Itália', 1),
  ('👦 Lucas - Poupança', 2), ('👧 Ceci - Poupança', 3)
) as t(name, ord)
where category_groups.name = 'Long-term Savings';

-- Wish Farm
insert into categories (group_id, name, sort_order)
select category_groups.id, t.name, t.ord from category_groups, (values
  ('🚙 Trocar de carro', 0), ('💻 Macbook', 1)
) as t(name, ord)
where category_groups.name = 'Wish Farm';

-- ---------------------------------------------------------------------
-- Seed opcional: valores orçados para setembro/2026, extraídos da planilha
-- Apague este bloco se preferir começar do zero.
-- ---------------------------------------------------------------------

insert into budget_entries (category_id, month, budgeted_amount)
select c.id, '2026-09-01', v.amount
from categories c
join (values
  ('🏠 Condomínio', 406.25), ('💡 Energia', 250), ('🏛️ INSS', 500), ('🏛️ MEI', 86.05),
  ('🌐 Internet', 84.9), ('📱 Celular', 89.92), ('🛒 Supermercado - Need', 1200),
  ('🛒 Supermercado - Want', 500), ('👦 Lucas - Needs', 250), ('👧 Ceci - Needs', 20),
  ('💊 Farmácia - Remédios fixos', 246), ('🧳 Gás', 115), ('🗺️ Transporte - Ônibus', 42.4),
  ('🗺️ Transporte - Uber', 40), ('🗺️ Transporte - Gasolina', 580),
  ('🗺️ Transporte - Seguro carro', 157.9), ('🤲 Generosidade', 400), ('♻️ Assinaturas', 64.9),
  ('🍔 Alimentação - Restaurante', 200), ('🍔 Alimentação - Ifood', 200), ('💖 Dates', 50),
  ('👧 Ceci - Mesada', 10), ('☕ Ministério', 100),
  ('🗺️ Transporte - Manutenção', 50), ('💊 Farmácia - Remédio', 50), ('🎁 Presentes', 50),
  ('🎄 Eventos', 20), ('🗺️ Transporte - IPVA', 9.166667), ('✏️ Escola - Material escolar', 33.333333),
  ('🎂 Aniversários', 83.333333), ('✏️ Escola - Extras', 25), ('💸 Assinaturas anuais', 79.734167)
) as v(name, amount) on v.name = c.name;

-- Lançamento real já existente na sua planilha
insert into transactions (category_id, date, amount, note)
select id, '2026-09-04', 32.0, 'Almoço com Duds' from categories where name = '☕ Ministério';
