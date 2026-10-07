import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { IconChevronLeft } from './icons'
import { formatCurrency, formatMonthLabel, toMonthKey, addMonths } from '../lib/budget'
import { useToast } from '../lib/ToastContext'

// Formata 'YYYY-MM-DD' como 'DD/MM' para exibição na timeline
function formatDay(dateStr) {
  const [, , dd] = dateStr.split('-')
  return `${dd}/${dateStr.slice(5, 7)}`
}


export default function CategoryDetailView({ category, month, target, onBack, onDataChanged }) {
  const showToast = useToast()
  const monthKey = toMonthKey(month)

  const [transactions, setTransactions] = useState([])
  const [moves, setMoves] = useState([])
  const [budgetedThisMonth, setBudgetedThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Estado de edição do orçamento
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [accountsById, setAccountsById] = useState({})

  // Meta mensal: valor fixo que as coberturas nunca alteram
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetValue, setTargetValue] = useState(target ? String(target.amount) : '')
  const [targetType, setTargetType] = useState(target?.type ?? 'set_aside')
  const [targetError, setTargetError] = useState(null)
  const [savingTarget, setSavingTarget] = useState(false)

  const ymTarget = monthKey.slice(0, 7) // 'YYYY-MM'

  async function loadData() {
    setLoading(true)
    setLoadError(false)
    // Fim do mês como "primeiro dia do mês seguinte" (comparação exclusiva):
    // evita datas inválidas como 31 de setembro, que o Postgres rejeita.
    const nextMonthStart = toMonthKey(addMonths(month, 1))
    const [txRes, movesRes, budgetRes, accRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('category_id', category.id)
        .gte('date', monthKey)
        .lt('date', nextMonthStart)
        .order('date', { ascending: true }),
      supabase
        .from('overspend_moves')
        .select('*, from_cat:from_category_id(name), to_cat:to_category_id(name)')
        .eq('month', monthKey)
        .or(`from_category_id.eq.${category.id},to_category_id.eq.${category.id}`),
      supabase
        .from('budget_entries')
        .select('budgeted_amount')
        .eq('category_id', category.id)
        .eq('month', monthKey)
        .maybeSingle(),
      supabase.from('accounts').select('id, name'),
    ])

    if (txRes.error || movesRes.error || budgetRes.error || accRes.error) {
      setLoadError(true)
      setLoading(false)
      return
    }

    setTransactions(txRes.data ?? [])
    setAccountsById(Object.fromEntries((accRes.data ?? []).map((a) => [a.id, a.name])))
    setMoves(movesRes.data ?? [])
    const bAmt = budgetRes.data ? Number(budgetRes.data.budgeted_amount) : 0
    setBudgetedThisMonth(bAmt)
    setEditValue(String(bAmt || ''))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [category.id, monthKey])

  async function saveEdit() {
    setSaving(true)
    setEditError(null)
    const amount = parseFloat(String(editValue).replace(',', '.')) || 0
    const { error } = await supabase.from('budget_entries').upsert(
      { category_id: category.id, month: monthKey, budgeted_amount: amount },
      { onConflict: 'category_id,month' }
    )
    setSaving(false)
    if (error) {
      setEditError('Não foi possível salvar. Verifique sua internet e tente de novo.')
      return
    }
    setEditing(false)
    setBudgetedThisMonth(amount)
    setEditError(null)
    showToast('Orçamento atualizado')
    onDataChanged?.()
  }

  async function saveTarget() {
    setSavingTarget(true)
    setTargetError(null)
    const amount = parseFloat(String(targetValue).replace(',', '.')) || 0
    const { error } = amount > 0
      ? await supabase.from('category_targets').upsert(
          { category_id: category.id, monthly_amount: amount, target_type: targetType, updated_at: new Date().toISOString() },
          { onConflict: 'category_id' }
        )
      : await supabase.from('category_targets').delete().eq('category_id', category.id)
    setSavingTarget(false)
    if (error) {
      setTargetError('Não foi possível salvar. Verifique sua internet e tente de novo.')
      return
    }
    setEditingTarget(false)
    showToast(amount > 0 ? 'Meta atualizada' : 'Meta removida')
    onDataChanged?.()
  }

  function cancelTargetEdit() {
    setEditingTarget(false)
    setTargetValue(target ? String(target.amount) : '')
    setTargetType(target?.type ?? 'set_aside')
    setTargetError(null)
  }

  // "Separar mais" compara com o orçado do mês; "Completar até" com o que já
  // está no envelope (sobra do mês anterior + orçado), sem descontar o gasto.
  const missingTarget = target
    ? Math.max(
        0,
        target.amount -
          (target.type === 'refill'
            ? category.available + category.activityThisMonth
            : category.budgetedThisMonth)
      )
    : 0

  function cancelEdit() {
    setEditing(false)
    setEditValue(String(budgetedThisMonth || ''))
    setEditError(null)
  }

  // Monta a timeline: transações + moves, ordenados por data/posição
  // Moves não têm hora — colocamos ao final do dia do mês (sem data específica),
  // representados com dateSort = monthKey + sufixo para ficarem juntos no final
  function buildTimeline() {
    const items = []

    for (const tx of transactions) {
      items.push({
        key: `tx-${tx.id}`,
        sort: tx.date + '-tx',
        date: tx.date,
        type: 'transaction',
        data: tx,
      })
    }

    for (const mv of moves) {
      const isBorrowed = mv.to_category_id === category.id
      items.push({
        key: `mv-${mv.id}`,
        // Moves ficam após transações do dia final do mês (sem data exata)
        sort: monthKey.slice(0, 7) + '-99-mv',
        date: null,
        type: isBorrowed ? 'borrowed' : 'lent',
        data: mv,
      })
    }

    items.sort((a, b) => a.sort.localeCompare(b.sort))
    return items
  }

  const timeline = buildTimeline()
  const totalSpent = transactions.reduce((s, t) => s + Number(t.amount), 0)
  const totalBorrowed = moves
    .filter((m) => m.to_category_id === category.id)
    .reduce((s, m) => s + Number(m.amount), 0)
  const totalLent = moves
    .filter((m) => m.from_category_id === category.id)
    .reduce((s, m) => s + Number(m.amount), 0)

  return (
    <div className="detail-view">
      {/* Cabeçalho com botão voltar */}
      <div className="detail-header">
        <button className="icon-btn detail-back-btn" onClick={onBack} aria-label="Voltar">
          <IconChevronLeft />
        </button>
        <div className="detail-header-text">
          <h2 className="detail-title">{category.name}</h2>
          <p className="detail-subtitle">{formatMonthLabel(month)}</p>
        </div>
      </div>

      {loading && <div className="empty-state">Carregando...</div>}

      {!loading && loadError && (
        <div className="empty-state">
          <p>Não foi possível carregar. Verifique sua conexão.</p>
          <button className="secondary-btn" onClick={loadData} style={{ marginTop: 12 }}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* Card de resumo */}
          <div className="detail-summary-card">
            <div className="detail-summary-row">
              <span className="detail-summary-label">Orçado</span>
              {editing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    style={{ width: 110, fontSize: 14, padding: '4px 8px', textAlign: 'right' }}
                  />
                  <button
                    className="secondary-btn"
                    onClick={saveEdit}
                    disabled={saving}
                    style={{ padding: '4px 10px', fontSize: 13 }}
                  >
                    {saving ? '...' : 'Salvar'}
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={cancelEdit}
                    disabled={saving}
                    style={{ padding: '4px 10px', fontSize: 13 }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="detail-summary-value">{formatCurrency(budgetedThisMonth)}</span>
                  <button
                    className="secondary-btn"
                    onClick={() => setEditing(true)}
                    style={{ padding: '4px 10px', fontSize: 13 }}
                  >
                    Editar
                  </button>
                </div>
              )}
            </div>
            {editError && (
              <p className="edit-error-text" style={{ textAlign: 'right', marginTop: 4 }}>
                {editError}
              </p>
            )}
            <div className="detail-summary-row">
              <span className="detail-summary-label">Gasto no mês</span>
              <span className="detail-summary-value">{formatCurrency(totalSpent)}</span>
            </div>
            <div className="detail-summary-row">
              <span className="detail-summary-label">Disponível agora</span>
              <span className="detail-summary-value">{formatCurrency(category.available)}</span>
            </div>
            <div className="detail-target">
              <div className="detail-summary-row">
                <span className="detail-summary-label">Meta</span>
                {!editingTarget && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="detail-summary-value">
                      {target
                        ? target.type === 'refill'
                          ? `Ter ${formatCurrency(target.amount)}`
                          : `${formatCurrency(target.amount)} por mês`
                        : 'Sem meta'}
                    </span>
                    <button
                      className="secondary-btn"
                      onClick={() => setEditingTarget(true)}
                      style={{ padding: '4px 10px', fontSize: 13 }}
                    >
                      {target ? 'Editar' : 'Definir'}
                    </button>
                  </div>
                )}
              </div>
              {!editingTarget && target && (
                <p className="target-hint" style={{ textAlign: 'right', marginLeft: 'auto' }}>
                  {missingTarget > 0 ? `Faltam ${formatCurrency(missingTarget)} neste mês` : 'Meta cumprida neste mês ✓'}
                </p>
              )}
              {editingTarget && (
                <div className="target-editor">
                  <div className="target-type-toggle" role="group" aria-label="Tipo de meta">
                    <button
                      type="button"
                      className={targetType === 'set_aside' ? 'active' : ''}
                      onClick={() => setTargetType('set_aside')}
                    >
                      Separar mais
                    </button>
                    <button
                      type="button"
                      className={targetType === 'refill' ? 'active' : ''}
                      onClick={() => setTargetType('refill')}
                    >
                      Completar até
                    </button>
                  </div>
                  <p className="target-hint">
                    {targetType === 'set_aside'
                      ? 'Colocar este valor todo mês, sem olhar a sobra. Bom para contas e poupança.'
                      : 'Ter este valor disponível no envelope; a sobra do mês anterior conta. Bom para mercado, lazer, combustível.'}
                  </p>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
                    placeholder="Valor da meta (0 remove)"
                    style={{ width: 170, fontSize: 14, padding: '4px 8px', marginTop: 6 }}
                  />
                  {targetError && <p className="edit-error-text">{targetError}</p>}
                  <div className="target-editor-actions">
                    <button className="secondary-btn" onClick={saveTarget} disabled={savingTarget}>
                      {savingTarget ? '...' : 'Salvar'}
                    </button>
                    <button className="secondary-btn" onClick={cancelTargetEdit} disabled={savingTarget}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
            {totalBorrowed > 0 && (
              <div className="detail-summary-row">
                <span className="detail-summary-label">Recebeu de empréstimo</span>
                <span className="detail-summary-value detail-borrowed">{formatCurrency(totalBorrowed)}</span>
              </div>
            )}
            {totalLent > 0 && (
              <div className="detail-summary-row">
                <span className="detail-summary-label">Emprestou pra outras</span>
                <span className="detail-summary-value detail-lent">{formatCurrency(totalLent)}</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <h3 className="detail-section-title">Movimentações do mês</h3>

          {timeline.length === 0 ? (
            <p className="empty-state" style={{ paddingTop: 24 }}>
              Nenhuma movimentação neste mês.
            </p>
          ) : (
            <div className="detail-timeline">
              {timeline.map((item) => {
                if (item.type === 'transaction') {
                  const tx = item.data
                  return (
                    <div className="timeline-item" key={item.key}>
                      <div className="timeline-dot tx-dot" />
                      <div className="timeline-body">
                        <div className="timeline-row">
                          <span className="timeline-date">{formatDay(tx.date)}</span>
                          <span className="timeline-amount tx-amount">
                            − {formatCurrency(Number(tx.amount))}
                          </span>
                        </div>
                        {(accountsById[tx.account_id] || tx.note) && (
                          <p className="timeline-note">
                            {[accountsById[tx.account_id], tx.note].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                }

                if (item.type === 'borrowed') {
                  const mv = item.data
                  const fromName = mv.from_cat?.name ?? 'outra categoria'
                  return (
                    <div className="timeline-item" key={item.key}>
                      <div className="timeline-dot borrow-dot" />
                      <div className="timeline-body">
                        <div className="timeline-row">
                          <span className="timeline-label borrow-label">Cobertura de estouro</span>
                          <span className="timeline-amount borrow-amount">
                            + {formatCurrency(Number(mv.amount))}
                          </span>
                        </div>
                        <p className="timeline-note">De: {fromName}</p>
                      </div>
                    </div>
                  )
                }

                if (item.type === 'lent') {
                  const mv = item.data
                  const toName = mv.to_cat?.name ?? 'outra categoria'
                  return (
                    <div className="timeline-item" key={item.key}>
                      <div className="timeline-dot lent-dot" />
                      <div className="timeline-body">
                        <div className="timeline-row">
                          <span className="timeline-label lent-label">Empréstimo concedido</span>
                          <span className="timeline-amount lent-amount">
                            − {formatCurrency(Number(mv.amount))}
                          </span>
                        </div>
                        <p className="timeline-note">Para: {toName}</p>
                      </div>
                    </div>
                  )
                }

                return null
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
