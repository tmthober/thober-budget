-- Quem registrou cada transação
-- Rode UMA vez no SQL Editor do Supabase (sem selecionar nada), depois publique
-- o app novo. Pode rodar de novo sem duplicar nada.
--
-- Transações antigas ficam sem registro de quem lançou (o app não mostra nada
-- nelas); as novas passam a guardar quem lançou automaticamente.

-- 1) Guarda o usuário que fez o lançamento (preenchido pelo próprio banco)
alter table transactions add column if not exists created_by uuid default auth.uid();

-- 2) Nome e iniciais de cada pessoa da família (o app não consegue ler a
--    tabela de usuários do Supabase, então guardamos aqui)
create table if not exists family_members (
  user_id uuid primary key,
  name text not null,
  initials text not null
);

alter table family_members enable row level security;

drop policy if exists "somente familia" on family_members;
create policy "somente familia" on family_members
  for all
  using (auth.uid() = any (array['6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid]))
  with check (auth.uid() = any (array['6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid]));

-- 3) Semente a partir do e-mail de cada usuário (mesma lógica das iniciais
--    do avatar do app). Você pode corrigir o nome depois no Table Editor.
insert into family_members (user_id, name, initials)
select u.id,
       coalesce(
         nullif(u.raw_user_meta_data->>'name', ''),
         nullif(u.raw_user_meta_data->>'full_name', ''),
         initcap(regexp_replace(split_part(u.email, '@', 1), '[._-]+', ' ', 'g'))
       ),
       case
         when array_length(regexp_split_to_array(split_part(u.email, '@', 1), '[._-]+'), 1) >= 2
           then upper(
             left((regexp_split_to_array(split_part(u.email, '@', 1), '[._-]+'))[1], 1) ||
             left((regexp_split_to_array(split_part(u.email, '@', 1), '[._-]+'))[2], 1)
           )
         else upper(left(split_part(u.email, '@', 1), 2))
       end
  from auth.users u
 where u.id in ('6804ccb3-42aa-4032-883a-81abe668b171'::uuid, 'e14ad4e3-0a3c-4091-8063-2a323087eea0'::uuid)
on conflict (user_id) do nothing;

-- Conferência: deve listar as duas pessoas, com nome e iniciais
select * from family_members;
