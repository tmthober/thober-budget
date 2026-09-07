import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { IconChevronLeft, IconChevronRight } from './icons'
import {
  formatCurrency, formatMonthLabel, addMonths, toMonthKey,
  computeCategorySummaries, computeToBeBudgeted,
} from '../lib/budget'

export default function BudgetView({ refreshKey }) {
  const [month, setMonth] = useState(new Date())
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [budgetEntries, setBudgetEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  const monthKey = toMonthKey(month)

  async function loadData() {
    setLoading(true)
    const [g, c, b, t] = await Promise.all([
      supabase.from('category_groups').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('budget_entries').select('*'),
      supabase.from('transactions').select('*'),
    ])
    setGroups(g.data ?? [])
    setCategories(c.data ?? [])
    setBudgetEntries(b.data ?? [])
    setTransactions(t.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [refreshKey])

  if (loading) return <div className="empty-state">Carregando orçamento...</div>

  const incomeGroup = groups.find((g) => g.name === 'Income')
  const expenseGroups = groups.filter((g) => g.name !== 'Income')
  const summaries = computeCategorySummaries(categories, budgetEntries, transactions, monthKey)
  const toBeBudgeted = computeToBeBudgeted(categories, budgetEntries, transactions, monthKey)

  const expenseSummaries = summaries.filter((s) => s.group_id !== incomeGroup?.id)
  const totalBudgetedThisMonth = expenseSummaries.reduce((sum, s) => sum + s.budgetedThisMonth, 0)
  const totalActivityThisMonth = expenseSummaries.reduce((sum, s) => sum + s.activityThisMonth, 0)
  const totalRemaining = totalBudgetedThisMonth - totalActivityThisMonth
  const monthPct = totalBudgetedThisMonth > 0
    ? Math.min((totalActivityThisMonth / totalBudgetedThisMonth) * 100, 100)
    : (totalActivityThisMonth > 0 ? 100 : 0)
  const monthOverBudget = totalActivityThisMonth > totalBudgetedThisMonth

  function startEdit(cat) {
    setEditingId(cat.id)
    setEditValue(String(cat.budgetedThisMonth || ''))
  }

  async function saveEdit(catId) {
    const amount = parseFloat(editValue.replace(',', '.')) || 0
    await supabase.from('budget_entries').upsert(
      { category_id: catId, month: monthKey, budgeted_amount: amount },
      { onConflict: 'category_id,month' }
    )
    setEditingId(null)
    loadData()
  }

  return (
    <div>
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

      {expenseGroups.map((group) => {
        const groupCats = summaries.filter((c) => c.group_id === group.id)
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
              return (
                <div className="category-row" key={cat.id}>
                  <div className="category-row-top">
                    <div>
                      <p className="name">{cat.name}</p>
                      {editingId === cat.id ? (
                        <input
                          autoFocus
                          inputMode="decimal"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(cat.id)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(cat.id)}
                          style={{ width: 90, fontSize: 12, padding: '2px 6px', marginTop: 2 }}
                        />
                      ) : (
                        <p className="sub" onClick={() => startEdit(cat)}>
                          Orçado {formatCurrency(cat.budgetedThisMonth)}
                          {cat.activityThisMonth !== 0 && ` · Gasto ${formatCurrency(cat.activityThisMonth)}`}
                        </p>
                      )}
                    </div>
                    <span className="available" style={{
                      color: cat.available < 0 ? 'var(--danger)' : cat.available === 0 ? 'var(--ink-soft)' : 'var(--accent)',
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
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
