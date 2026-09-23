import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import { useHousehold } from '../lib/HouseholdContext'
import { IconChevronLeft, IconChevronRight, IconSearch } from './icons'
import {
  formatCurrency, formatMonthLabel, addMonths, toMonthKey,
  computeCategorySummaries, computeToBeBudgeted,
} from '../lib/budget'
import { fetchOverspendMoves, summarizeOverspendMoves } from '../lib/overspendHistory'
import { useToast } from '../lib/ToastContext'
import OverspendWarning from './OverspendWarning'
import { getCategoryGroups, getCategories, getBudgetEntries, getTransactions } from '../lib/supabaseQueries'

const HISTORY_WINDOW_MONTHS = 3

export default function BudgetView({ refreshKey }) {
  const showToast = useToast()
  const { selectedHousehold } = useHousehold()
  const [month, setMonth] = useState(new Date())
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [budgetEntries, setBudgetEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [overspendStats, setOverspendStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState(null)
  const [search, setSearch] = useState('')
  const [overspendTarget, setOverspendTarget] = useState(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryGroupId, setNewCategoryGroupId] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addCategoryError, setAddCategoryError] = useState(null)
  const [savingCategory, setSavingCategory] = useState(false)

  const monthKey = toMonthKey(month)
  const historyStartKey = toMonthKey(addMonths(month, -(HISTORY_WINDOW_MONTHS - 1)))

  async function loadData() {
    if (!selectedHousehold) return
    
    setLoading(true)
    setLoadError(false)
    const [g, c, b, t] = await Promise.all([
      getCategoryGroups(selectedHousehold.id),
      getCategories(selectedHousehold.id),
      getBudgetEntries(selectedHousehold.id),
      getTransactions(selectedHousehold.id),
    ])
    if (g.error || c.error || b.error || t.error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    setGroups(g.data ?? [])
    setCategories(c.data ?? [])
    setBudgetEntries(b.data ?? [])
    setTransactions(t.data ?? [])

    const { moves } = await fetchOverspendMoves(historyStartKey, monthKey, selectedHousehold.id)
    setOverspendStats(summarizeOverspendMoves(moves))

    setLoading(false)
  }

  useEffect(() => { loadData() }, [refreshKey, monthKey])

  if (loading) return <div className="empty-state">Carregando orçamento...</div>

  if (loadError) {
    return (
      <div className="empty-state">
        <p>Não foi possível carregar o orçamento. Verifique sua conexão.</p>
        <button className="secondary-btn" onClick={loadData} style={{ marginTop: 12 }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  const incomeGroup = groups.find((g) => g.name === 'Income')
  const expenseGroups = groups.filter((g) => g.name !== 'Income')
  const summaries = computeCategorySummaries(categories, budgetEntries, transactions, monthKey)
  const toBeBudgeted = computeToBeBudgeted(categories, budgetEntries, transactions, monthKey)

  if (overspendTarget) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <OverspendWarning
          overspendInfo={overspendTarget}
          categories={categories}
          onResolve={() => {
            setOverspendTarget(null)
            showToast('Orçamento atualizado')
            loadData()
          }}
        />
      </motion.div>
    )
  }

  const expenseSummaries = summaries.filter((s) => s.group_id !== incomeGroup?.id)
  const totalBudgetedThisMonth = expenseSummaries.reduce((sum, s) => sum + s.budgetedThisMonth, 0)
  const totalActivityThisMonth = expenseSummaries.reduce((sum, s) => sum + s.activityThisMonth, 0)
  const totalRemaining = totalBudgetedThisMonth - totalActivityThisMonth
  const monthPct = totalBudgetedThisMonth > 0
    ? Math.min((totalActivityThisMonth / totalBudgetedThisMonth) * 100, 100)
    : (totalActivityThisMonth > 0 ? 100 : 0)
  const monthOverBudget = totalActivityThisMonth > totalBudgetedThisMonth

  const query = search.trim().toLowerCase()
  const visibleSummaries = query
    ? expenseSummaries.filter((c) => c.name.toLowerCase().includes(query))
    : expenseSummaries

  function startEdit(cat) {
    setEditingId(cat.id)
    setEditValue(String(cat.budgetedThisMonth || ''))
    setEditError(null)
  }

  async function saveEdit(catId) {
    const amount = parseFloat(editValue.replace(',', '.')) || 0
    const { error } = await supabase.from('budget_entries').upsert(
      { category_id: catId, month: monthKey, budgeted_amount: amount, household_id: selectedHousehold.id },
      { onConflict: 'category_id,month' }
    )
    if (error) {
      // Mantém o campo aberto com o valor digitado — nada se perde, e a
      // pessoa vê exatamente por que não salvou.
      setEditError('Não foi possível salvar. Verifique sua internet e tente de novo.')
      return
    }
    setEditingId(null)
    setEditError(null)
    showToast('Orçamento atualizado')
    loadData()
  }

  function openCoverOverspend(cat) {
    setOverspendTarget({
      category: cat,
      monthKey,
      overspentAmount: Math.abs(cat.available),
    })
  }

  function startAddCategory() {
    setAddingCategory(true)
    setNewCategoryGroupId(expenseGroups[0]?.id ?? '')
    setNewCategoryName('')
    setAddCategoryError(null)
  }

  function cancelAddCategory() {
    setAddingCategory(false)
    setNewCategoryName('')
    setAddCategoryError(null)
  }

  async function saveNewCategory() {
    const name = newCategoryName.trim()
    if (!newCategoryGroupId) {
      setAddCategoryError('Escolha um grupo.')
      return
    }
    if (!name) {
      setAddCategoryError('Digite um nome para a categoria.')
      return
    }
    setSavingCategory(true)
    const catsInGroup = categories.filter((c) => c.group_id === newCategoryGroupId)
    const nextSortOrder = catsInGroup.length > 0
      ? Math.max(...catsInGroup.map((c) => c.sort_order)) + 1
      : 0
    const { error } = await supabase.from('categories').insert({
      group_id: newCategoryGroupId,
      name,
      sort_order: nextSortOrder,
      is_income: false,
      household_id: selectedHousehold.id,
    })
    setSavingCategory(false)
    if (error) {
      setAddCategoryError('Não foi possível salvar. Verifique sua internet e tente de novo.')
      return
    }
    setAddingCategory(false)
    setNewCategoryName('')
    setAddCategoryError(null)
    showToast('Categoria adicionada')
    loadData()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button
          type="button"
          className="icon-btn"
          onClick={startAddCategory}
          aria-label="Adicionar categoria"
        >
          <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>+</span>
        </button>
      </div>

      {addingCategory && (
        <div className="category-row" style={{ marginBottom: 16 }}>
          <p className="name" style={{ marginBottom: 8 }}>Nova categoria</p>
          <select
            value={newCategoryGroupId}
            onChange={(e) => setNewCategoryGroupId(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', marginBottom: 8 }}
          >
            {expenseGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <input
            autoFocus
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveNewCategory()}
            placeholder="Nome da categoria"
            style={{ width: '100%', padding: '6px 8px' }}
          />
          {addCategoryError && (
            <p className="edit-error-text">{addCategoryError}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={saveNewCategory}
              disabled={savingCategory}
            >
              Salvar
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={cancelAddCategory}
              disabled={savingCategory}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="month-nav">
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
          <IconChevronLeft />
        </button>
        <span>{formatMonthLabel(month)}</span>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
          <IconChevronRight />
        </button>
      </div>

      <div className="tobudget-card">
        <p className="label">Pronto para orçar</p>
        <p className={`amount ${toBeBudgeted >= 0 ? 'positive' : 'negative'}`}>
          {formatCurrency(toBeBudgeted)}
        </p>
      </div>

      <div className="month-summary">
        <div className="month-summary-row">
          <span>Gasto do mês</span>
          <span className={monthOverBudget ? 'over' : ''}>
            {formatCurrency(totalActivityThisMonth)} de {formatCurrency(totalBudgetedThisMonth)}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${monthPct}%`,
              background: monthOverBudget ? 'var(--danger)' : 'var(--accent)',
            }}
          />
        </div>
        <p className={`month-summary-remaining ${totalRemaining < 0 ? 'over' : ''}`}>
          {totalRemaining >= 0
            ? `Restam ${formatCurrency(totalRemaining)} orçados`
            : `${formatCurrency(Math.abs(totalRemaining))} acima do orçado`}
        </p>
      </div>

      <div className="budget-search">
        <IconSearch size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoria..."
        />
      </div>

      {visibleSummaries.length === 0 ? (
        <p className="empty-state">Nenhuma categoria encontrada.</p>
      ) : (
        expenseGroups.map((group) => {
          const groupCats = visibleSummaries.filter((c) => c.group_id === group.id)
          if (groupCats.length === 0) return null
          const groupAvailable = groupCats.reduce((s, c) => s + c.available, 0)
          return (
            <div key={group.id}>
              <div className="group-title">
                <span>{group.name}</span>
                <span>{formatCurrency(groupAvailable)}</span>
              </div>
              {groupCats.map((cat) => {
                const catPct = cat.budgetedThisMonth > 0
                  ? Math.min((cat.activityThisMonth / cat.budgetedThisMonth) * 100, 100)
                  : (cat.activityThisMonth > 0 ? 100 : 0)
                const catOverBudget = cat.activityThisMonth > cat.budgetedThisMonth && cat.budgetedThisMonth > 0
                const hist = overspendStats[cat.id]
                const overspentCount = hist?.overspentMonths.size ?? 0
                const lentCount = hist?.lentMonths.size ?? 0
                const isNegative = cat.available < 0
                return (
                  <div className="category-row" key={cat.id}>
                    <div className="category-row-top">
                      <div>
                        <p className="name">{cat.name}</p>
                        {editingId === cat.id ? (
                          <>
                            <input
                              autoFocus
                              inputMode="decimal"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => saveEdit(cat.id)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit(cat.id)}
                              style={{ width: 90, fontSize: 12, padding: '2px 6px', marginTop: 2 }}
                            />
                            {editError && (
                              <p className="edit-error-text">{editError}</p>
                            )}
                          </>
                        ) : (
                          <p className="sub" onClick={() => startEdit(cat)}>
                            Orçado {formatCurrency(cat.budgetedThisMonth)}
                            {cat.activityThisMonth !== 0 && ` · Gasto ${formatCurrency(cat.activityThisMonth)}`}
                          </p>
                        )}
                      </div>
                      <span className="available" style={{
                        color: isNegative ? 'var(--danger)' : cat.available === 0 ? 'var(--ink-soft)' : 'var(--accent)',
                      }}>
                        {formatCurrency(cat.available)}
                      </span>
                    </div>
                    {cat.budgetedThisMonth > 0 && (
                      <div className="progress-track thin">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${catPct}%`,
                            background: catOverBudget ? 'var(--danger)' : 'var(--accent)',
                          }}
                        />
                      </div>
                    )}
                    {isNegative && (
                      <button
                        type="button"
                        className="cover-overspend-btn"
                        onClick={() => openCoverOverspend(cat)}
                      >
                        Cobrir estouro →
                      </button>
                    )}
                    {overspentCount >= 2 && (
                      <p className="history-badge warn">
                        ⚠️ Precisou de cobertura em {overspentCount} dos últimos {HISTORY_WINDOW_MONTHS} meses
                      </p>
                    )}
                    {lentCount >= 2 && (
                      <p className="history-badge info">
                        💸 Emprestou dinheiro pra outras categorias em {lentCount} dos últimos {HISTORY_WINDOW_MONTHS} meses
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
