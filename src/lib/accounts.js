// Contas (corrente, cartão, caixinhas) — Etapa 1A.
// Nesta etapa os saldos das contas são INFORMATIVOS: não alteram "Pronto para
// orçar" nem o disponível das categorias (isso entra na Etapa 1B).
//
// Saldo = saldo inicial
//         + renda (categoria is_income) − gastos, das transações da conta
//         + transferências recebidas − transferências enviadas
// Toda a aritmética é feita em centavos (inteiros) para evitar erro de float.

import { supabase } from '../supabaseClient'

export const ACCOUNT_TYPE_LABELS = {
  checking: 'Conta corrente',
  credit_card: 'Cartão de crédito',
  tracking: 'Caixinha',
}

const toCents = (v) => Math.round(Number(v ?? 0) * 100)

async function fetchAllTransactions() {
  const pageSize = 1000
  let from = 0
  let all = []
  for (;;) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, category_id, account_id, amount')
      .order('id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

export async function loadAccountsData() {
  const [a, tr, c, transactions] = await Promise.all([
    supabase.from('accounts').select('*').order('sort_order').order('created_at'),
    supabase
      .from('account_transfers')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('categories').select('id, is_income'),
    fetchAllTransactions(),
  ])
  const err = a.error || tr.error || c.error
  if (err) throw err
  return {
    accounts: a.data ?? [],
    transfers: tr.data ?? [],
    categories: c.data ?? [],
    transactions,
  }
}

// Retorna { [accountId]: saldo } em reais.
export function computeBalances({ accounts, transactions, transfers, categories }) {
  const incomeIds = new Set(categories.filter((c) => c.is_income).map((c) => c.id))
  const cents = {}
  accounts.forEach((acc) => { cents[acc.id] = toCents(acc.starting_balance) })

  transactions.forEach((t) => {
    if (cents[t.account_id] === undefined) return
    const v = toCents(t.amount)
    cents[t.account_id] += incomeIds.has(t.category_id) ? v : -v
  })
  transfers.forEach((t) => {
    const v = toCents(t.amount)
    if (cents[t.from_account_id] !== undefined) cents[t.from_account_id] -= v
    if (cents[t.to_account_id] !== undefined) cents[t.to_account_id] += v
  })

  const out = {}
  Object.keys(cents).forEach((id) => { out[id] = cents[id] / 100 })
  return out
}

// Novo saldo inicial para que o saldo atual passe a ser `desired`.
export function startingBalanceFor(account, currentBalance, desired) {
  const delta = toCents(desired) - toCents(currentBalance)
  return (toCents(account.starting_balance) + delta) / 100
}
