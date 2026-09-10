import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import { formatCurrency } from '../lib/budget'
import EditTransactionForm from './EditTransactionForm'

export default function TransactionsView({ refreshKey }) {
  const [transactions, setTransactions] = useState([])
  const [categoriesById, setCategoriesById] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [localRefresh, setLocalRefresh] = useState(0)

  async function load() {
    setLoading(true)
    setLoadError(false)
    const [t, c] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('categories').select('*'),
    ])
    if (t.error || c.error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    setTransactions(t.data ?? [])
    const map = {}
    for (const cat of c.data ?? []) map[cat.id] = cat
    setCategoriesById(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey, localRefresh])

  if (editingTx) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <EditTransactionForm
          transaction={editingTx}
          onBack={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); setLocalRefresh((k) => k + 1) }}
          onDeleted={() => { setEditingTx(null); setLocalRefresh((k) => k + 1) }}
        />
      </motion.div>
    )
  }

  if (loading) return <div className="empty-state">Carregando lançamentos...</div>

  if (loadError) {
    return (
      <div className="empty-state">
        <p>Não foi possível carregar os lançamentos. Verifique sua conexão.</p>
        <button className="secondary-btn" onClick={load} style={{ marginTop: 12 }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (transactions.length === 0) {
    return <div className="empty-state">Nenhum lançamento ainda. Toque em "+" para adicionar o primeiro.</div>
  }

  return (
    <div>
      {transactions.map((tx) => {
        const cat = categoriesById[tx.category_id]
        const isIncome = cat?.is_income
        return (
          <button className="tx-row" key={tx.id} onClick={() => setEditingTx(tx)}>
            <div>
              <p className="name">{cat ? cat.name : 'Categoria removida'}</p>
              <p className="meta">
                {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                {tx.note && ` · ${tx.note}`}
              </p>
            </div>
            <span className={`amt ${isIncome ? 'income' : ''}`}>
              {isIncome ? '+ ' : '- '}{formatCurrency(Math.abs(tx.amount))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
