// Helpers de intervalo de datas e agregação de gastos para a tela de
// Relatórios. Segue o mesmo princípio do lib/budget.js: comparar datas como
// STRING 'YYYY-MM-DD' sempre que possível, e só usar objetos Date pra
// aritmética de calendário (somar/subtrair dias/meses) — nunca fazer
// `new Date('YYYY-MM-DD')` pra depois comparar, por causa do bug de fuso
// horário que já mordeu esse projeto uma vez.

export function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function presetRange(preset, today) {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (preset) {
    case 'month':
      return { start: formatDateStr(new Date(y, m, 1)), end: formatDateStr(today) }
    case 'lastMonth': {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0) // dia 0 deste mês = último dia do mês anterior
      return { start: formatDateStr(start), end: formatDateStr(end) }
    }
    case 'last3':
      return { start: formatDateStr(new Date(y, m - 2, 1)), end: formatDateStr(today) }
    case 'year':
      return { start: formatDateStr(new Date(y, 0, 1)), end: formatDateStr(today) }
    case 'all':
      return { start: '0000-01-01', end: '9999-12-31' }
    default:
      return { start: formatDateStr(new Date(y, m, 1)), end: formatDateStr(today) }
  }
}

// Período imediatamente anterior, com a mesma duração — pra comparar
// "gastei mais ou menos que antes", qualquer que seja o filtro escolhido.
export function previousPeriod(preset, start, end) {
  if (preset === 'all') return null
  const startD = parseDateStr(start)
  const endD = parseDateStr(end)
  const durationDays = Math.round((endD - startD) / 86400000) + 1
  const prevEnd = addDays(startD, -1)
  const prevStart = addDays(prevEnd, -(durationDays - 1))
  return { start: formatDateStr(prevStart), end: formatDateStr(prevEnd) }
}

export function filterTransactionsByRange(transactions, start, end) {
  return transactions.filter((t) => t.date >= start && t.date <= end)
}

// Agrega gastos (exclui a categoria de renda) por categoria e por grupo,
// dentro do intervalo informado.
export function aggregateSpending(transactions, categories, groups, start, end) {
  const catsById = Object.fromEntries(categories.map((c) => [c.id, c]))

  const inRange = filterTransactionsByRange(transactions, start, end).filter((t) => {
    const cat = catsById[t.category_id]
    return cat && !cat.is_income
  })

  const totalsByCategory = {}
  for (const t of inRange) {
    totalsByCategory[t.category_id] = (totalsByCategory[t.category_id] || 0) + Number(t.amount)
  }

  const byCategory = Object.entries(totalsByCategory)
    .map(([categoryId, amount]) => ({
      id: categoryId,
      name: catsById[categoryId]?.name ?? 'Categoria removida',
      groupId: catsById[categoryId]?.group_id,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)

  const totalsByGroup = {}
  for (const c of byCategory) {
    totalsByGroup[c.groupId] = (totalsByGroup[c.groupId] || 0) + c.amount
  }

  const byGroup = Object.entries(totalsByGroup)
    .map(([groupId, amount]) => ({
      id: groupId,
      name: groups.find((g) => g.id === groupId)?.name ?? 'Outro',
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)

  const total = byCategory.reduce((sum, c) => sum + c.amount, 0)

  return { byCategory, byGroup, total }
}
