-- Restaura os valores orçados de setembro/2026 para os originais,
-- caso tenham sido zerados/sobrescritos pelo bug da função "mover dinheiro
-- entre categorias". Seguro rodar mesmo que as linhas já existam (usa
-- ON CONFLICT DO UPDATE em vez de INSERT simples) — e não mexe em
-- transações nem em categorias.
--
-- ATENÇÃO: se você já tinha ajustado manualmente o valor orçado de alguma
-- categoria (além do que eu semeei originalmente) antes do bug acontecer,
-- rodar isso vai sobrescrever esse ajuste também, voltando pro valor
-- original. Se lembrar de algum ajuste assim, anote antes de rodar e
-- reaplique depois.

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
) as v(name, amount) on v.name = c.name
on conflict (category_id, month) do update set budgeted_amount = excluded.budgeted_amount;
