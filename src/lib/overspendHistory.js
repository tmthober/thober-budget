import { supabase } from '../supabaseClient'

// Busca todos os movimentos de "cobrir estouro" com month dentro de
// [startMonthKey, endMonthKey] (comparação por string, mesmo padrão do
// resto do app — sem parsear como Date).
export async function fetchOverspendMoves(startMonthKey, endMonthKey) {
  const { data, error } = await supabase
    .from('overspend_moves')
    .select('*')
    .gte('month', startMonthKey)
    .lte('month', endMonthKey)

  if (error) return { moves: [], error }
  return { moves: data ?? [], error: null }
}

// Resume os movimentos por categoria, nas duas direções:
// - overspentMonths: meses em que essa categoria PRECISOU de cobertura
// - lentMonths: meses em que essa categoria EMPRESTOU dinheiro pra outra
export function summarizeOverspendMoves(moves) {
  const stats = {}

  function ensure(categoryId) {
    if (!stats[categoryId]) {
      stats[categoryId] = {
        overspentMonths: new Set(),
        lentMonths: new Set(),
        totalReceived: 0,
        totalLent: 0,
      }
    }
    return stats[categoryId]
  }

  for (const move of moves) {
    const to = ensure(move.to_category_id)
    to.overspentMonths.add(move.month)
    to.totalReceived += Number(move.amount)

    const from = ensure(move.from_category_id)
    from.lentMonths.add(move.month)
    from.totalLent += Number(move.amount)
  }

  return stats
}
