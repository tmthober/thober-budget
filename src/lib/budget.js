// Helpers de data e cálculo do orçamento (lógica estilo YNAB simplificada,
// sem contas separadas por enquanto).

export function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function toMonthKey(date) {
  // 'YYYY-MM-01'
  const m = monthStart(date)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

export function formatMonthLabel(date) {
  return date
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase())
}

export function formatCurrency(value) {
  return (value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

// Calcula, para cada categoria, o valor orçado neste mês, o gasto neste mês,
// e o "disponível" acumulado (orçado acumulado - gasto acumulado até este mês).
// budgetEntries e transactions são todas as linhas já carregadas do Supabase.
export function computeCategorySummaries(categories, budgetEntries, transactions, monthKey) {
  const monthEnd = addMonths(new Date(monthKey), 1)

  return categories.map((cat) => {
    const entriesUpToMonth = budgetEntries.filter(
      (b) => b.category_id === cat.id && b.month <= monthKey
    )
    const cumulativeBudgeted = entriesUpToMonth.reduce(
      (sum, b) => sum + Number(b.budgeted_amount), 0
    )
    const budgetedThisMonth = entriesUpToMonth.find((b) => b.month === monthKey)
    const budgetedThisMonthAmount = budgetedThisMonth ? Number(budgetedThisMonth.budgeted_amount) : 0

    const txUpToMonth = transactions.filter(
      (t) => t.category_id === cat.id && new Date(t.date) < monthEnd
    )
    const cumulativeActivity = txUpToMonth.reduce((sum, t) => sum + Number(t.amount), 0)

    const txThisMonth = txUpToMonth.filter(
      (t) => new Date(t.date) >= new Date(monthKey)
    )
    const activityThisMonth = txThisMonth.reduce((sum, t) => sum + Number(t.amount), 0)

    return {
      ...cat,
      budgetedThisMonth: budgetedThisMonthAmount,
      activityThisMonth,
      available: cumulativeBudgeted - cumulativeActivity,
    }
  })
}

// "Pronto para orçar" = renda acumulada até o mês - total orçado acumulado até o mês
export function computeToBeBudgeted(categories, budgetEntries, transactions, monthKey) {
  const monthEnd = addMonths(new Date(monthKey), 1)
  const incomeCategoryIds = categories.filter((c) => c.is_income).map((c) => c.id)

  const incomeToDate = transactions
    .filter((t) => incomeCategoryIds.includes(t.category_id) && new Date(t.date) < monthEnd)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const budgetedToDate = budgetEntries
    .filter((b) => b.month <= monthKey)
    .reduce((sum, b) => sum + Number(b.budgeted_amount), 0)

  return incomeToDate - budgetedToDate
}
