import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import { formatCurrency } from '../lib/budget'
import { transactionsToCsv, downloadCsv } from '../lib/csv'
import EditTransactionForm from './EditTransactionForm'
import TransactionFilters, { resolveFilterRange, defaultCustomDate } from './TransactionFilters'
import SortMenu from './SortMenu'
import { IconFilter, IconDownload } from './icons'
import { useToast } from '../lib/ToastContext'

export default function TransactionsView({ refreshKey }) {
  const showToast = useToast()
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [localRefresh, setLocalRefresh] = useState(0)

  const [preset, setPreset] = useState('all')
  const [customStart, setCustomStart] = useState(defaultCustomDate)
  const [customEnd, setCustomEnd] = useState(defaultCustomDate)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(new Set())
  const [sortOption, setSortOption] = useState('date_desc')

  async function load() {
    setLoading(true)
    setLoadError(false)
    const [t, c, g] = await Promise.all([
      supabase.from('transactions').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('category_groups').select('*'),
    ])
    if (t.error || c.error || g.error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    setTransactions(t.data ?? [])
    setCategories(c.data ?? [])
    setGroups(g.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey, localRefresh])

  if (editingTx) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
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

  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]))

  if (showFilters) {
    return (
      <TransactionFilters
        groups={groups}
        categories={categories}
        preset={preset}
        setPreset={setPreset}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        selectedCategoryIds={selectedCategoryIds}
        setSelectedCategoryIds={setSelectedCategoryIds}
        onBack={() => setShowFilters(false)}
      />
    )
  }

  const range = resolveFilterRange(preset, customStart, customEnd)
  const filtered = transactions.filter((t) => {
    const inRange = !range || (t.date >= range.start && t.date <= range.end)
    const inCategory = selectedCategoryIds.size === 0 || selectedCategoryIds.has(t.category_id)
    return inRange && inCategory
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortOption) {
      case 'date_asc': return a.date.localeCompare(b.date)
      case 'amount_desc': return Number(b.amount) - Number(a.amount)
      case 'amount_asc': return Number(a.amount) - Number(b.amount)
      case 'date_desc':
      default: return b.date.localeCompare(a.date)
    }
  })

  const hasActiveFilters = preset !== 'all' || selectedCategoryIds.size > 0

  function handleExport() {
    if (sorted.length === 0) {
      showToast('Nada para exportar nesse filtro', 'error')
      return
    }
    const csv = transactionsToCsv(sorted, categoriesById, groupsById)
    const filename = range
      ? `transacoes_${range.start}_a_${range.end}.csv`
      : 'transacoes_todas.csv'
    downloadCsv(csv, filename)
    showToast('CSV exportado')
  }

  return (
    <div>
      <div className="tx-header">
        <div className="tx-header-btn-wrap">
          <button className="icon-btn" onClick={() => setShowFilters(true)} aria-label="Filtros">
            <IconFilter />
          </button>
          {hasActiveFilters && <span className="filter-badge-dot" />}
        </div>
        <SortMenu value={sortOption} onChange={setSortOption} />
        <button className="icon-btn" onClick={handleExport} aria-label="Exportar CSV">
          <IconDownload />
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          {transactions.length === 0
            ? 'Nenhum lançamento ainda. Toque em "+" para adicionar o primeiro.'
            : 'Nenhum lançamento com esse filtro.'}
        </div>
      ) : (
        sorted.map((tx) => {
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
        })
      )}
    </div>
  )
}
