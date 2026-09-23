// Helpers de data e cálculo do orçamento (lógica estilo YNAB simplificada,
// sem contas separadas por enquanto).
//
// IMPORTANTE: todas as comparações "este mês / até este mês" abaixo usam
// comparação de STRING (ex: "2026-09" <= "2026-09"), nunca `new Date(...)`.
// Strings ISO 'YYYY-MM-DD' e 'YYYY-MM' comparam corretamente com < <= > >=
// porque têm tamanho fixo — e isso evita um bug clássico de fuso horário:
// `new Date('2026-09-01')` é interpretado como UTC, então em fusos negativos
// (Brasil, UTC-3) ele "vira" 31 de agosto ao ler de volta com getMonth(),
// fazendo o mês inteiro de transações sumir dos cálculos.

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

// 'YYYY-MM-01' -> 'YYYY-MM', para comparar só o mês/ano como string.
function yearMonth(dateStr) {
  return dateStr.slice(0, 7)
}

// Calcula, para cada categoria, o valor orçado neste mês, o gasto neste mês,
// e o "disponível" acumulado (orçado acumulado - gasto acumulado até este mês).
// budgetEntries e transactions são todas as linhas já carregadas do Supabase.
export function computeCategorySummaries(categories, budgetEntries, transactions, monthKey) {
  const targetYm = yearMonth(monthKey)

  return categories.map((cat) => {
    const entriesUpToMonth = budgetEntries.filter(
      (b) => b.category_id === cat.id && yearMonth(b.month) <= targetYm
    )
    const cumulativeBudgeted = entriesUpToMonth.reduce(
      (sum, b) => sum + Number(b.budgeted_amount), 0
    )
    const budgetedThisMonth = entriesUpToMonth.find((b) => yearMonth(b.month) === targetYm)
    const budgetedThisMonthAmount = budgetedThisMonth ? Number(budgetedThisMonth.budgeted_amount) : 0

    const txUpToMonth = transactions.filter(
      (t) => t.category_id === cat.id && yearMonth(t.date) <= targetYm
    )
    const cumulativeActivity = txUpToMonth.reduce((sum, t) => sum + Number(t.amount), 0)

    const txThisMonth = txUpToMonth.filter((t) => yearMonth(t.date) === targetYm)
    const activityThisMonth = txThisMonth.reduce((sum, t) => sum + Number(t.amount), 0)

    return {
      ...cat,
      budgetedThisMonth: budgetedThisMonthAmount,
      activityThisMonth,
      available: cumulativeBudgeted - cumulativeActivity,
    }
  })
}

// 'YYYY-MM-DD' (data de uma transação) -> 'YYYY-MM-01' (chave de mês)
export function monthKeyFromDateString(dateStr) {
  return `${dateStr.slice(0, 7)}-01`
}

// "Pronto para orçar" = renda acumulada até o mês - total orçado acumulado até o mês
export function computeToBeBudgeted(categories, budgetEntries, transactions, monthKey) {
  const targetYm = yearMonth(monthKey)
  const incomeCategoryIds = categories.filter((c) => c.is_income).map((c) => c.id)

  const incomeToDate = transactions
    .filter((t) => incomeCategoryIds.includes(t.category_id) && yearMonth(t.date) <= targetYm)
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const budgetedToDate = budgetEntries
    .filter((b) => yearMonth(b.month) <= targetYm)
    .reduce((sum, b) => sum + Number(b.budgeted_amount), 0)

  return incomeToDate - budgetedToDate
}
