// Etapa 3 — "Atribuir para cumprir as metas".
// Soma, em cada categoria com meta, o que falta para cumprir a meta do mês,
// respeitando o "Pronto para orçar". Nunca reduz nem sobrescreve o que já foi
// atribuído. Quando o dinheiro não dá para tudo, preenche na ordem da tela
// (grupos e categorias por sort_order) até acabar. Tudo em centavos.

import { supabase } from '../supabaseClient'

const toCents = (v) => Math.round(Number(v ?? 0) * 100)

export function planAutoAssign({ groups, summaries, targets, missingFor, toBeBudgeted }) {
  let remaining = Math.max(0, toCents(toBeBudgeted))
  const rows = []

  const orderedGroups = [...groups]
    .filter((g) => g.name !== 'Income')
    .sort((a, b) => a.sort_order - b.sort_order)

  for (const group of orderedGroups) {
    const cats = summaries
      .filter((c) => c.group_id === group.id && !c.is_income && !c.is_card_payment)
      .sort((a, b) => a.sort_order - b.sort_order)
    for (const cat of cats) {
      if (!targets[cat.id]) continue
      const missing = toCents(missingFor(cat))
      if (missing <= 0) continue
      const assign = Math.min(missing, remaining)
      remaining -= assign
      rows.push({
        id: cat.id,
        name: cat.name,
        groupName: group.name,
        missing: missing / 100,
        assign: assign / 100,
        status: assign === missing ? 'full' : assign > 0 ? 'partial' : 'none',
      })
    }
  }

  const totalMissing = rows.reduce((s, r) => s + toCents(r.missing), 0) / 100
  const totalAssign = rows.reduce((s, r) => s + toCents(r.assign), 0) / 100
  return { rows, totalMissing, totalAssign, available: Math.max(0, toCents(toBeBudgeted)) / 100 }
}

// Soma o valor ao orçado ATUAL do banco (relido na hora, não o da tela).
// Regra do projeto: se a leitura falhar, aborta sem escrever nada.
export async function applyAutoAssign(rows, monthKey) {
  const todo = rows.filter((r) => r.assign > 0)
  if (todo.length === 0) return { error: null }

  const { data, error } = await supabase
    .from('budget_entries')
    .select('category_id, budgeted_amount')
    .eq('month', monthKey)
    .in('category_id', todo.map((r) => r.id))
  if (error) return { error }

  const current = Object.fromEntries(
    (data ?? []).map((e) => [e.category_id, toCents(e.budgeted_amount)])
  )
  const payload = todo.map((r) => ({
    category_id: r.id,
    month: monthKey,
    budgeted_amount: ((current[r.id] ?? 0) + toCents(r.assign)) / 100,
  }))

  const { error: upsertError } = await supabase
    .from('budget_entries')
    .upsert(payload, { onConflict: 'category_id,month' })
  return { error: upsertError ?? null }
}
