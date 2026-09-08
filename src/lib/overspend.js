import { supabase } from '../supabaseClient'
import { computeCategorySummaries } from './budget'

// Depois de salvar uma transação, verifica se a categoria dela ficou negativa
// (disponível < 0) no mês da transação. Busca só os dados dessa categoria,
// pra não precisar recarregar o app inteiro.
export async function checkOverspend(categoryId, monthKey) {
  const [catRes, budgetRes, txRes] = await Promise.all([
    supabase.from('categories').select('*').eq('id', categoryId).single(),
    supabase.from('budget_entries').select('*').eq('category_id', categoryId),
    supabase.from('transactions').select('*').eq('category_id', categoryId),
  ])

  if (!catRes.data) return null

  const [summary] = computeCategorySummaries(
    [catRes.data],
    budgetRes.data ?? [],
    txRes.data ?? [],
    monthKey
  )

  if (summary.available >= 0) return null

  return {
    category: catRes.data,
    monthKey,
    overspentAmount: Math.abs(summary.available),
  }
}

// Move um valor do orçado de uma categoria pra outra, no mesmo mês.
// Ambas as linhas em budget_entries são lidas primeiro (pra somar/subtrair
// em cima do que já existe) e depois gravadas com upsert.
export async function moveBudgetedAmount(fromCategoryId, toCategoryId, monthKey, amount) {
  const { data: existing } = await supabase
    .from('budget_entries')
    .select('*')
    .in('category_id', [fromCategoryId, toCategoryId])
    .eq('month', monthKey)

  const findAmount = (categoryId) => {
    const row = (existing ?? []).find((b) => b.category_id === categoryId)
    return row ? Number(row.budgeted_amount) : 0
  }

  const newFromAmount = findAmount(fromCategoryId) - amount
  const newToAmount = findAmount(toCategoryId) + amount

  const { error } = await supabase.from('budget_entries').upsert(
    [
      { category_id: fromCategoryId, month: monthKey, budgeted_amount: newFromAmount },
      { category_id: toCategoryId, month: monthKey, budgeted_amount: newToAmount },
    ],
    { onConflict: 'category_id,month' }
  )

  return { error }
}
