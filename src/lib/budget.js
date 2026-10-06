// Helpers de data e cálculo do orçamento (lógica estilo YNAB, com contas).
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

// Pagamento do cartão (Etapa 1B): a categoria especial `is_card_payment` não
// guarda lançamentos próprios. Seu "gasto" é calculado a partir de:
//   - compras no cartão (gasto numa conta do tipo cartão): reservam dinheiro
//     (atividade NEGATIVA => o disponível dela sobe);
//   - pagamentos da fatura (transferência de outra conta PARA o cartão): usam
//     a reserva (atividade POSITIVA => o disponível dela cai).
// Devolve as transações reais + essas linhas sintéticas, para alimentar
// computeCategorySummaries sem mudar nada nele.
export function withCardPaymentActivity(transactions, accounts, transfers, categories) {
  const cardCat = categories.find((c) => c.is_card_payment)
  if (!cardCat) return transactions
  const cardIds = new Set(accounts.filter((a) => a.type === 'credit_card').map((a) => a.id))

  const synthetic = []
  transactions.forEach((t) => {
    if (t.kind === 'expense' && t.category_id && cardIds.has(t.account_id)) {
      synthetic.push({ id: `card-${t.id}`, category_id: cardCat.id, date: t.date, amount: -Number(t.amount) })
    }
  })
  transfers.forEach((tr) => {
    if (cardIds.has(tr.to_account_id) && !cardIds.has(tr.from_account_id)) {
      synthetic.push({ id: `pay-${tr.id}`, category_id: cardCat.id, date: tr.date, amount: Number(tr.amount) })
    }
  })
  return [...transactions, ...synthetic]
}

const toCents = (v) => Math.round(Number(v ?? 0) * 100)

// "Pronto para orçar" (YNAB): dinheiro que está nas contas correntes até o mês
// MENOS o dinheiro já distribuído nos envelopes (soma do disponível de todas as
// categorias de gasto, incluindo Pagamento do cartão).
//
//   Pronto para orçar = saldo das contas correntes − soma dos disponíveis
//
// Por isso ajustar o saldo da Corrente na tela Contas muda este número 1:1.
// Caixinhas e cartão não entram no saldo: caixinha é fora do orçamento, e a
// dívida do cartão já está coberta pela categoria Pagamento do cartão.
export function computeToBeBudgeted(categories, budgetEntries, accounts, transactions, transfers, monthKey) {
  const targetYm = yearMonth(monthKey)
  const checkingIds = new Set(accounts.filter((a) => a.type === 'checking').map((a) => a.id))

  let cash = 0
  accounts.forEach((a) => { if (checkingIds.has(a.id)) cash += toCents(a.starting_balance) })
  transactions.forEach((t) => {
    if (!checkingIds.has(t.account_id) || yearMonth(t.date) > targetYm) return
    cash += t.kind === 'income' ? toCents(t.amount) : -toCents(t.amount)
  })
  transfers.forEach((tr) => {
    if (yearMonth(tr.date) > targetYm) return
    if (checkingIds.has(tr.to_account_id)) cash += toCents(tr.amount)
    if (checkingIds.has(tr.from_account_id)) cash -= toCents(tr.amount)
  })

  const effective = withCardPaymentActivity(transactions, accounts, transfers, categories)
  const summaries = computeCategorySummaries(
    categories.filter((c) => !c.is_income), budgetEntries, effective, monthKey
  )
  const envelopes = summaries.reduce((sum, c) => sum + toCents(c.available), 0)

  return (cash - envelopes) / 100
}
