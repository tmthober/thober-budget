import CategoryDetailView from './CategoryDetailView'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import { IconChevronLeft, IconChevronRight, IconSearch } from './icons'
import {
  formatCurrency, formatMonthLabel, addMonths, toMonthKey,
  computeCategorySummaries, computeToBeBudgeted, withCardPaymentActivity,
} from '../lib/budget'
import { fetchOverspendMoves, summarizeOverspendMoves } from '../lib/overspendHistory'
import { useToast } from '../lib/ToastContext'
import OverspendWarning from './OverspendWarning'
import { loadCopyPreview, applyCopyBudget } from '../lib/copyBudget'

const HISTORY_WINDOW_MONTHS = 3

export default function BudgetView({ refreshKey }) {
  const showToast = useToast()
  const [month, setMonth] = useState(new Date())
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [budgetEntries, setBudgetEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [transfers, setTransfers] = useState([])
  const [targets, setTargets] = useState({})
  const [overspendStats, setOverspendStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState(null)
  const [targetEditingId, setTargetEditingId] = useState(null)
  const [targetEditValue, setTargetEditValue] = useState('')
  const [targetEditType, setTargetEditType] = useState('set_aside')
  const [targetEditError, setTargetEditError] = useState(null)
  const [search, setSearch] = useState('')
  const [overspendTarget, setOverspendTarget] = useState(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryGroupId, setNewCategoryGroupId] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addCategoryError, setAddCategoryError] = useState(null)
  const [savingCategory, setSavingCategory] = useState(false)
  const [copyPanel, setCopyPanel] = useState(null)
  const [detailCatId, setDetailCatId] = useState(null)

  const monthKey = toMonthKey(month)
  const historyStartKey = toMonthKey(addMonths(month, -(HISTORY_WINDOW_MONTHS - 1)))

  async function loadData() {
    setLoading(true)
    setLoadError(false)
    const [g, c, b, t, a, tr, tg] = await Promise.all([
      supabase.from('category_groups').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('budget_entries').select('*'),
      supabase.from('transactions').select('*'),
      supabase.from('accounts').select('*'),
      supabase.from('account_transfers').select('*'),
      supabase.from('category_targets').select('*'),
    ])
    if (g.error || c.error || b.error || t.error || a.error || tr.error || tg.error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    setGroups(g.data ?? [])
    setCategories(c.data ?? [])
    setBudgetEntries(b.data ?? [])
    setTransactions(t.data ?? [])
    setAccounts(a.data ?? [])
    setTransfers(tr.data ?? [])
    setTargets(Object.fromEntries((tg.data ?? []).map((x) => [x.category_id, { amount: Number(x.monthly_amount), type: x.target_type ?? 'set_aside' }])))

    const { moves } = await fetchOverspendMoves(historyStartKey, monthKey)
    setOverspendStats(summarizeOverspendMoves(moves))

    setLoading(false)
  }

  useEffect(() => { loadData(); setCopyPanel(null) }, [refreshKey, monthKey])

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
  const effectiveTransactions = withCardPaymentActivity(transactions, accounts, transfers, categories)
  const summaries = computeCategorySummaries(categories, budgetEntries, effectiveTransactions, monthKey)
  const toBeBudgeted = computeToBeBudgeted(categories, budgetEntries, accounts, transactions, transfers, monthKey)

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

  const expenseSummaries = summaries.filter((s) => s.group_id !== incomeGroup?.id && !s.is_income)
  // Pagamento do cartão não entra no "Gasto do mês": a compra no cartão já é
  // contada na categoria em que foi feita.
  const spendingSummaries = expenseSummaries.filter((s) => !s.is_card_payment)
  // Meta: quanto falta (meta − orçado do mês) em cada categoria que tem meta.
  // "Separar mais": compara a meta com o orçado do mês.
  // "Completar até": compara com o que já está no envelope (sobra do mês
  // anterior + orçado do mês), sem descontar o gasto.
  const targetLabel = (t) =>
    t.type === 'refill'
      ? `Meta: ter ${formatCurrency(t.amount)}`
      : `Meta: ${formatCurrency(t.amount)} por mês`
  const missingFor = (s) => {
    const t = targets[s.id]
    if (!t) return 0
    const have = t.type === 'refill' ? s.available + s.activityThisMonth : s.budgetedThisMonth
    return Math.max(0, t.amount - have)
  }
  const totalMissingTargets = spendingSummaries.reduce(
    (sum, s) => sum + (targets[s.id] ? missingFor(s) : 0), 0
  )
  const totalBudgetedThisMonth = spendingSummaries.reduce((sum, s) => sum + s.budgetedThisMonth, 0)
  const totalActivityThisMonth = spendingSummaries.reduce((sum, s) => sum + s.activityThisMonth, 0)
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

  function startTargetEdit(cat) {
    setTargetEditingId(cat.id)
    setTargetEditValue(targets[cat.id] ? String(targets[cat.id].amount) : '')
    setTargetEditType(targets[cat.id]?.type ?? 'set_aside')
    setTargetEditError(null)
  }

  // Meta mensal: valor > 0 grava; vazio ou 0 remove a meta.
  async function saveTarget(catId) {
    const amount = parseFloat(targetEditValue.replace(',', '.')) || 0
    const { error } = amount > 0
      ? await supabase.from('category_targets').upsert(
          { category_id: catId, monthly_amount: amount, target_type: targetEditType, updated_at: new Date().toISOString() },
          { onConflict: 'category_id' }
        )
      : await supabase.from('category_targets').delete().eq('category_id', catId)
    if (error) {
      setTargetEditError('Não foi possível salvar. Verifique sua internet e tente de novo.')
      return
    }
    setTargetEditingId(null)
    setTargetEditError(null)
    showToast(amount > 0 ? 'Meta atualizada' : 'Meta removida')
    loadData()
  }

  async function saveEdit(catId) {
    const amount = parseFloat(editValue.replace(',', '.')) || 0
    const { error } = await supabase.from('budget_entries').upsert(
      { category_id: catId, month: monthKey, budgeted_amount: amount },
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

  async function openCopyPanel() {
    setCopyPanel({ status: 'loading' })
    const result = await loadCopyPreview(monthKey, categories)
    if (result.error) {
      setCopyPanel({ status: 'error' })
      return
    }
    setCopyPanel({ status: 'ready', preview: result })
  }

  async function confirmCopy() {
    const panel = copyPanel
    setCopyPanel({ ...panel, status: 'saving' })
    const { error } = await applyCopyBudget(panel.preview.rows)
    if (error) {
      setCopyPanel({ ...panel, status: 'error' })
      return
    }
    setCopyPanel(null)
    showToast('Orçado copiado do mês anterior')
    loadData()
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

  if (detailCatId) {
    const detailCat = summaries.find((c) => c.id === detailCatId)
    if (detailCat) {
      return (
        <CategoryDetailView
          category={detailCat}
          month={month}
          target={targets[detailCatId]}
          onBack={() => setDetailCatId(null)}
          onDataChanged={loadData}
        />
      )
    }
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

      <div style={{ marginBottom: 12 }}>
        {!copyPanel ? (
          <button type="button" className="secondary-btn" onClick={openCopyPanel}>
            Copiar orçado de {formatMonthLabel(addMonths(month, -1))}
          </button>
        ) : (
          <div className="category-row">
            {copyPanel.status === 'loading' && <p className="sub">Calculando valores originais...</p>}
            {copyPanel.status === 'error' && (
              <>
                <p className="edit-error-text">
                  Não foi possível copiar. Nada foi alterado ou parte falhou — verifique a internet e tente de novo (só categorias zeradas são tocadas).
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="secondary-btn" onClick={openCopyPanel}>Tentar novamente</button>
                  <button type="button" className="secondary-btn" onClick={() => setCopyPanel(null)}>Fechar</button>
                </div>
              </>
            )}
            {(copyPanel.status === 'ready' || copyPanel.status === 'saving') && (() => {
              const p = copyPanel.preview
              const saving = copyPanel.status === 'saving'
              if (p.rows.length === 0) {
                return (
                  <>
                    <p className="sub">
                      {p.prevEmpty
                        ? 'O mês anterior não tem orçamento para copiar.'
                        : 'Nada para copiar: as categorias do mês anterior já têm orçado neste mês.'}
                    </p>
                    <button type="button" className="secondary-btn" style={{ marginTop: 8 }} onClick={() => setCopyPanel(null)}>
                      Fechar
                    </button>
                  </>
                )
              }
              return (
                <>
                  <p className="name">Copiar orçado original</p>
                  <p className="sub">
                    {p.rows.length} {p.rows.length === 1 ? 'categoria sem orçado' : 'categorias sem orçado'} neste mês
                    receberão o valor planejado de {formatMonthLabel(addMonths(month, -1))}, antes de estouros e empréstimos.
                    Total: {formatCurrency(p.total)}.
                  </p>
                  {p.adjusted > 0 && (
                    <p className="sub">{p.adjusted} delas tiveram o valor ajustado por cobertura — o ajuste não é copiado.</p>
                  )}
                  {p.keptExisting > 0 && (
                    <p className="sub">{p.keptExisting} que já têm orçado neste mês ficam como estão.</p>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="secondary-btn" onClick={confirmCopy} disabled={saving}>
                      {saving ? 'Copiando...' : 'Copiar'}
                    </button>
                    <button type="button" className="secondary-btn" onClick={() => setCopyPanel(null)} disabled={saving}>
                      Cancelar
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        )}
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
        {totalMissingTargets > 0 && (
          <p className="month-summary-targets">
            Faltam {formatCurrency(totalMissingTargets)} para cumprir as metas do mês
          </p>
        )}
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
                        {cat.is_card_payment ? (
                          <p className="name">{cat.name}</p>
                        ) : (
                          <p className="name name-link" onClick={() => setDetailCatId(cat.id)}>
                            {cat.name} <span className="name-chevron">›</span>
                          </p>
                        )}
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
                          cat.is_card_payment ? (
                            <>
                              <p className="sub">
                                {cat.activityThisMonth < 0
                                  ? `Reservado no mês ${formatCurrency(-cat.activityThisMonth)}`
                                  : cat.activityThisMonth > 0
                                    ? `Fatura paga no mês ${formatCurrency(cat.activityThisMonth)}`
                                    : 'Reserva automática das compras no cartão'}
                              </p>
                              <p className="sub" onClick={() => startEdit(cat)}>
                                Orçado {formatCurrency(cat.budgetedThisMonth)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="sub" onClick={() => startEdit(cat)}>
                                Orçado {formatCurrency(cat.budgetedThisMonth)}
                                {cat.activityThisMonth !== 0 && ` · Gasto ${formatCurrency(cat.activityThisMonth)}`}
                              </p>
                              {targetEditingId === cat.id ? (
                                <div className="target-editor">
                                  <div className="target-type-toggle" role="group" aria-label="Tipo de meta">
                                    <button
                                      type="button"
                                      className={targetEditType === 'set_aside' ? 'active' : ''}
                                      onClick={() => setTargetEditType('set_aside')}
                                    >
                                      Separar mais
                                    </button>
                                    <button
                                      type="button"
                                      className={targetEditType === 'refill' ? 'active' : ''}
                                      onClick={() => setTargetEditType('refill')}
                                    >
                                      Completar até
                                    </button>
                                  </div>
                                  <p className="target-hint">
                                    {targetEditType === 'set_aside'
                                      ? 'Colocar este valor todo mês, sem olhar a sobra. Bom para contas e poupança.'
                                      : 'Ter este valor disponível no envelope; a sobra do mês anterior conta. Bom para mercado, lazer, combustível.'}
                                  </p>
                                  <input
                                    autoFocus
                                    inputMode="decimal"
                                    value={targetEditValue}
                                    onChange={(e) => setTargetEditValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && saveTarget(cat.id)}
                                    placeholder="Valor da meta (0 remove)"
                                    style={{ width: 170, fontSize: 12, padding: '4px 6px', marginTop: 4 }}
                                  />
                                  {targetEditError && (
                                    <p className="edit-error-text">{targetEditError}</p>
                                  )}
                                  <div className="target-editor-actions">
                                    <button type="button" className="secondary-btn" onClick={() => saveTarget(cat.id)}>
                                      Salvar
                                    </button>
                                    <button type="button" className="secondary-btn" onClick={() => setTargetEditingId(null)}>
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : targets[cat.id]?.amount > 0 ? (
                                <p
                                  className={`sub target-sub ${missingFor(cat) > 0 ? 'missing' : 'ok'}`}
                                  onClick={() => startTargetEdit(cat)}
                                >
                                  {missingFor(cat) > 0
                                    ? `${targetLabel(targets[cat.id])} · faltam ${formatCurrency(missingFor(cat))}`
                                    : `${targetLabel(targets[cat.id])} · cumprida ✓`}
                                </p>
                              ) : (
                                <p className="sub target-sub add" onClick={() => startTargetEdit(cat)}>
                                  + Definir meta
                                </p>
                              )}
                            </>
                          )
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
