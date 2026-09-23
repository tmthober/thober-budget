-- Orçamento familiar — suporte a households (múltiplos usuários, cada um com seu orçamento isolado)
-- Execute este arquivo após o schema.sql original no Supabase.
-- Ele cria as tabelas households e household_members, adiciona household_id a todas as tabelas
-- existentes, e refatora as RLS policies para usar household em vez de "qualquer autenticado".

-- =====================================================================
-- 1. Tabelas novas: households e household_members
-- =====================================================================

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  access_code text not null unique, -- código de 6-8 caracteres pra join
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- 'admin' ou 'member'
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- =====================================================================
-- 2. Adiciona household_id a todas as tabelas existentes
-- =====================================================================

alter table category_groups add column household_id uuid not null references households(id) on delete cascade;
alter table categories add column household_id uuid not null references households(id) on delete cascade;
alter table budget_entries add column household_id uuid not null references households(id) on delete cascade;
alter table transactions add column household_id uuid not null references households(id) on delete cascade;
alter table overspend_moves add column household_id uuid not null references households(id) on delete cascade;

-- Índices para performance em queries por household
create index idx_category_groups_household on category_groups(household_id);
create index idx_categories_household on categories(household_id);
create index idx_budget_entries_household on budget_entries(household_id);
create index idx_transactions_household on transactions(household_id);
create index idx_overspend_moves_household on overspend_moves(household_id);
create index idx_household_members_user on household_members(user_id);

-- =====================================================================
-- 3. RLS: habilitação em tabelas novas
-- =====================================================================

alter table households enable row level security;
alter table household_members enable row level security;

-- =====================================================================
-- 4. RLS: policies em tabelas novas (households + household_members)
-- =====================================================================

-- Usuários podem ver households que criaram
create policy "Users can view households they created"
  on households for select
  using (created_by = auth.uid());

-- Usuários podem ver households que são membros
create policy "Users can view households they are members of"
  on households for select
  using (
    id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

-- Usuários podem criar novo household
create policy "Users can create households"
  on households for insert
  with check (created_by = auth.uid());

-- Somente o criador pode atualizar/deletar household
create policy "Only creator can update household"
  on households for update
  using (created_by = auth.uid());

create policy "Only creator can delete household"
  on households for delete
  using (created_by = auth.uid());

-- Usuários podem ver membros de households que são parte
create policy "Users can view household members"
  on household_members for select
  using (
    household_id in (
      select id from households where created_by = auth.uid()
      union
      select household_id from household_members where user_id = auth.uid()
    )
  );

-- Usuários podem se remover de um household (deixar)
create policy "Users can remove themselves from household"
  on household_members for delete
  using (user_id = auth.uid());

-- Admin (criador) pode remover membros
create policy "Admins can remove members"
  on household_members for delete
  using (
    household_id in (
      select id from households where created_by = auth.uid()
    )
  );

-- Criador de household pode adicionar membros
create policy "Creator can add members to household"
  on household_members for insert
  with check (
    household_id in (
      select id from households where created_by = auth.uid()
    )
  );

-- =====================================================================
-- 5. RLS: refatora policies em tabelas existentes para usar household_id
-- =====================================================================

-- Remove policies antigas
drop policy if exists "authenticated read/write" on category_groups;
drop policy if exists "authenticated read/write" on categories;
drop policy if exists "authenticated read/write" on budget_entries;
drop policy if exists "authenticated read/write" on transactions;
drop policy if exists "authenticated read/write" on overspend_moves;

-- Category Groups
create policy "Users can view category_groups in their households"
  on category_groups for select
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can insert category_groups in their households"
  on category_groups for insert
  with check (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can update category_groups in their households"
  on category_groups for update
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can delete category_groups in their households"
  on category_groups for delete
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

-- Categories
create policy "Users can view categories in their households"
  on categories for select
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can insert categories in their households"
  on categories for insert
  with check (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can update categories in their households"
  on categories for update
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can delete categories in their households"
  on categories for delete
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

-- Budget Entries
create policy "Users can view budget_entries in their households"
  on budget_entries for select
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can insert budget_entries in their households"
  on budget_entries for insert
  with check (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can update budget_entries in their households"
  on budget_entries for update
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can delete budget_entries in their households"
  on budget_entries for delete
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

-- Transactions
create policy "Users can view transactions in their households"
  on transactions for select
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can insert transactions in their households"
  on transactions for insert
  with check (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can update transactions in their households"
  on transactions for update
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can delete transactions in their households"
  on transactions for delete
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

-- Overspend Moves
create policy "Users can view overspend_moves in their households"
  on overspend_moves for select
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can insert overspend_moves in their households"
  on overspend_moves for insert
  with check (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can update overspend_moves in their households"
  on overspend_moves for update
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );

create policy "Users can delete overspend_moves in their households"
  on overspend_moves for delete
  using (
    household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );
