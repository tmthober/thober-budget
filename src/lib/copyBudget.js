// Copiar o orçado ORIGINAL do mês anterior para o mês atual.
//
// Por que "original": quando você cobre um estouro, `moveBudgetedAmount`
// altera o `budgeted_amount` do mês (tira da categoria de origem, soma na de
// destino). O valor planejado de verdade não fica guardado, mas dá pra
// reconstruir com o histórico `overspend_moves` daquele mês:
//
//   original = budgeted_atual + emprestou (lent) - recebeu (borrowed)
//
// Convenção do projeto: datas são STRINGS ('YYYY-MM-01'). Nunca usar
// `new Date('YYYY-MM-DD')` (bug de fuso UTC-3). Aqui só se fatia/compara string.
//
// Lição do bug do `moveBudgetedAmount`: se QUALQUER leitura falhar, abortamos
// sem escrever nada — senão copiaríamos valores já ajustados achando que são
// os originais.

import { supabase } from '../supabaseClient'

// 'YYYY-MM-01' -> 'YYYY-MM-01' do mês anterior (aritmética em string/número).
export function previousMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  return `${py}-${String(pm).padStart(2, '0')}-01`
}

const ym = (dateStr) => String(dateStr).slice(0, 7)
const toCents = (n) => Math.round(n * 100) / 100

// entries: budget_entries de UM mês. moves: overspend_moves desse MESMO mês.
// Retorna Map(category_id -> { original, adjusted }).
// (Map, e não objeto, pra preservar o tipo do id — uuid ou número.)
export function computeOriginalBudgets(entries, moves) {
  const adjustment = new Map() // category_id -> (emprestou - recebeu)
  for (const mv of moves) {
    const amount = Number(mv.amount)
    adjustment.set(mv.from_category_id, (adjustment.get(mv.from_category_id) ?? 0) + amount)
    adjustment.set(mv.to_category_id, (adjustment.get(mv.to_category_id) ?? 0) - amount)
  }

  const result = new Map()
  for (const e of entries) {
    const adj = adjustment.get(e.category_id) ?? 0
    result.set(e.category_id, {
      original: Math.max(0, toCents(Number(e.budgeted_amount) + adj)),
      adjusted: adj !== 0,
    })
  }
  return result
}

// Calcula o que SERIA copiado, sem escrever nada (usado na tela de confirmação).
// Regras: só categorias de despesa; só se o orçado do mês atual for zero/inexistente;
// categorias sem orçado original no mês anterior (ex: novas) ficam zeradas.
export async function loadCopyPreview(monthKey, categories) {
  const prevKey = previousMonthKey(monthKey)

  const [prevRes, movesRes, currRes] = await Promise.all([
    supabase.from('budget_entries').select('category_id, month, budgeted_amount').eq('month', prevKey),
    supabase.from('overspend_moves').select('month, from_category_id, to_category_id, amount').eq('month', prevKey),
    supabase.from('budget_entries').select('category_id, month, budgeted_amount').eq('month', monthKey),
  ])
  if (prevRes.error || movesRes.error || currRes.error) return { error: true }

  const prevEntries = prevRes.data ?? []
  const currEntries = currRes.data ?? []
  const prevMoves = movesRes.data ?? []

  const eligible = new Set(categories.filter((c) => !c.is_income).map((c) => c.id))
  const alreadyBudgeted = new Set(
    currEntries.filter((e) => Number(e.budgeted_amount) > 0).map((e) => e.category_id)
  )
  const originals = computeOriginalBudgets(prevEntries, prevMoves)

  const rows = []
  let keptExisting = 0
  let adjusted = 0
  for (const [categoryId, info] of originals) {
    if (!eligible.has(categoryId) || info.original <= 0) continue
    if (alreadyBudgeted.has(categoryId)) {
      keptExisting++
      continue
    }
    if (info.adjusted) adjusted++
    rows.push({ category_id: categoryId, month: monthKey, budgeted_amount: info.original })
  }

  return {
    error: false,
    rows,
    total: toCents(rows.reduce((s, r) => s + r.budgeted_amount, 0)),
    keptExisting,
    adjusted,
    prevEmpty: prevEntries.length === 0,
  }
}

// Grava as linhas do preview em uma única operação (tudo ou nada).
// Só categorias zeradas são tocadas, então repetir é seguro.
export async function applyCopyBudget(rows) {
  if (rows.length === 0) return { error: null }
  return supabase
    .from('budget_entries')
    .upsert(rows, { onConflict: 'category_id,month' })
}
