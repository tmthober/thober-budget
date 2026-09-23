import { supabase } from '../supabaseClient'
import { computeCategorySummaries } from './budget'

// Busca orçado/gasto/disponível de UMA categoria num mês, sem precisar
// carregar o app inteiro. Usado tanto pelo aviso de estouro quanto pela
// dica que aparece no formulário de lançamento assim que a categoria é
// escolhida.
export async function fetchCategorySummary(categoryId, monthKey) {
  const [catRes, budgetRes, txRes] = await Promise.all([
    supabase.from('categories').select('*').eq('id', categoryId).single(),
    supabase.from('budget_entries').select('*').eq('category_id', categoryId),
    supabase.from('transactions').select('*').eq('category_id', categoryId),
  ])

  // Se qualquer leitura falhou, não arrisca calcular em cima de dado
  // incompleto.
  if (catRes.error || budgetRes.error || txRes.error || !catRes.data) return null

  const [summary] = computeCategorySummaries(
    [catRes.data],
    budgetRes.data ?? [],
    txRes.data ?? [],
    monthKey
  )
  return summary
}

// Depois de salvar uma transação, verifica se a categoria dela ficou negativa
// (disponível < 0) no mês da transação.
export async function checkOverspend(categoryId, monthKey) {
  const summary = await fetchCategorySummary(categoryId, monthKey)
  if (!summary) return null
  if (summary.available >= -0.005) return null

  return {
    category: summary,
    monthKey,
    overspentAmount: Math.abs(summary.available),
  }
}

// Move um valor do orçado de uma categoria pra outra, no mesmo mês.
// Lê o valor orçado atual das duas categorias primeiro, pra somar/subtrair
// em cima do que já existe — e SÓ escreve se as duas leituras derem certo.
// Isso é essencial: se a leitura falhasse silenciosamente e o código tratasse
// isso como "orçado atual = 0", o upsert abaixo SOBRESCREVERIA o valor real
// da categoria com só a diferença, destruindo o que já estava orçado.
export async function moveBudgetedAmount(fromCategoryId, toCategoryId, monthKey, amount) {
  const { data: existing, error: readError } = await supabase
    .from('budget_entries')
    .select('*')
    .in('category_id', [fromCategoryId, toCategoryId])
    .eq('month', monthKey)

  if (readError) {
    return { error: readError }
  }

  const findAmount = (categoryId) => {
    const row = (existing ?? []).find((b) => b.category_id === categoryId)
    return row ? Number(row.budgeted_amount) : 0
  }

  const newFromAmount = findAmount(fromCategoryId) - amount
  const newToAmount = findAmount(toCategoryId) + amount

  const { error: writeError } = await supabase.from('budget_entries').upsert(
    [
      { category_id: fromCategoryId, month: monthKey, budgeted_amount: newFromAmount },
      { category_id: toCategoryId, month: monthKey, budgeted_amount: newToAmount },
    ],
    { onConflict: 'category_id,month' }
  )

  if (writeError) {
    return { error: writeError }
  }

  // Registra o histórico do movimento — não afeta o orçado em si (já feito
  // acima), só permite identificar depois quais categorias vivem estourando
  // e quais vivem emprestando dinheiro. Falha aqui não desfaz o movimento.
  await supabase.from('overspend_moves').insert({
    month: monthKey,
    from_category_id: fromCategoryId,
    to_category_id: toCategoryId,
    amount,
  })

  return { error: null }
}
