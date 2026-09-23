-- Migração: adiciona a tabela de histórico de "cobrir estouro".
-- Segura de rodar no seu banco atual — não mexe em nenhuma tabela existente,
-- só cria a nova. Rode uma vez no SQL Editor do Supabase.

create table overspend_moves (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  from_category_id uuid not null references categories(id),
  to_category_id uuid not null references categories(id),
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

alter table overspend_moves enable row level security;

create policy "authenticated read/write" on overspend_moves
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
