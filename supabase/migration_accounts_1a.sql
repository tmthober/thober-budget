-- Etapa 1A — Contas (corrente, cartão, caixinhas) e transferências
-- Rode este arquivo inteiro no SQL Editor do Supabase, UMA vez.
-- Não altera nenhum valor orçado nem o cálculo de "disponível": só adiciona
-- contas e liga as transações existentes à conta "Corrente".

create extension if not exists "pgcrypto";

-- 1) Contas
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('checking', 'credit_card', 'tracking')),
  sort_order int not null default 0,
  starting_balance numeric(12, 2) not null default 0,
  closing_day int check (closing_day between 1 and 31), -- só cartão
  due_day int check (due_day between 1 and 31),         -- só cartão
  created_at timestamptz not null default now()
);

-- 2) Transferências entre contas (não são gasto nem renda)
create table if not exists account_transfers (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  from_account_id uuid not null references accounts(id),
  to_account_id uuid not null references accounts(id),
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

-- 3) Transações passam a ter conta
alter table transactions add column if not exists account_id uuid references accounts(id);
create index if not exists transactions_account_id_idx on transactions(account_id);

-- 4) Segurança: mesma política das outras tabelas (só os 2 UIDs da família)
alter table accounts enable row level security;
alter table account_transfers enable row level security;

drop policy if exists "somente familia" on accounts;
create policy "somente familia" on accounts
  for all
  using (auth.uid() = any (array['6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid]))
  with check (auth.uid() = any (array['6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid]));

drop policy if exists "somente familia" on account_transfers;
create policy "somente familia" on account_transfers
  for all
  using (auth.uid() = any (array['6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid]))
  with check (auth.uid() = any (array['6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid]));

-- 5) Dados iniciais (só roda se ainda não existir nenhuma conta)
do $$
declare
  v_corrente uuid;
  v_net numeric;
begin
  if exists (select 1 from accounts) then
    raise notice 'Já existem contas; pulando a criação das contas iniciais.';
    return;
  end if;

  -- Fluxo líquido histórico: renda entra (+), gasto sai (-).
  select coalesce(sum(case when c.is_income then t.amount else -t.amount end), 0)
    into v_net
    from transactions t
    join categories c on c.id = t.category_id;

  -- Saldo inicial calibrado para que o saldo HOJE da Corrente seja R$ 5,95.
  insert into accounts (name, type, sort_order, starting_balance)
  values ('Corrente', 'checking', 0, round(5.95 - v_net, 2))
  returning id into v_corrente;

  -- Cartão começa zerado (só compras novas contam).
  insert into accounts (name, type, sort_order, starting_balance, closing_day, due_day)
  values ('Cartão de crédito', 'credit_card', 1, 0, 29, 6);

  update transactions set account_id = v_corrente where account_id is null;

  -- Default = Corrente, para o app antigo continuar salvando sem erro
  -- no intervalo entre rodar este SQL e publicar o app novo.
  execute format('alter table transactions alter column account_id set default %L', v_corrente);
  alter table transactions alter column account_id set not null;
end $$;
