import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatCurrency } from '../lib/budget'

export default function TransactionsView({ refreshKey }) {
  const [transactions, setTransactions] = useState([])
  const [categoriesById, setCategoriesById] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, c] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('categories').select('*'),
      ])
      setTransactions(t.data ?? [])
      const map = {}
      for (const cat of c.data ?? []) map[cat.id] = cat
      setCategoriesById(map)
      setLoading(false)
    }
    load()
  }, [refreshKey])

  if (loading) return <div className="empty-state">Carregando lançamentos...</div>
  if (transactions.length === 0) {
    return <div className="empty-state">Nenhum lançamento ainda. Toque em "+" para adicionar o primeiro.</div>
  }

  return (
    <div>
      {transactions.map((tx) => {
        const cat = categoriesById[tx.category_id]
        const isIncome = cat?.is_income
        return (
          <div className="tx-row" key={tx.id}>
            <div>
              <p className="name">{cat ? cat.name : 'Categoria removida'}</p>
              <p className="meta">
                {new Date(tx.date).toLocaleDateString('pt-BR')}
                {tx.note && ` · ${tx.note}`}
              </p>
            </div>
            <span className={`amt ${isIncome ? 'income' : ''}`}>
              {isIncome ? '+ ' : '- '}{formatCurrency(Math.abs(tx.amount))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
